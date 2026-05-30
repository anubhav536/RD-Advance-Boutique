const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('../utils/bcrypt');

const CONFIG_PATH = path.resolve(__dirname, '../../config/admin-auth.json');
const USERS_PATH = path.resolve(__dirname, '../../data/users.json');
const DEFAULT_SESSION_MINUTES = 120;
const REMEMBER_SESSION_MINUTES = 30 * 24 * 60;
const DEFAULT_SIGNUP_APPROVAL_MINUTES = 7 * 24 * 60;
const ADMIN_APPROVAL_EMAIL = 'rdadvanceboutique@gmail.com';
const DEFAULT_SECURITY_QUESTION = 'What is the registered admin email address?';
const FALLBACK_PASSWORD_HASH = 'uninitialized-admin-password-hash';
const BCRYPT_SALT_ROUNDS = 12;

let cachedConfig = null;
let cachedConfigMtimeMs = 0;
let cachedUsers = null;
let cachedUsersMtimeMs = 0;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));

const backupMalformedJsonFile = (filePath, raw, error) => {
  const backupPath = `${filePath}.corrupt-${Date.now()}.bak`;
  try {
    fs.writeFileSync(backupPath, raw || '', 'utf8');
  } catch (backupError) {
    console.error('Unable to write malformed admin JSON backup.', {
      filePath,
      backupPath,
      error: backupError.message,
    });
  }
  console.error('Recovered malformed admin JSON storage file.', {
    filePath,
    backupPath,
    error: error.message,
  });
};

const readJsonFile = (filePath, fallback = null) => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    try {
      return JSON.parse(raw);
    } catch (parseError) {
      if (fallback !== null) {
        backupMalformedJsonFile(filePath, raw, parseError);
        writeJsonFile(filePath, fallback);
        return fallback;
      }
      throw parseError;
    }
  } catch (error) {
    if (error.code === 'ENOENT' && fallback !== null) return fallback;
    if (fallback !== null) {
      console.error('Unable to read admin JSON storage file; using fallback.', {
        filePath,
        error: error.message,
      });
      return fallback;
    }
    throw error;
  }
};

const writeJsonFile = (filePath, data) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, filePath);
};

const createDefaultConfigFile = () => {
  const defaultConfig = {
    username: normalizeEmail(process.env.ADMIN_USERNAME || ADMIN_APPROVAL_EMAIL),
    passwordHash: String(process.env.ADMIN_PASSWORD_HASH || FALLBACK_PASSWORD_HASH),
    sessionSecret: crypto.randomBytes(64).toString('hex'),
    sessionDurationMinutes: DEFAULT_SESSION_MINUTES,
    rememberSessionDurationMinutes: REMEMBER_SESSION_MINUTES,
    securityQuestion: DEFAULT_SECURITY_QUESTION,
    securityAnswerHash: '',
    pendingSignups: [],
  };

  writeJsonFile(CONFIG_PATH, defaultConfig);
  console.info('Admin authentication JSON storage file was missing and has been created.', {
    path: CONFIG_PATH,
    username: defaultConfig.username,
  });

  return defaultConfig;
};

const ensureConfigFile = () => {
  if (!fs.existsSync(CONFIG_PATH)) return createDefaultConfigFile();
  return null;
};

const buildRecoverableConfig = (parsedConfig = {}) => ({
  username: normalizeEmail(parsedConfig.username || process.env.ADMIN_USERNAME || ADMIN_APPROVAL_EMAIL),
  passwordHash: String(parsedConfig.passwordHash || process.env.ADMIN_PASSWORD_HASH || FALLBACK_PASSWORD_HASH),
  sessionSecret: String(parsedConfig.sessionSecret || crypto.randomBytes(64).toString('hex')),
  sessionDurationMinutes: Number(parsedConfig.sessionDurationMinutes || DEFAULT_SESSION_MINUTES),
  rememberSessionDurationMinutes: Number(parsedConfig.rememberSessionDurationMinutes || REMEMBER_SESSION_MINUTES),
  securityQuestion: String(parsedConfig.securityQuestion || DEFAULT_SECURITY_QUESTION),
  securityAnswerHash: String(parsedConfig.securityAnswerHash || ''),
  pendingSignups: Array.isArray(parsedConfig.pendingSignups) ? parsedConfig.pendingSignups : [],
});

