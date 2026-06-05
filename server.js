const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: '10mb' }));

if (!fs.existsSync('assets')) fs.mkdirSync('assets');

// ─── SERVER-SIDE CACHE (30 s TTL) ────────────────────────────────────────────
const _cache = {};
function cacheGet(key) {
  const entry = _cache[key];
  if (!entry) return null;
  if (Date.now() - entry.at > 30_000) { delete _cache[key]; return null; }
  return entry.data;
}
function cacheSet(key, data) { _cache[key] = { data, at: Date.now() }; }
function cacheInvalidate(key) { delete _cache[key]; }

// ─── CONFIG HELPERS ───────────────────────────────────────────────────────────
function readConfig() {
  try { return JSON.parse(fs.readFileSync('data/config.json', 'utf8')); }
  catch { return {}; }
}
function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return null; }
}

function gasUrl() {
  const u = readConfig().appsScriptUrl || '';
  return (!u || u.includes('PASTE_') || u.includes('YOUR_')) ? null : u;
}

// ─── MULTER (IMAGE UPLOADS) ───────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'assets/'),
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '');
    const name = base || ('img_' + Date.now());
    cb(null, name + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// ─── STATIC FILES ─────────────────────────────────────────────────────────────
// Serve everything EXCEPT data/config.json (blocked below)
app.use(express.static('.', { dotfiles: 'ignore' }));
app.use('/data/config.json', (req, res) => res.status(403).json({ error: 'Forbidden' }));

// ─── PUBLIC CONFIG (no PIN) ───────────────────────────────────────────────────
app.get('/api/config/public', (req, res) => {
  const cfg = readConfig();
  const { managerPin, ...publicCfg } = cfg;
  res.json(publicCfg);
});

// ─── ADMIN PIN VERIFY ─────────────────────────────────────────────────────────
app.post('/api/admin/verify-pin', (req, res) => {
  const { pin } = req.body;
  const cfg     = readConfig();
  if (pin === String(cfg.managerPin || '1234')) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: 'Incorrect PIN' });
  }
});

// ─── ADMIN CONFIG SAVE ────────────────────────────────────────────────────────
// Saves appsScriptUrl, cloudinary settings, etc. to data/config.json
app.post('/api/admin/save-config', (req, res) => {
  const { pin, ...updates } = req.body;
  const cfg = readConfig();
  if (pin !== String(cfg.managerPin || '1234')) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  // Handle PIN change (newPin field updates managerPin)
  if (updates.newPin && String(updates.newPin).trim()) {
    cfg.managerPin = String(updates.newPin).trim();
  }
  const allowed = [
    'appsScriptUrl', 'storeName', 'ownerPhone',
    'upiId', 'upiName', 'upiPhone',
    'cloudinaryCloudName', 'cloudinaryUploadPreset',
  ];
  allowed.forEach(k => { if (updates[k] !== undefined) cfg[k] = updates[k]; });
  try {
    fs.writeFileSync('data/config.json', JSON.stringify(cfg, null, 2));
    cacheInvalidate('products');
    cacheInvalidate('categories');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── PRODUCTS PROXY ───────────────────────────────────────────────────────────
// Tries GAS first, falls back to data/products.json
app.get('/api/products', async (req, res) => {
  const cached = cacheGet('products');
  if (cached) return res.json(cached);

  const url = gasUrl();
  if (url) {
    try {
      const r    = await fetch(`${url}?action=getProducts`, { signal: AbortSignal.timeout(8000) });
      const data = await r.json();
      if (data.ok && Array.isArray(data.products) && data.products.length > 0) {
        cacheSet('products', data.products);
        return res.json(data.products);
      }
    } catch (e) {
      console.warn('[/api/products] GAS fetch failed, falling back to JSON:', e.message);
    }
  }

  const local = readJson('data/products.json') || [];
  cacheSet('products', local);
  res.json(local);
});

// ─── CATEGORIES PROXY ─────────────────────────────────────────────────────────
// Tries GAS first, falls back to data/categories.json
app.get('/api/categories', async (req, res) => {
  const cached = cacheGet('categories');
  if (cached) return res.json(cached);

  const url = gasUrl();
  if (url) {
    try {
      const r    = await fetch(`${url}?action=getCategories`, { signal: AbortSignal.timeout(8000) });
      const data = await r.json();
      if (data.ok && Array.isArray(data.categories) && data.categories.length > 0) {
        cacheSet('categories', data.categories);
        return res.json(data.categories);
      }
    } catch (e) {
      console.warn('[/api/categories] GAS fetch failed, falling back to JSON:', e.message);
    }
  }

  const local = readJson('data/categories.json') || [];
  cacheSet('categories', local);
  res.json(local);
});

// ─── CACHE BUST (called after admin saves a product/category) ─────────────────
app.post('/api/admin/cache-bust', (req, res) => {
  const { pin } = req.body;
  const cfg = readConfig();
  if (pin !== String(cfg.managerPin || '1234')) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  cacheInvalidate('products');
  cacheInvalidate('categories');
  res.json({ ok: true });
});

// ─── IMAGE UPLOAD ─────────────────────────────────────────────────────────────
app.post('/upload', upload.array('files', 50), (req, res) => {
  if (!req.files || !req.files.length)
    return res.status(400).json({ success: false, error: 'No file received' });
  const paths = req.files.map(f => `assets/${f.filename}`);
  res.json({ success: true, paths });
});

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  res.status(500).json({ success: false, error: err.message });
});

app.listen(PORT, '0.0.0.0', () =>
  console.log(`RD Boutique server running on http://localhost:${PORT}`)
);
