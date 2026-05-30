const asyncHandler = require('../utils/asyncHandler');
const config = require('../config/env');
const {
  ADMIN_APPROVAL_EMAIL,
  approveAdminSignupWithToken,
  createAdminSignupApprovalToken,
  getAdminUserByUsername,
  getPasswordResetChallenge,
  isValidEmail,
  resetAdminPasswordWithSecurityAnswer,
  updateAdminCredentials,
} = require('../config/adminAuth');
const { sendAdminSignupApprovalEmail } = require('../services/emailService');
const {
  createAdminSession,
  destroyAdminSession,
  verifyAdminCredentials,
} = require('../middleware/adminAuthMiddleware');

const getRequestBaseUrl = (req) => {
  if (config.appBaseUrl) return config.appBaseUrl.replace(/\/+$/, '');

  const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
  return `${protocol}://${req.get('host')}`;
};


const redactSignupBody = (body = {}) => ({
  name: String(body.name || '').trim(),
  email: String(body.email || '').trim().toLowerCase(),
  hasPassword: Boolean(body.password),
  hasConfirmPassword: Boolean(body.confirmPassword),
  hasSecurityQuestion: Boolean(String(body.securityQuestion || '').trim()),
  hasSecurityAnswer: Boolean(String(body.securityAnswer || '').trim()),
});

const logSignupDebug = (message, context = {}) => {
  console.info(`[admin-signup] ${message}`, context);
};

const logSignupError = (message, context = {}) => {
  console.error(`[admin-signup] ${message}`, context);
};

const getCredentialErrorMessage = (reason) => ({
  USER_NOT_FOUND: 'No admin account exists for this email address.',
  MISSING_PASSWORD: 'Password is required.',
  WRONG_PASSWORD: 'Wrong password. Please try again.',
  CORRUPT_HASH: 'Stored password hash is corrupt or unsupported. Reset the password with the security question flow.',
}[reason] || 'Invalid admin credentials.');

const login = asyncHandler(async (req, res) => {
  const {
    username,
    email,
    password,
    rememberMe,
  } = req.body || {};
  const submittedUsername = String(username || email || '').trim().toLowerCase();

  if (!submittedUsername || !password) {
    return res.status(400).json({
      success: false,
      message: 'Admin email and password are required.',
    });
  }

  if (!isValidEmail(submittedUsername)) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a valid admin email address.',
    });
  }

  const verification = await verifyAdminCredentials(submittedUsername, password);
  if (!verification.ok) {
    return res.status(verification.reason === 'CORRUPT_HASH' ? 500 : 401).json({
      success: false,
      message: getCredentialErrorMessage(verification.reason),
    });
  }

  const session = await createAdminSession(req, res, verification.user.username, Boolean(rememberMe));

  return res.status(200).json({
    success: true,
    message: 'Login successful.',
    data: {
      username: session.username,
      expiresAt: new Date(session.expiresAt).toISOString(),
      rememberMe: session.rememberMe,
    },
  });
});

const requestSignup = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    confirmPassword,
    securityQuestion,
    securityAnswer,
  } = req.body || {};
  const submittedName = String(name || '').trim();
  const submittedEmail = String(email || '').trim().toLowerCase();
  const submittedPassword = String(password || '');
  const submittedSecurityQuestion = String(securityQuestion || '').trim();
  const submittedSecurityAnswer = String(securityAnswer || '').trim();
  const validationErrors = [];

  logSignupDebug('Received approval request.', {
    endpoint: req.originalUrl,
    method: req.method,
    body: redactSignupBody(req.body),
  });

  if (!submittedName) validationErrors.push('Full name is required.');
  if (!isValidEmail(submittedEmail)) validationErrors.push('Please enter a valid admin email address.');
  if (submittedPassword.length < 8) validationErrors.push('Password must be at least 8 characters long.');
  if (submittedPassword !== String(confirmPassword || '')) validationErrors.push('Password and confirm password must match.');
  if (!submittedSecurityQuestion) validationErrors.push('Security question is required.');
  if (!submittedSecurityAnswer) validationErrors.push('Security answer is required.');

  if (validationErrors.length) {
    logSignupError('Approval request validation failed.', {
      email: submittedEmail,
      validationErrors,
    });
    return res.status(400).json({
      success: false,
      message: validationErrors.join(' '),
      details: validationErrors,
    });
  }

  let approval;
  try {
    approval = await createAdminSignupApprovalToken({
      email: submittedEmail,
      password: submittedPassword,
      name: submittedName,
      securityQuestion: submittedSecurityQuestion,
      securityAnswer: submittedSecurityAnswer,
    });
    logSignupDebug('Approval request saved to JSON storage.', {
      email: approval.username,
      saved: approval.saved,
      pendingCount: approval.pendingCount,
      expiresAt: new Date(approval.expiresAt).toISOString(),
    });
  } catch (error) {
    logSignupError('Unable to save approval request to JSON storage.', {
      email: submittedEmail,
      message: error.message,
      stack: error.stack,
    });
    return res.status(409).json({
      success: false,
      message: error.message || 'Unable to create admin signup request.',
    });
  }

  const approvalLink = `${getRequestBaseUrl(req)}/api/v1/admin/auth/signup/approve?token=${encodeURIComponent(approval.token)}`;
  let delivery;
  try {
    delivery = await sendAdminSignupApprovalEmail({
      to: ADMIN_APPROVAL_EMAIL,
      signupEmail: approval.username,
      approvalLink,
      expiresInMinutes: approval.expiresInMinutes,
    });
    logSignupDebug('Approval notification delivery completed.', {
      email: approval.username,
      sent: Boolean(delivery?.sent),
      previewAvailable: Boolean(delivery?.previewLink),
    });
  } catch (error) {
    logSignupError('Approval request was saved but notification delivery failed.', {
      email: approval.username,
      message: error.message,
      stack: error.stack,
    });
    return res.status(502).json({
      success: false,
      message: `Approval request was saved, but the approval email could not be sent: ${error.message}`,
      data: {
        saved: true,
        email: approval.username,
      },
    });
  }

  return res.status(201).json({
    success: true,
    message: `Signup request saved and sent for approval. ${ADMIN_APPROVAL_EMAIL} must approve it before you can login.`,
    data: {
      saved: true,
      email: approval.username,
      expiresAt: new Date(approval.expiresAt).toISOString(),
      pendingCount: approval.pendingCount,
      ...(delivery?.previewLink && config.env !== 'production'
        ? { previewLink: delivery.previewLink }
        : {}),
    },
  });
});