const readConfigFile = () => {
  const createdConfig = ensureConfigFile();
  return createdConfig || readJsonFile(CONFIG_PATH, buildRecoverableConfig());
};

const normalizeAdminUser = (user) => {
  const username = normalizeEmail(user?.username || user?.email);
  const passwordHash = String(user?.passwordHash || '').trim();
  if (!username || !passwordHash) return null;

  return {
    username,
    email: username,
    passwordHash,
    role: String(user?.role || 'admin').trim() || 'admin',
    name: String(user?.name || '').trim(),
    securityQuestion: String(user?.securityQuestion || DEFAULT_SECURITY_QUESTION).trim(),
    securityAnswerHash: String(user?.securityAnswerHash || '').trim(),
    approvedAt: Number(user?.approvedAt || Date.now()),
    createdAt: Number(user?.createdAt || user?.approvedAt || Date.now()),
    updatedAt: Number(user?.updatedAt || user?.approvedAt || Date.now()),
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
    securityQuestion: String(request?.securityQuestion || DEFAULT_SECURITY_QUESTION).trim(),
    securityAnswerHash: String(request?.securityAnswerHash || '').trim(),
    requestedAt: Number(request?.requestedAt || request?.createdAt || now),
  };
};

const getLegacyUsersFromConfig = (parsedConfig, now = Date.now()) => uniqueUsers([
  normalizeAdminUser({
    username: parsedConfig.username,
    passwordHash: parsedConfig.passwordHash,
    role: 'owner',
    securityQuestion: parsedConfig.securityQuestion || DEFAULT_SECURITY_QUESTION,
    securityAnswerHash: parsedConfig.securityAnswerHash || '',
    approvedAt: Number(parsedConfig.primaryApprovedAt || parsedConfig.createdAt || now),
    createdAt: Number(parsedConfig.createdAt || parsedConfig.primaryApprovedAt || now),
  }),
  ...(Array.isArray(parsedConfig.users) ? parsedConfig.users.map(normalizeAdminUser) : []),
]);

const normalizeConfig = (parsedConfig) => {
  const recoveredConfig = buildRecoverableConfig(parsedConfig);
  const username = normalizeEmail(recoveredConfig.username);
  const passwordHash = String(recoveredConfig.passwordHash || '').trim();
  const sessionSecret = String(recoveredConfig.sessionSecret || '').trim();
  const sessionDurationMinutes = Number(recoveredConfig.sessionDurationMinutes || DEFAULT_SESSION_MINUTES);
  const now = Date.now();

  if (!username || !passwordHash || !sessionSecret) {
    throw new Error('Admin authentication config must include username, passwordHash, and sessionSecret.');
  }

  if (sessionSecret.length < 32) {
    throw new Error('Admin authentication sessionSecret must be at least 32 characters long.');
  }

  const pendingSignups = Array.isArray(recoveredConfig.pendingSignups)
    ? recoveredConfig.pendingSignups.map((request) => normalizePendingSignup(request, now)).filter(Boolean)
    : [];

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
    rememberSessionDurationMinutes: Number(recoveredConfig.rememberSessionDurationMinutes || REMEMBER_SESSION_MINUTES),
    pendingSignups,
  };
};

const getAdminAuthConfig = () => {
  ensureConfigFile();
  const stats = fs.statSync(CONFIG_PATH);

  if (!cachedConfig || stats.mtimeMs !== cachedConfigMtimeMs) {
    cachedConfig = normalizeConfig(readConfigFile());
    cachedConfigMtimeMs = stats.mtimeMs;
  }

  return cachedConfig;
};

