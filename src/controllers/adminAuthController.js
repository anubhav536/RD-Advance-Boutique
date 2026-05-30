const asyncHandler = require('../utils/asyncHandler');
const config = require('../config/env');
const {
  ADMIN_APPROVAL_EMAIL,
  approveAdminSignupWithToken,
  createAdminSignupApprovalToken,
  getAdminAuthConfig,
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

  const session = createAdminSession(req, res, verification.user.username, Boolean(rememberMe));

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
  const submittedEmail = String(email || '').trim().toLowerCase();
  const submittedPassword = String(password || '');

  if (!isValidEmail(submittedEmail)) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a valid admin email address.',
    });
  }

  if (submittedPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters long.',
    });
  }

  if (submittedPassword !== String(confirmPassword || '')) {
    return res.status(400).json({
      success: false,
      message: 'Password and confirm password must match.',
    });
  }

  let approval;
  try {
    approval = await createAdminSignupApprovalToken({
      email: submittedEmail,
      password: submittedPassword,
      name,
      securityQuestion,
      securityAnswer,
    });
  } catch (error) {
    return res.status(409).json({
      success: false,
      message: error.message || 'Unable to create admin signup request.',
    });
  }

  const approvalLink = `${getRequestBaseUrl(req)}/api/v1/admin/auth/signup/approve?token=${encodeURIComponent(approval.token)}`;
  const delivery = await sendAdminSignupApprovalEmail({
    to: ADMIN_APPROVAL_EMAIL,
    signupEmail: approval.username,
    approvalLink,
    expiresInMinutes: approval.expiresInMinutes,
  });

  return res.status(201).json({
    success: true,
    message: `Signup request sent for approval. ${ADMIN_APPROVAL_EMAIL} must approve it before you can login.`,
    ...(delivery?.previewLink && config.env !== 'production'
      ? { data: { previewLink: delivery.previewLink } }
      : {}),
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
  destroyAdminSession(req, res);

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

const getProfile = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      email: getAdminAuthConfig().username,
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

  const currentVerification = await verifyAdminCredentials(getAdminAuthConfig().username, currentPassword);
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

  const updatedConfig = await updateAdminCredentials({
    username: nextEmail,
    password: nextPassword,
    securityQuestion,
    securityAnswer,
  });
  const session = createAdminSession(req, res, updatedConfig.username);

  return res.status(200).json({
    success: true,
    message: 'Admin login credentials updated successfully.',
    data: {
      email: updatedConfig.username,
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
