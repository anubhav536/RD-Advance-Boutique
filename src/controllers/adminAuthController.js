const asyncHandler = require('../utils/asyncHandler');
const config = require('../config/env');
const {
  ADMIN_APPROVAL_EMAIL,
  approveAdminSignupWithToken,
  createAdminPasswordResetToken,
  createAdminSignupApprovalToken,
  getAdminAuthConfig,
  getAdminUserByUsername,
  isValidEmail,
  resetAdminPasswordWithToken,
  updateAdminCredentials,
  verifyAdminPasswordResetToken,
} = require('../config/adminAuth');
const { sendAdminSignupApprovalEmail, sendPasswordResetEmail } = require('../services/emailService');
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

const login = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body || {};
  const submittedUsername = username || email;

  if (!verifyAdminCredentials(submittedUsername, password)) {
    return res.status(401).json({
      success: false,
      message: 'Invalid admin credentials.',
    });
  }

  const session = createAdminSession(req, res, String(submittedUsername).trim().toLowerCase());

  return res.status(200).json({
    success: true,
    data: {
      username: session.username,
      expiresAt: new Date(session.expiresAt).toISOString(),
    },
  });
});


const requestSignup = asyncHandler(async (req, res) => {
  const { name, email, password, confirmPassword } = req.body || {};
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
    approval = createAdminSignupApprovalToken({
      email: submittedEmail,
      password: submittedPassword,
      name,
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

const requestPasswordReset = asyncHandler(async (req, res) => {
  const submittedEmail = String(req.body?.email || '').trim().toLowerCase();
  let delivery = null;

  const adminUser = submittedEmail ? getAdminUserByUsername(submittedEmail) : null;

  if (adminUser) {
    const reset = createAdminPasswordResetToken(adminUser.username);
    const resetLink = `${getRequestBaseUrl(req)}/admin-reset-password.html?token=${encodeURIComponent(reset.token)}`;

    delivery = await sendPasswordResetEmail({
      to: adminUser.username,
      resetLink,
      expiresInMinutes: reset.expiresInMinutes,
    });
  }

  return res.status(200).json({
    success: true,
    message: 'If the email matches the admin account, a password reset link has been sent.',
    ...(delivery?.previewLink && config.env !== 'production'
      ? { data: { previewLink: delivery.previewLink } }
      : {}),
  });
});

const validatePasswordResetToken = asyncHandler(async (req, res) => {
  const token = String(req.query?.token || '').trim();

  return res.status(200).json({
    success: true,
    data: {
      valid: verifyAdminPasswordResetToken(token),
    },
  });
});

const completePasswordReset = asyncHandler(async (req, res) => {
  const {
    token,
    newPassword,
    confirmPassword,
  } = req.body || {};
  const nextPassword = String(newPassword || '');

  if (!String(token || '').trim()) {
    return res.status(400).json({
      success: false,
      message: 'Password reset token is required.',
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

  const updatedConfig = resetAdminPasswordWithToken({
    token,
    password: nextPassword,
  });

  if (!updatedConfig) {
    return res.status(400).json({
      success: false,
      message: 'Password reset link is invalid or expired.',
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Admin password reset successfully. Please login with your new password.',
  });
});

const logout = asyncHandler(async (req, res) => {
  destroyAdminSession(req, res);

  res.status(200).json({
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
  } = req.body || {};
  const nextEmail = String(email || '').trim().toLowerCase();
  const nextPassword = String(newPassword || '');

  if (!verifyAdminCredentials(getAdminAuthConfig().username, currentPassword)) {
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

  const updatedConfig = updateAdminCredentials({
    username: nextEmail,
    password: nextPassword,
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
  requestPasswordReset,
  requestSignup,
  updateCredentials,
  validatePasswordResetToken,
};
