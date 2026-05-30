const crypto = require('crypto');

const ALGORITHM = 'sha256';
const ITERATIONS = 310000;
const KEY_LENGTH = 32;
const PREFIX = '$rdab-bcrypt$';

const normalizeRounds = (rounds) => {
  const parsed = Number(rounds);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
};

const deriveIterations = (rounds) => ITERATIONS + (normalizeRounds(rounds) * 1000);

const hash = async (password, rounds = 12) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const iterations = deriveIterations(rounds);
  const digest = crypto
    .pbkdf2Sync(String(password || ''), salt, iterations, KEY_LENGTH, ALGORITHM)
    .toString('hex');

  return `${PREFIX}${iterations}$${salt}$${digest}`;
};

const compareLocalHash = (password, encodedHash) => {
  const [iterationsText, salt, expectedHash] = String(encodedHash || '').split('$').slice(2);
  const iterations = Number(iterationsText);

  if (!iterations || !salt || !expectedHash) {
    throw new Error('Unsupported bcrypt password hash format.');
  }

  const submittedHash = crypto
    .pbkdf2Sync(String(password || ''), salt, iterations, Buffer.from(expectedHash, 'hex').length, ALGORITHM)
    .toString('hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const submittedBuffer = Buffer.from(submittedHash, 'hex');

  return expectedBuffer.length === submittedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, submittedBuffer);
};

const compareLegacyPbkdf2Hash = (password, encodedHash) => {
  const [algorithmName, iterationsText, salt, expectedHash] = String(encodedHash || '').split('$');
  const digest = algorithmName?.replace('pbkdf2_', '');
  const iterations = Number(iterationsText);

  if (!digest || !iterations || !salt || !expectedHash) {
    throw new Error('Unsupported legacy password hash format.');
  }

  const submittedHash = crypto
    .pbkdf2Sync(String(password || ''), salt, iterations, Buffer.from(expectedHash, 'hex').length, digest)
    .toString('hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const submittedBuffer = Buffer.from(submittedHash, 'hex');

  return expectedBuffer.length === submittedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, submittedBuffer);
};

const compare = async (password, encodedHash) => {
  const hashValue = String(encodedHash || '').trim();

  if (hashValue.startsWith(PREFIX)) {
    return compareLocalHash(password, hashValue);
  }

  if (hashValue.startsWith('pbkdf2_')) {
    return compareLegacyPbkdf2Hash(password, hashValue);
  }

  throw new Error('Unsupported or corrupt password hash.');
};

module.exports = {
  compare,
  hash,
};
