const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CONFIG_PATH = path.resolve(__dirname, '../../config/admin-auth.json');
const DEFAULT_SESSION_MINUTES = 120;
const DEFAULT_RESET_MINUTES = 60;
const DEFAULT_SIGNUP_APPROVAL_MINUTES = 7 * 24 * 60;
const PASSWORD_HASH_ALGORITHM = 'sha256';
const PASSWORD_HASH_ITERATIONS = 310000;
const PASSWORD_HASH_BYTES = 32;
const ADMIN_APPROVAL_EMAIL = 'rdadvanceboutique@gmail.com';

let cachedConfig = null;
let cachedMtimeMs = 0;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));

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

const normalizeAdminUser = (user) => {
  const username = normalizeEmail(user?.username || user?.email);
  const passwordHash = String(user?.passwordHash || '').trim();
  if (!username || !passwordHash) return null;

  return {
    username,
    passwordHash,
    role: String(user?.role || 'admin').trim() || 'admin',
    approvedAt: Number(user?.approvedAt || Date.now()),
    createdAt: Number(user?.createdAt || user?.approvedAt || Date.now()),
  };
};

const uniqueUsers = (users) => {
  const byUsername = new Map();
  users.filter(Boolean).forEach((user) => {
    if (!byUsername.has(user.username)) byUsername.set(user.username, user);
  });
  return Array.from(byUsername.values());
};

const normalizeTokenRequest = (request, now = Date.now()) => {
  const username = normalizeEmail(request?.username || request?.email);
  const tokenHash = String(request?.tokenHash || '').trim();
  const expiresAt = Number(request?.expiresAt || 0);

  if (!username || !tokenHash || expiresAt <= now) return null;

  return {
    username,
    tokenHash,
    expiresAt,
    createdAt: Number(request?.createdAt || now),
  };
};

const normalizePendingSignup = (request, now = Date.now()) => {
  const normalized = normalizeTokenRequest(request, now);
  const passwordHash = String(request?.passwordHash || '').trim();
  if (!normalized || !passwordHash) return null;

  return {
    ...normalized,
    passwordHash,
    name: String(request?.name || '').trim(),
    requestedAt: Number(request?.requestedAt || request?.createdAt || now),
  };
};

