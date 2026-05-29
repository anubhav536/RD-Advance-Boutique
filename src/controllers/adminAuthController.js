const asyncHandler = require('../utils/asyncHandler');
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

module.exports = {
  getSession,
  login,
  logout,
};
