const crypto = require('crypto');
const { getAdminAuthConfig, getAdminUserByUsername } = require('../config/adminAuth');

const COOKIE_NAME = 'rd_admin_session';
const sessions = new Map();

const parseCookies = (cookieHeader = '') => cookieHeader
  .split(';')
  .map((cookie) => cookie.trim())
  .filter(Boolean)
  .reduce((cookies, cookie) => {
    const separatorIndex = cookie.indexOf('=');
    if (separatorIndex === -1) return cookies;
    const name = decodeURIComponent(cookie.slice(0, separatorIndex).trim());
    const value = decodeURIComponent(cookie.slice(separatorIndex + 1).trim());
    return { ...cookies, [name]: value };
  }, {});

const signSessionId = (sessionId) => crypto
  .createHmac('sha256', getAdminAuthConfig().sessionSecret)
  .update(sessionId)
  .digest('base64url');

const createCookieValue = (sessionId) => `${sessionId}.${signSessionId(sessionId)}`;

const isSecureRequest = (req) => req.secure || req.get('x-forwarded-proto') === 'https';

const buildCookieOptions = (req, sessionId, maxAgeSeconds) => [
  `${COOKIE_NAME}=${maxAgeSeconds > 0 ? createCookieValue(sessionId) : ''}`,
  'HttpOnly',
  'Path=/',
  'SameSite=Lax',
  `Max-Age=${maxAgeSeconds}`,
  ...(isSecureRequest(req) ? ['Secure'] : []),
].join('; ');

const clearExpiredSessions = () => {
  const now = Date.now();
  sessions.forEach((session, sessionId) => {
    if (session.expiresAt <= now) sessions.delete(sessionId);
  });
};

const getSessionFromRequest = (req) => {
  clearExpiredSessions();

  const cookieValue = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!cookieValue) return null;

  const [sessionId, signature] = cookieValue.split('.');
  if (!sessionId || !signature) return null;

  const expectedSignature = signSessionId(sessionId);
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  const session = sessions.get(sessionId);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return null;
  }

  return { ...session, id: sessionId };
};

const attachAdminSession = (req, res, next) => {
  const session = getSessionFromRequest(req);
  if (session) {
    req.adminSession = session;
    req.adminSessionId = session.id;
  }
  next();
};

const createAdminSession = (req, res, username) => {
  clearExpiredSessions();

  const sessionId = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const session = {
    username,
    createdAt: now,
    expiresAt: now + getAdminAuthConfig().sessionDurationMs,
  };

  sessions.set(sessionId, session);
  req.adminSessionId = sessionId;
  res.setHeader('Set-Cookie', buildCookieOptions(req, sessionId, Math.floor(getAdminAuthConfig().sessionDurationMs / 1000)));

  return { ...session, id: sessionId };
};

const destroyAdminSession = (req, res) => {
  if (req.adminSessionId) sessions.delete(req.adminSessionId);
  res.setHeader('Set-Cookie', buildCookieOptions(req, '', 0));
  req.adminSessionId = '';
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

const hashPassword = (password, encodedHash) => {
  const [algorithmName, iterationsText, salt, hash] = encodedHash.split('$');
  const digest = algorithmName?.replace('pbkdf2_', '');
  const iterations = Number(iterationsText);

  if (!digest || !iterations || !salt || !hash) {
    throw new Error('Unsupported admin password hash format.');
  }

  return crypto.pbkdf2Sync(password, salt, iterations, Buffer.from(hash, 'hex').length, digest).toString('hex');
};

const passwordMatchesHash = (submittedPassword, encodedHash) => {
  const expectedHash = encodedHash.split('$').at(-1);
  const submittedHash = hashPassword(submittedPassword, encodedHash);
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const submittedBuffer = Buffer.from(submittedHash, 'hex');

  return expectedBuffer.length === submittedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, submittedBuffer);
};

const verifyAdminCredentials = (username, password) => {
  const submittedPassword = String(password || '');
  const trimmedPassword = submittedPassword.trim();
  const adminUser = getAdminUserByUsername(username);

  if (!adminUser) return false;

  return passwordMatchesHash(submittedPassword, adminUser.passwordHash)
    || (trimmedPassword !== submittedPassword
      && passwordMatchesHash(trimmedPassword, adminUser.passwordHash));
};

module.exports = {
  attachAdminSession,
  createAdminSession,
  destroyAdminSession,
  requireAdminApi,
  requireAdminPage,
  verifyAdminCredentials,
};