const approveSignup = asyncHandler(async (req, res) => {
  const token = String(req.query?.token || '').trim();

  if (!token) {
    return res.redirect(302, '/admin-login.html?approved=missing');
  }

  const approved = approveAdminSignupWithToken(token);
  if (!approved) {
    return res.redirect(302, '/admin-login.html?approved=invalid');
  }

  return res.redirect(302, `/admin-login.html?approved=success&email=${encodeURIComponent(approved.username)}`);
});

const requestPasswordResetQuestion = asyncHandler(async (req, res) => {
  const submittedEmail = String(req.body?.email || '').trim().toLowerCase();

  if (!isValidEmail(submittedEmail)) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a valid admin email address.',
    });
  }

  const challenge = getPasswordResetChallenge(submittedEmail);
  if (!challenge) {
    return res.status(404).json({
      success: false,
      message: 'No admin account exists for this email address.',
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Security question loaded. Answer it to set a new password.',
    data: {
      email: challenge.email,
      securityQuestion: challenge.securityQuestion,
      configured: challenge.configured,
    },
  });
});

const completePasswordReset = asyncHandler(async (req, res) => {
  const {
    email,
    securityAnswer,
    newPassword,
    confirmPassword,
  } = req.body || {};
  const submittedEmail = String(email || '').trim().toLowerCase();
  const nextPassword = String(newPassword || '');

  if (!isValidEmail(submittedEmail)) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a valid admin email address.',
    });
  }

  if (!String(securityAnswer || '').trim()) {
    return res.status(400).json({
      success: false,
      message: 'Security answer is required.',
    });
  }

  if (nextPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 8 characters long.',
    });
  }

  if (nextPassword !== String(confirmPassword || '')) {
    return res.status(400).json({
      success: false,
      message: 'New password and confirm password must match.',
    });
  }

  const updatedUser = await resetAdminPasswordWithSecurityAnswer({
    email: submittedEmail,
    securityAnswer,
    password: nextPassword,
  });

  if (!updatedUser) {
    return res.status(401).json({
      success: false,
      message: 'Security answer is incorrect or the admin account was not found.',
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Admin password reset successfully. Please login with your new password.',
  });
});

const logout = asyncHandler(async (req, res) => {
  await destroyAdminSession(req, res);

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
});

const getSession = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      username: req.adminSession.username,
      expiresAt: new Date(req.adminSession.expiresAt).toISOString(),
    },
  });
});

const getAuthenticatedAdminUser = (req) => getAdminUserByUsername(req.adminSession?.username);

const getProfile = asyncHandler(async (req, res) => {
  const adminUser = getAuthenticatedAdminUser(req);

  if (!adminUser) {
    return res.status(401).json({
      success: false,
      message: 'Admin session is no longer valid. Please login again.',
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      email: adminUser.username,
      name: adminUser.name || '',
      role: adminUser.role || 'admin',
    },
  });
});

const updateCredentials = asyncHandler(async (req, res) => {
  const {
    currentPassword,
    email,
    newPassword,
    confirmPassword,
    securityQuestion,
    securityAnswer,
  } = req.body || {};
  const nextEmail = String(email || '').trim().toLowerCase();
  const nextPassword = String(newPassword || '');

  const currentAdmin = getAuthenticatedAdminUser(req);
  if (!currentAdmin) {
    return res.status(401).json({
      success: false,
      message: 'Admin session is no longer valid. Please login again.',
    });
  }

  const currentVerification = await verifyAdminCredentials(currentAdmin.username, currentPassword);
  if (!currentVerification.ok) {
    return res.status(401).json({
      success: false,
      message: 'Current admin password is incorrect.',
    });
  }

  if (!nextEmail || !nextPassword) {
    return res.status(400).json({
      success: false,
      message: 'New admin email and password are required.',
    });
  }

  if (!isValidEmail(nextEmail)) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a valid admin email address.',
    });
  }

  if (nextPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 8 characters long.',
    });
  }

  if (nextPassword !== String(confirmPassword || '')) {
    return res.status(400).json({
      success: false,
      message: 'New password and confirm password must match.',
    });
  }

  const updatedCredentials = await updateAdminCredentials({
    currentUsername: currentAdmin.username,
    username: nextEmail,
    password: nextPassword,
    securityQuestion,
    securityAnswer,
  });
  const session = await createAdminSession(req, res, updatedCredentials.user.username);

  return res.status(200).json({
    success: true,
    message: 'Admin login credentials updated successfully.',
    data: {
      email: updatedCredentials.user.username,
      expiresAt: new Date(session.expiresAt).toISOString(),
    },
  });
});

module.exports = {
  approveSignup,
  completePasswordReset,
  getProfile,
  getSession,
  login,
  logout,
  requestPasswordResetQuestion,
  requestSignup,
  updateCredentials,
};
