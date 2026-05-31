const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = 5000;

if (!fs.existsSync('assets')) fs.mkdirSync('assets');

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
    else cb(new Error('Sirf images allowed hain'));
  },
});

app.use(express.static('.', { dotfiles: 'ignore' }));

app.post('/upload', upload.array('files', 50), (req, res) => {
  if (!req.files || !req.files.length)
    return res.status(400).json({ success: false, error: 'Koi file nahi mili' });
  const paths = req.files.map(f => `assets/${f.filename}`);
  res.json({ success: true, paths });
});

app.use((err, req, res, next) => {
  res.status(500).json({ success: false, error: err.message });
});

app.listen(PORT, '0.0.0.0', () =>
  console.log(`RD Boutique server running on http://localhost:${PORT}`)
);
