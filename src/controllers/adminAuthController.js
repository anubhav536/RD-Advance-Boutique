const asyncHandler = require('../utils/asyncHandler');
const { getAdminAuthConfig, updateAdminCredentials } = require('../config/adminAuth');
const {
  createAdminSession,
  destroyAdminSession,
  verifyAdminCredentials,
} = require('../middleware/adminAuthMiddleware');

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
  getProfile,
  getSession,
  login,
  logout,
  updateCredentials,
};
