const dotenv = require('dotenv');

// Load environment variables before any configuration is read.
dotenv.config();

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toPath = (value, fallback) => {
  const path = String(value || fallback).trim();
  if (!path || /[?#\s]/.test(path)) return fallback;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const trimmedPath = normalizedPath.length > 1 ? normalizedPath.replace(/\/+$/, '') : normalizedPath;
  return trimmedPath === '/' ? fallback : trimmedPath;
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: toNumber(process.env.PORT, 5000),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  adminShortcutPath: toPath(process.env.ADMIN_SHORTCUT_PATH, '/rd-secret-admin'),
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
  rateLimit: {
    windowMs: toNumber(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: toNumber(process.env.RATE_LIMIT_MAX, 100),
  },
};

module.exports = config;
