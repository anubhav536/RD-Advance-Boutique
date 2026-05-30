const crypto = require('crypto');
const { getAdminAuthConfig } = require('../config/adminAuth');

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

const isSecureRequest = (req) => req.secure || req.get('x-forwarded-proto') === 'https';

const signSessionId = (sessionId) => crypto
  .createHmac('sha256', getAdminAuthConfig().sessionSecret)
  .update(sessionId)
  .digest('base64url');

const createCookieValue = (sessionId) => `${sessionId}.${signSessionId(sessionId)}`;

const buildCookie = (req, sessionId, maxAgeMs) => [
  `${COOKIE_NAME}=${maxAgeMs > 0 ? createCookieValue(sessionId) : ''}`,
  'HttpOnly',
  'Path=/',
  'SameSite=Lax',
  `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ...(isSecureRequest(req) ? ['Secure'] : []),
].join('; ');

const clearExpiredSessions = () => {
  const now = Date.now();
  sessions.forEach((session, sessionId) => {
    if (session.cookie?.expires && session.cookie.expires <= now) sessions.delete(sessionId);
  });
};

const getSessionIdFromRequest = (req) => {
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

  return sessionId;
};

const createEmptySession = (maxAgeMs) => ({
  cookie: {
    originalMaxAge: maxAgeMs,
    maxAge: maxAgeMs,
    expires: Date.now() + maxAgeMs,
  },
});

const sessionMiddleware = (req, res, next) => {
  clearExpiredSessions();

  const config = getAdminAuthConfig();
  const defaultMaxAgeMs = config.sessionDurationMs;
  let sessionId = getSessionIdFromRequest(req);
  let session = sessionId ? sessions.get(sessionId) : null;

  if (!session || session.cookie?.expires <= Date.now()) {
    sessionId = crypto.randomBytes(32).toString('base64url');
    session = createEmptySession(defaultMaxAgeMs);
    sessions.set(sessionId, session);
  }

  const persistSession = () => {
    if (!session) return;
    session.cookie.expires = Date.now() + (session.cookie.maxAge || defaultMaxAgeMs);
    sessions.set(sessionId, session);
  };

  const bindSession = () => {
    req.sessionID = sessionId;
    req.session = session;
    req.session.regenerate = (callback) => {
      sessions.delete(sessionId);
      sessionId = crypto.randomBytes(32).toString('base64url');
      session = createEmptySession(defaultMaxAgeMs);
      sessions.set(sessionId, session);
      bindSession();
      callback?.();
    };
    req.session.destroy = (callback) => {
      sessions.delete(sessionId);
      session = null;
      req.session = null;
      res.setHeader('Set-Cookie', buildCookie(req, '', 0));
      callback?.();
    };
    req.session.save = (callback) => {
      if (session) {
        persistSession();
        res.setHeader('Set-Cookie', buildCookie(req, sessionId, session.cookie.maxAge || defaultMaxAgeMs));
      }
      callback?.();
    };
  };

  bindSession();

  res.on('finish', () => {
    if (!session) return;
    persistSession();
  });

  next();
};

module.exports = sessionMiddleware;
