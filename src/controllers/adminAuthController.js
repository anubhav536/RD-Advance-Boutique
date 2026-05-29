const asyncHandler = require('../utils/asyncHandler');
const config = require('../config/env');
const {
  createAdminPasswordResetToken,
  getAdminAuthConfig,
  resetAdminPasswordWithToken,
  updateAdminCredentials,
  verifyAdminPasswordResetToken,
} = require('../config/adminAuth');
const { sendPasswordResetEmail } = require('../services/emailService');
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


const requestPasswordReset = asyncHandler(async (req, res) => {
  const submittedEmail = String(req.body?.email || '').trim().toLowerCase();
  const adminConfig = getAdminAuthConfig();
  let delivery = null;

  if (submittedEmail && submittedEmail === adminConfig.username) {
    const reset = createAdminPasswordResetToken();
    const resetLink = `${getRequestBaseUrl(req)}/admin-reset-password.html?token=${encodeURIComponent(reset.token)}`;

    delivery = await sendPasswordResetEmail({
      to: adminConfig.username,
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
  completePasswordReset,
  getProfile,
  getSession,
  login,
  logout,
  requestPasswordReset,
  updateCredentials,
  validatePasswordResetToken,
};