const normalizeConfig = (parsedConfig) => {
  const username = normalizeEmail(parsedConfig.username);
  const passwordHash = String(parsedConfig.passwordHash || '').trim();
  const sessionSecret = String(parsedConfig.sessionSecret || '').trim();
  const sessionDurationMinutes = Number(parsedConfig.sessionDurationMinutes || DEFAULT_SESSION_MINUTES);
  const now = Date.now();

  if (!username || !passwordHash || !sessionSecret) {
    throw new Error('Admin authentication config must include username, passwordHash, and sessionSecret.');
  }

  if (sessionSecret.length < 32) {
    throw new Error('Admin authentication sessionSecret must be at least 32 characters long.');
  }

  const legacyUser = normalizeAdminUser({
    username,
    passwordHash,
    role: 'owner',
    approvedAt: Number(parsedConfig.primaryApprovedAt || parsedConfig.createdAt || now),
    createdAt: Number(parsedConfig.createdAt || parsedConfig.primaryApprovedAt || now),
  });

  const users = uniqueUsers([
    legacyUser,
    ...(Array.isArray(parsedConfig.users) ? parsedConfig.users.map(normalizeAdminUser) : []),
  ]);

  const pendingSignups = Array.isArray(parsedConfig.pendingSignups)
    ? parsedConfig.pendingSignups.map((request) => normalizePendingSignup(request, now)).filter(Boolean)
    : [];

  const passwordResets = Array.isArray(parsedConfig.passwordResets)
    ? parsedConfig.passwordResets.map((request) => normalizeTokenRequest(request, now)).filter(Boolean)
    : [];

  const resetExpiresAt = Number(parsedConfig.passwordReset?.expiresAt || 0);
  const passwordReset = parsedConfig.passwordReset?.tokenHash && resetExpiresAt > now
    ? {
      tokenHash: String(parsedConfig.passwordReset.tokenHash),
      expiresAt: resetExpiresAt,
    }
    : null;

  if (passwordReset && !passwordResets.some((request) => request.tokenHash === passwordReset.tokenHash)) {
    passwordResets.push({
      username,
      tokenHash: passwordReset.tokenHash,
      expiresAt: passwordReset.expiresAt,
      createdAt: now,
    });
  }

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
    users,
    pendingSignups,
    passwordResets,
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

const serializeConfig = (config) => {
  const serialized = {
    username: config.username,
    passwordHash: config.passwordHash,
    sessionSecret: config.sessionSecret,
    sessionDurationMinutes: config.sessionDurationMinutes,
  };

  const extraUsers = uniqueUsers(config.users || [])
    .filter((user) => user.username !== config.username);
  if (extraUsers.length) serialized.users = extraUsers;

  if (config.pendingSignups?.length) serialized.pendingSignups = config.pendingSignups;
  if (config.passwordResets?.length) serialized.passwordResets = config.passwordResets;
  if (config.passwordReset) serialized.passwordReset = config.passwordReset;

  return serialized;
};

const writeConfigFile = (config) => {
  const normalizedConfig = normalizeConfig(config);
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(serializeConfig(normalizedConfig), null, 2)}\n`);
  const stats = fs.statSync(CONFIG_PATH);
  cachedConfig = normalizeConfig(readConfigFile());
  cachedMtimeMs = stats.mtimeMs;
};

const createTokenHash = (token, sessionSecret = getAdminAuthConfig().sessionSecret) => crypto
  .createHmac('sha256', sessionSecret)
  .update(String(token || ''))
  .digest('hex');

const findByToken = (requests, token, currentConfig = getAdminAuthConfig()) => {
  const tokenHash = createTokenHash(token, currentConfig.sessionSecret);
  return requests.find((request) => {
    const expectedBuffer = Buffer.from(request.tokenHash, 'hex');
    const submittedBuffer = Buffer.from(tokenHash, 'hex');
    return expectedBuffer.length === submittedBuffer.length
      && crypto.timingSafeEqual(expectedBuffer, submittedBuffer);
  });
};

const writeNormalizedConfig = (overrides = {}) => {
  const currentConfig = getAdminAuthConfig();
  const nextConfig = {
    username: currentConfig.username,
    passwordHash: currentConfig.passwordHash,
    sessionSecret: currentConfig.sessionSecret,
    sessionDurationMinutes: currentConfig.sessionDurationMinutes,
    users: currentConfig.users,
    pendingSignups: currentConfig.pendingSignups,
    passwordResets: currentConfig.passwordResets,
    ...overrides,
  };

  writeConfigFile(nextConfig);
  return getAdminAuthConfig();
};

const getAdminUserByUsername = (username) => {
  const submittedUsername = normalizeEmail(username);
  if (!submittedUsername) return null;

  return getAdminAuthConfig().users.find((user) => user.username === submittedUsername) || null;
};

const adminSignupExists = (username) => {
  const submittedUsername = normalizeEmail(username);
  const currentConfig = getAdminAuthConfig();
  return currentConfig.users.some((user) => user.username === submittedUsername)
    || currentConfig.pendingSignups.some((request) => request.username === submittedUsername);
};

const updateAdminCredentials = ({ username, password }) => {
  const currentConfig = getAdminAuthConfig();
  const nextUsername = normalizeEmail(username);
  const nextPasswordHash = hashPassword(password);

  if (!nextUsername || !String(password || '').trim()) {
    throw new Error('Admin email and password are required.');
  }

  const users = currentConfig.users
    .filter((user) => user.username !== currentConfig.username && user.username !== nextUsername);

  writeConfigFile({
    username: nextUsername,
    passwordHash: nextPasswordHash,
    sessionSecret: currentConfig.sessionSecret,
    sessionDurationMinutes: currentConfig.sessionDurationMinutes,
    users,
    pendingSignups: currentConfig.pendingSignups,
    passwordResets: [],
  });
  return getAdminAuthConfig();
};

const createAdminSignupApprovalToken = ({ email, password, name }, minutes = DEFAULT_SIGNUP_APPROVAL_MINUTES) => {
  const currentConfig = getAdminAuthConfig();
  const username = normalizeEmail(email);

  if (!isValidEmail(username)) {
    throw new Error('A valid admin email address is required.');
  }

  if (String(password || '').length < 8) {
    throw new Error('Admin password must be at least 8 characters long.');
  }

  if (adminSignupExists(username)) {
    throw new Error('This admin email is already registered or waiting for approval.');
  }

  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const expiresAt = now + minutes * 60 * 1000;

  writeNormalizedConfig({
    pendingSignups: [
      ...currentConfig.pendingSignups,
      {
        username,
        name: String(name || '').trim(),
        passwordHash: hashPassword(password),
        tokenHash: createTokenHash(token, currentConfig.sessionSecret),
        requestedAt: now,
        createdAt: now,
        expiresAt,
      },
    ],
  });

  return {
    token,
    username,
    expiresAt,
    expiresInMinutes: minutes,
  };
};

const approveAdminSignupWithToken = (token) => {
  const currentConfig = getAdminAuthConfig();
  const pendingSignup = findByToken(currentConfig.pendingSignups, token, currentConfig);

  if (!pendingSignup || pendingSignup.expiresAt <= Date.now()) return null;

  const approvedAt = Date.now();
  const users = uniqueUsers([
    ...currentConfig.users,
    {
      username: pendingSignup.username,
      passwordHash: pendingSignup.passwordHash,
      role: 'admin',
      approvedAt,
      createdAt: pendingSignup.requestedAt,
    },
  ]);

  writeNormalizedConfig({
    users,
    pendingSignups: currentConfig.pendingSignups.filter((request) => request.tokenHash !== pendingSignup.tokenHash),
  });

  return {
    username: pendingSignup.username,
    approvedAt,
  };
};

const createAdminPasswordResetToken = (username = getAdminAuthConfig().username, minutes = DEFAULT_RESET_MINUTES) => {
  const currentConfig = getAdminAuthConfig();
  const adminUser = getAdminUserByUsername(username);
  if (!adminUser) return null;

  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const expiresAt = now + minutes * 60 * 1000;
  const tokenHash = createTokenHash(token, currentConfig.sessionSecret);

  writeNormalizedConfig({
    passwordResets: [
      ...currentConfig.passwordResets.filter((request) => request.username !== adminUser.username),
      {
        username: adminUser.username,
        tokenHash,
        expiresAt,
        createdAt: now,
      },
    ],
    ...(adminUser.username === currentConfig.username
      ? { passwordReset: { tokenHash, expiresAt } }
      : { passwordReset: currentConfig.passwordReset }),
  });

  return {
    token,
    username: adminUser.username,
    expiresAt,
    expiresInMinutes: minutes,
  };
};

const verifyAdminPasswordResetToken = (token) => {
  const currentConfig = getAdminAuthConfig();
  const reset = findByToken(currentConfig.passwordResets, token, currentConfig);
  return Boolean(reset && reset.expiresAt > Date.now());
};

const resetAdminPasswordWithToken = ({ token, password }) => {
  const currentConfig = getAdminAuthConfig();
  const reset = findByToken(currentConfig.passwordResets, token, currentConfig);

  if (!reset || reset.expiresAt <= Date.now()) {
    return null;
  }

  const nextPasswordHash = hashPassword(password);
  const users = currentConfig.users.map((user) => (
    user.username === reset.username
      ? { ...user, passwordHash: nextPasswordHash }
      : user
  ));
  const nextConfig = {
    users,
    passwordResets: currentConfig.passwordResets.filter((request) => request.tokenHash !== reset.tokenHash),
  };

  if (reset.username === currentConfig.username) {
    nextConfig.passwordHash = nextPasswordHash;
    nextConfig.passwordReset = null;
  }

  writeNormalizedConfig(nextConfig);

  return getAdminAuthConfig();
};

module.exports = {
  ADMIN_APPROVAL_EMAIL,
  approveAdminSignupWithToken,
  createAdminPasswordResetToken,
  createAdminSignupApprovalToken,
  getAdminAuthConfig,
  getAdminUserByUsername,
  hashPassword,
  isValidEmail,
  normalizeEmail,
  resetAdminPasswordWithToken,
  updateAdminCredentials,
  verifyAdminPasswordResetToken,
};
