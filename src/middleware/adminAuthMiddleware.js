const bcrypt = require('../utils/bcrypt');
const {
  getAdminAuthConfig,
  getAdminUserByUsername,
  replaceAdminUser,
  hashPassword,
} = require('../config/adminAuth');

const getSessionExpiryTime = (session) => {
  const expires = session?.cookie?.expires;
  if (expires instanceof Date) return expires.getTime();
  const parsed = Number(expires);
  return Number.isFinite(parsed) ? parsed : Date.now() + getAdminAuthConfig().sessionDurationMs;
};

const attachAdminSession = (req, res, next) => {
  const username = req.session?.admin?.username;
  if (username && getAdminUserByUsername(username)) {
    req.adminSession = {
      username,
      createdAt: req.session.admin.createdAt,
      expiresAt: getSessionExpiryTime(req.session),
    };
    req.adminSessionId = req.sessionID;
  } else if (username) {
    req.session.admin = null;
  }
  next();
};

const saveSession = (req) => new Promise((resolve, reject) => {
  if (!req.session?.save) {
    resolve();
    return;
  }

  req.session.save((error) => {
    if (error) reject(error);
    else resolve();
  });
});

const regenerateSession = (req) => new Promise((resolve, reject) => {
  if (!req.session?.regenerate) {
    resolve();
    return;
  }

  req.session.regenerate((error) => {
    if (error) reject(error);
    else resolve();
  });
});

const createAdminSession = async (req, res, username, rememberMe = false) => {
  await regenerateSession(req);

  const now = Date.now();
  const config = getAdminAuthConfig();
  const maxAge = rememberMe
    ? config.rememberSessionDurationMinutes * 60 * 1000
    : config.sessionDurationMs;
  const expiresAt = now + maxAge;

  req.session.admin = {
    username,
    createdAt: now,
  };
  req.session.cookie.maxAge = maxAge;
  req.session.cookie.originalMaxAge = maxAge;
  req.session.cookie.expires = expiresAt;
  await saveSession(req);

  req.adminSession = {
    username,
    createdAt: now,
    expiresAt,
  };
  req.adminSessionId = req.sessionID;

  return {
    username,
    createdAt: now,
    expiresAt,
    rememberMe,
  };
};

const destroyAdminSession = (req, res) => new Promise((resolve, reject) => {
  req.adminSession = null;
  req.adminSessionId = '';

  if (!req.session?.destroy) {
    resolve();
    return;
  }

  req.session.destroy((error) => {
    if (error) reject(error);
    else resolve();
  });
});

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
