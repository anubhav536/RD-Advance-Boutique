const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CONFIG_PATH = path.resolve(__dirname, '../../config/admin-auth.json');
const DEFAULT_SESSION_MINUTES = 120;
const DEFAULT_RESET_MINUTES = 60;
const PASSWORD_HASH_ALGORITHM = 'sha256';
const PASSWORD_HASH_ITERATIONS = 310000;
const PASSWORD_HASH_BYTES = 32;

let cachedConfig = null;
let cachedMtimeMs = 0;

const readConfigFile = () => {
  let rawConfig;

  try {
    rawConfig = fs.readFileSync(CONFIG_PATH, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Admin authentication config is missing at ${CONFIG_PATH}.`);
    }
    throw error;
  }

  return JSON.parse(rawConfig);
};

const normalizeConfig = (parsedConfig) => {
  const username = String(parsedConfig.username || '').trim().toLowerCase();
  const passwordHash = String(parsedConfig.passwordHash || '').trim();
  const sessionSecret = String(parsedConfig.sessionSecret || '').trim();
  const sessionDurationMinutes = Number(parsedConfig.sessionDurationMinutes || DEFAULT_SESSION_MINUTES);

  if (!username || !passwordHash || !sessionSecret) {
    throw new Error('Admin authentication config must include username, passwordHash, and sessionSecret.');
  }

  if (sessionSecret.length < 32) {
    throw new Error('Admin authentication sessionSecret must be at least 32 characters long.');
  }

  const resetExpiresAt = Number(parsedConfig.passwordReset?.expiresAt || 0);
  const passwordReset = parsedConfig.passwordReset?.tokenHash && resetExpiresAt > Date.now()
    ? {
      tokenHash: String(parsedConfig.passwordReset.tokenHash),
      expiresAt: resetExpiresAt,
    }
    : null;

  return {
    username,
    passwordHash,
    sessionSecret,
    sessionDurationMinutes: Number.isFinite(sessionDurationMinutes)
      ? sessionDurationMinutes
      : DEFAULT_SESSION_MINUTES,
    sessionDurationMs: Number.isFinite(sessionDurationMinutes)
      ? sessionDurationMinutes * 60 * 1000
      : DEFAULT_SESSION_MINUTES * 60 * 1000,
    passwordReset,
  };
};

const getAdminAuthConfig = () => {
  const stats = fs.statSync(CONFIG_PATH);

  if (!cachedConfig || stats.mtimeMs !== cachedMtimeMs) {
    cachedConfig = normalizeConfig(readConfigFile());
    cachedMtimeMs = stats.mtimeMs;
  }

  return cachedConfig;
};

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const hash = crypto
    .pbkdf2Sync(String(password || ''), salt, PASSWORD_HASH_ITERATIONS, PASSWORD_HASH_BYTES, PASSWORD_HASH_ALGORITHM)
    .toString('hex');

  return `pbkdf2_${PASSWORD_HASH_ALGORITHM}$${PASSWORD_HASH_ITERATIONS}$${salt}$${hash}`;
};

const writeConfigFile = (config) => {
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
  const stats = fs.statSync(CONFIG_PATH);
  cachedConfig = normalizeConfig(config);
  cachedMtimeMs = stats.mtimeMs;
};

const createResetTokenHash = (token, sessionSecret = getAdminAuthConfig().sessionSecret) => crypto
  .createHmac('sha256', sessionSecret)
  .update(String(token || ''))
  .digest('hex');

const writeNormalizedConfig = (overrides = {}) => {
  const currentConfig = getAdminAuthConfig();
  const nextConfig = {
    username: currentConfig.username,
    passwordHash: currentConfig.passwordHash,
    sessionSecret: currentConfig.sessionSecret,
    sessionDurationMinutes: currentConfig.sessionDurationMinutes,
    ...(currentConfig.passwordReset ? { passwordReset: currentConfig.passwordReset } : {}),
    ...overrides,
  };

  if (!nextConfig.passwordReset) delete nextConfig.passwordReset;
  writeConfigFile(nextConfig);
  return getAdminAuthConfig();
};

const updateAdminCredentials = ({ username, password }) => {
  const currentConfig = getAdminAuthConfig();
  const nextConfig = {
    username: String(username || '').trim().toLowerCase(),
    passwordHash: hashPassword(password),
    sessionSecret: currentConfig.sessionSecret,
    sessionDurationMinutes: currentConfig.sessionDurationMinutes,
  };

  if (!nextConfig.username || !String(password || '').trim()) {
    throw new Error('Admin email and password are required.');
  }

  writeConfigFile(nextConfig);
  return getAdminAuthConfig();
};

const createAdminPasswordResetToken = (minutes = DEFAULT_RESET_MINUTES) => {
  const currentConfig = getAdminAuthConfig();
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + minutes * 60 * 1000;

  writeNormalizedConfig({
    passwordReset: {
      tokenHash: createResetTokenHash(token, currentConfig.sessionSecret),
      expiresAt,
    },
  });

  return {
    token,
    expiresAt,
    expiresInMinutes: minutes,
  };
};

const verifyAdminPasswordResetToken = (token) => {
  const currentConfig = getAdminAuthConfig();
  const reset = currentConfig.passwordReset;

  if (!reset || reset.expiresAt <= Date.now()) return false;

  const submittedHash = createResetTokenHash(token, currentConfig.sessionSecret);
  const expectedBuffer = Buffer.from(reset.tokenHash, 'hex');
  const submittedBuffer = Buffer.from(submittedHash, 'hex');

  return expectedBuffer.length === submittedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, submittedBuffer);
};

const resetAdminPasswordWithToken = ({ token, password }) => {
  if (!verifyAdminPasswordResetToken(token)) {
    return null;
  }

  const currentConfig = getAdminAuthConfig();
  writeNormalizedConfig({
    username: currentConfig.username,
    passwordHash: hashPassword(password),
    passwordReset: null,
  });

  return getAdminAuthConfig();
};

module.exports = {
  createAdminPasswordResetToken,
  getAdminAuthConfig,
  hashPassword,
  resetAdminPasswordWithToken,
  updateAdminCredentials,
  verifyAdminPasswordResetToken,
};