const serializeConfig = (config, users = getAdminUsers()) => {
  const primaryUser = users.find((user) => user.username === config.username) || users[0];

  return {
    username: primaryUser?.username || config.username,
    passwordHash: primaryUser?.passwordHash || config.passwordHash,
    sessionSecret: config.sessionSecret,
    sessionDurationMinutes: config.sessionDurationMinutes,
    rememberSessionDurationMinutes: config.rememberSessionDurationMinutes,
    securityQuestion: primaryUser?.securityQuestion || DEFAULT_SECURITY_QUESTION,
    securityAnswerHash: primaryUser?.securityAnswerHash || '',
    pendingSignups: config.pendingSignups || [],
  };
};

const writeConfigFile = (nextConfig, users) => {
  writeJsonFile(CONFIG_PATH, serializeConfig(nextConfig, users));
  cachedConfig = null;
  cachedConfigMtimeMs = 0;
};

const readUsersFromDisk = () => {
  const users = readJsonFile(USERS_PATH, []);
  return Array.isArray(users) ? users : [];
};

const ensureUsersFile = () => {
  const config = getAdminAuthConfig();
  if (fs.existsSync(USERS_PATH)) return;

  const legacyUsers = getLegacyUsersFromConfig(readConfigFile()).map((user) => ({
    ...user,
    securityQuestion: user.securityQuestion || DEFAULT_SECURITY_QUESTION,
    securityAnswerHash: user.securityAnswerHash || '',
  }));

  console.info('Admin users JSON storage file was missing and has been created.', {
    path: USERS_PATH,
    seededFromConfig: Boolean(legacyUsers.length),
  });

  writeJsonFile(USERS_PATH, legacyUsers.length ? legacyUsers : [{
    username: config.username,
    email: config.username,
    passwordHash: config.passwordHash,
    role: 'owner',
    name: 'Primary Admin',
    securityQuestion: DEFAULT_SECURITY_QUESTION,
    securityAnswerHash: '',
    approvedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }]);
};

