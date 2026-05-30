const bcrypt = require('../utils/bcrypt');
const {
  getAdminAuthConfig,
  getAdminUserByUsername,
  replaceAdminUser,
  hashPassword,
} = require('../config/adminAuth');

const attachAdminSession = (req, res, next) => {
  if (req.session?.admin?.username) {
    req.adminSession = {
      username: req.session.admin.username,
      createdAt: req.session.admin.createdAt,
      expiresAt: req.session.cookie?.expires || Date.now() + getAdminAuthConfig().sessionDurationMs,
    };
    req.adminSessionId = req.sessionID;
  }
  next();
};

const createAdminSession = (req, res, username, rememberMe = false) => {
  const now = Date.now();
  const config = getAdminAuthConfig();
  const maxAge = rememberMe
    ? config.rememberSessionDurationMinutes * 60 * 1000
    : config.sessionDurationMs;

  req.session.admin = {
    username,
    createdAt: now,
  };
  req.session.cookie.maxAge = maxAge;
  req.session.cookie.originalMaxAge = maxAge;
  req.session.cookie.expires = now + maxAge;
  req.session.save();
  req.adminSessionId = req.sessionID;

  return {
    username,
    createdAt: now,
    expiresAt: req.session.cookie.expires,
    rememberMe,
  };
};

const destroyAdminSession = (req, res) => {
  req.adminSessionId = '';
  if (req.session?.destroy) {
    req.session.destroy();
  }
};

const requireAdminApi = (req, res, next) => {
  if (req.adminSession) return next();

  return res.status(401).json({
    success: false,
    message: 'Admin authentication is required.',
  });
};

const requireAdminPage = (req, res, next) => {
  if (req.adminSession) {
    res.setHeader('Cache-Control', 'no-store');
    return next();
  }

  const nextPath = encodeURIComponent(req.originalUrl || '/admin-dashboard.html');
  return res.redirect(302, `/admin-login.html?next=${nextPath}`);
};

const verifyAdminCredentials = async (username, password) => {
  const submittedPassword = String(password || '');
  const trimmedPassword = submittedPassword.trim();
  const adminUser = getAdminUserByUsername(username);

  if (!adminUser) {
    return { ok: false, reason: 'USER_NOT_FOUND' };
  }

  if (!submittedPassword) {
    return { ok: false, reason: 'MISSING_PASSWORD' };
  }

  try {
    const directMatch = await bcrypt.compare(submittedPassword, adminUser.passwordHash);
    const trimmedMatch = trimmedPassword !== submittedPassword
      ? await bcrypt.compare(trimmedPassword, adminUser.passwordHash)
      : false;

    if (!directMatch && !trimmedMatch) {
      return { ok: false, reason: 'WRONG_PASSWORD' };
    }

    if (adminUser.passwordHash.startsWith('pbkdf2_')) {
      replaceAdminUser({
        ...adminUser,
        passwordHash: await hashPassword(trimmedMatch ? trimmedPassword : submittedPassword),
        updatedAt: Date.now(),
      });
    }

    return { ok: true, user: adminUser };
  } catch (error) {
    return { ok: false, reason: 'CORRUPT_HASH', error };
  }
};

module.exports = {
  attachAdminSession,
  createAdminSession,
  destroyAdminSession,
  requireAdminApi,
  requireAdminPage,
  verifyAdminCredentials,
};
