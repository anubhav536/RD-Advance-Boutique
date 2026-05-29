const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.resolve(__dirname, '../../config/admin-auth.json');
const DEFAULT_SESSION_MINUTES = 120;

const readAdminAuthConfig = () => {
  let rawConfig;

  try {
    rawConfig = fs.readFileSync(CONFIG_PATH, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Admin authentication config is missing at ${CONFIG_PATH}.`);
    }
    throw error;
  }

  const parsedConfig = JSON.parse(rawConfig);
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

  return {
    username,
    passwordHash,
    sessionSecret,
    sessionDurationMs: Number.isFinite(sessionDurationMinutes)
      ? sessionDurationMinutes * 60 * 1000
      : DEFAULT_SESSION_MINUTES * 60 * 1000,
  };
};

module.exports = readAdminAuthConfig();