const getAdminUsers = () => {
  ensureUsersFile();
  const stats = fs.statSync(USERS_PATH);

  if (!cachedUsers || stats.mtimeMs !== cachedUsersMtimeMs) {
    const loadedUsers = uniqueUsers(readUsersFromDisk().map(normalizeAdminUser));
    const config = getAdminAuthConfig();
    const fallbackUser = normalizeAdminUser({
      username: config.username,
      passwordHash: config.passwordHash,
      role: 'owner',
      name: 'Primary Admin',
      securityQuestion: DEFAULT_SECURITY_QUESTION,
      securityAnswerHash: '',
      approvedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    cachedUsers = loadedUsers.length ? loadedUsers : [fallbackUser];
    if (!loadedUsers.length) writeJsonFile(USERS_PATH, cachedUsers);
    cachedUsersMtimeMs = stats.mtimeMs;
  }

  return cachedUsers;
};

const writeAdminUsers = (users) => {
  const normalizedUsers = uniqueUsers(users.map(normalizeAdminUser));
  writeJsonFile(USERS_PATH, normalizedUsers);
  cachedUsers = null;
  cachedUsersMtimeMs = 0;
  writeConfigFile(getAdminAuthConfig(), normalizedUsers);
  return getAdminUsers();
};

const hashPassword = async (password) => bcrypt.hash(String(password || ''), BCRYPT_SALT_ROUNDS);

const hashSecurityAnswer = async (answer) => hashPassword(String(answer || '').trim().toLowerCase());

const getAdminUserByUsername = (username) => {
  const submittedUsername = normalizeEmail(username);
  if (!submittedUsername) return null;

  return getAdminUsers().find((user) => user.username === submittedUsername) || null;
};

const getPrimaryAdminUser = () => getAdminUserByUsername(getAdminAuthConfig().username) || getAdminUsers()[0] || null;

const adminSignupExists = (username) => {
  const submittedUsername = normalizeEmail(username);
  const currentConfig = getAdminAuthConfig();
  return getAdminUsers().some((user) => user.username === submittedUsername)
    || currentConfig.pendingSignups.some((request) => request.username === submittedUsername);
};

const updateAdminCredentials = async ({ currentUsername, username, password, securityQuestion, securityAnswer }) => {
  const currentConfig = getAdminAuthConfig();
  const currentUser = getAdminUserByUsername(currentUsername || currentConfig.username) || getPrimaryAdminUser();
  const nextUsername = normalizeEmail(username);

  if (!currentUser) {
    throw new Error('Admin account was not found.');
  }

  if (!nextUsername || !String(password || '').trim()) {
    throw new Error('Admin email and password are required.');
  }

  const nextPasswordHash = await hashPassword(password);
  const nextSecurityQuestion = String(securityQuestion || currentUser.securityQuestion || DEFAULT_SECURITY_QUESTION).trim();
  const nextSecurityAnswerHash = String(securityAnswer || '').trim()
    ? await hashSecurityAnswer(securityAnswer)
    : currentUser.securityAnswerHash || '';
  const updatedAt = Date.now();
  const updatedUser = {
    ...currentUser,
    username: nextUsername,
    email: nextUsername,
    passwordHash: nextPasswordHash,
    role: currentUser.role || 'admin',
    securityQuestion: nextSecurityQuestion,
    securityAnswerHash: nextSecurityAnswerHash,
    approvedAt: currentUser.approvedAt || updatedAt,
    createdAt: currentUser.createdAt || updatedAt,
    updatedAt,
  };
  const users = uniqueUsers([
    updatedUser,
    ...getAdminUsers().filter((user) => (
      user.username !== currentUser.username && user.username !== nextUsername
    )),
  ]);
  const updatesPrimaryAdmin = currentUser.username === currentConfig.username;

  writeAdminUsers(users);
  writeConfigFile({
    ...currentConfig,
    username: updatesPrimaryAdmin ? nextUsername : currentConfig.username,
    passwordHash: updatesPrimaryAdmin ? nextPasswordHash : currentConfig.passwordHash,
    pendingSignups: updatesPrimaryAdmin ? [] : currentConfig.pendingSignups,
  }, users);

  return {
    config: getAdminAuthConfig(),
    user: getAdminUserByUsername(nextUsername),
  };
};

const createTokenHash = (token, sessionSecret = getAdminAuthConfig().sessionSecret) => crypto
  .createHmac('sha256', sessionSecret)
  .update(String(token || ''))
  .digest('hex');

const findByToken = (requests, token, currentConfig = getAdminAuthConfig()) => {
  const tokenHash = createTokenHash(token, currentConfig.sessionSecret);
  return requests.find((request) => {
    const expected = Buffer.from(String(request.tokenHash || ''));
    const submitted = Buffer.from(tokenHash);
    return expected.length === submitted.length && crypto.timingSafeEqual(expected, submitted);
  });
};

const writePendingSignups = (pendingSignups) => {
  const currentConfig = getAdminAuthConfig();
  writeConfigFile({
    ...currentConfig,
    pendingSignups,
  });
  return getAdminAuthConfig();
};

const createAdminSignupApprovalToken = async ({ email, password, name, securityQuestion, securityAnswer }, minutes = DEFAULT_SIGNUP_APPROVAL_MINUTES) => {
  const currentConfig = getAdminAuthConfig();
  const username = normalizeEmail(email);

  if (!isValidEmail(username)) {
    throw new Error('A valid admin email address is required.');
  }

  if (String(password || '').length < 8) {
    throw new Error('Admin password must be at least 8 characters long.');
  }

  if (!String(securityQuestion || '').trim() || !String(securityAnswer || '').trim()) {
    throw new Error('Security question and answer are required.');
  }

  if (adminSignupExists(username)) {
    throw new Error('This admin email is already registered or waiting for approval.');
  }

  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const expiresAt = now + minutes * 60 * 1000;

  const pendingSignup = {
    username,
    name: String(name || '').trim(),
    passwordHash: await hashPassword(password),
    securityQuestion: String(securityQuestion || '').trim(),
    securityAnswerHash: await hashSecurityAnswer(securityAnswer),
    tokenHash: createTokenHash(token, currentConfig.sessionSecret),
    requestedAt: now,
    createdAt: now,
    expiresAt,
  };

  const updatedConfig = writePendingSignups([
    ...currentConfig.pendingSignups,
    pendingSignup,
  ]);
  const savedSignup = updatedConfig.pendingSignups.find((request) => request.username === username);

  if (!savedSignup) {
    throw new Error('Approval request could not be verified after saving to JSON storage.');
  }

  return {
    token,
    username,
    expiresAt,
    expiresInMinutes: minutes,
    saved: true,
    pendingCount: updatedConfig.pendingSignups.length,
  };
};

const approveAdminSignupWithToken = (token) => {
  const currentConfig = getAdminAuthConfig();
  const pendingSignup = findByToken(currentConfig.pendingSignups, token, currentConfig);

  if (!pendingSignup || pendingSignup.expiresAt <= Date.now()) return null;

  const approvedAt = Date.now();
  const users = uniqueUsers([
    ...getAdminUsers(),
    {
      username: pendingSignup.username,
      email: pendingSignup.username,
      passwordHash: pendingSignup.passwordHash,
      role: 'admin',
      name: pendingSignup.name,
      securityQuestion: pendingSignup.securityQuestion,
      securityAnswerHash: pendingSignup.securityAnswerHash,
      approvedAt,
      createdAt: pendingSignup.requestedAt,
      updatedAt: approvedAt,
    },
  ]);

  writeAdminUsers(users);
  writePendingSignups(currentConfig.pendingSignups.filter((request) => request.tokenHash !== pendingSignup.tokenHash));

  return {
    username: pendingSignup.username,
    approvedAt,
  };
};

const getPasswordResetChallenge = (email) => {
  const user = getAdminUserByUsername(email);
  if (!user) return null;

  return {
    email: user.username,
    securityQuestion: user.securityQuestion || DEFAULT_SECURITY_QUESTION,
    configured: Boolean(user.securityAnswerHash),
  };
};

const verifySecurityAnswer = async (user, answer) => {
  if (!user?.securityAnswerHash) {
    return normalizeEmail(answer) === user?.username;
  }

  return bcrypt.compare(String(answer || '').trim().toLowerCase(), user.securityAnswerHash);
};

const resetAdminPasswordWithSecurityAnswer = async ({ email, securityAnswer, password }) => {
  const user = getAdminUserByUsername(email);
  if (!user) return null;

  const answerMatches = await verifySecurityAnswer(user, securityAnswer);
  if (!answerMatches) return null;

  const nextPasswordHash = await hashPassword(password);
  const users = getAdminUsers().map((entry) => (
    entry.username === user.username
      ? { ...entry, passwordHash: nextPasswordHash, updatedAt: Date.now() }
      : entry
  ));

  writeAdminUsers(users);
  if (user.username === getAdminAuthConfig().username) {
    writeConfigFile({
      ...getAdminAuthConfig(),
      passwordHash: nextPasswordHash,
    }, users);
  }

  return getAdminUserByUsername(user.username);
};

const replaceAdminUser = (updatedUser) => writeAdminUsers(getAdminUsers().map((user) => (
  user.username === updatedUser.username ? updatedUser : user
)));

module.exports = {
  ADMIN_APPROVAL_EMAIL,
  approveAdminSignupWithToken,
  createAdminSignupApprovalToken,
  getAdminAuthConfig,
  getAdminUserByUsername,
  getAdminUsers,
  getPasswordResetChallenge,
  hashPassword,
  isValidEmail,
  normalizeEmail,
  replaceAdminUser,
  resetAdminPasswordWithSecurityAnswer,
  updateAdminCredentials,
  verifySecurityAnswer,
};
