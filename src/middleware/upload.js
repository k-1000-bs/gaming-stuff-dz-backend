const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const sharp = require('sharp');
const AppError = require('../utils/AppError');
const { env } = require('../config/env');

const UPLOAD_ROOT = path.resolve(env.UPLOAD_DIR);
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const storage = multer.memoryStorage(); // on retraite avec sharp avant d'écrire sur disque

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new AppError('Seules les images JPG, PNG ou WebP sont autorisées.', 400));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 6 },
});

/**
 * Après multer (memoryStorage), on ré-encode chaque image avec sharp :
 * - supprime les métadonnées EXIF (vie privée / sécurité)
 * - force un format sûr (webp)
 * - redimensionne pour éviter les fichiers surdimensionnés
 * - écrit sous un nom aléatoire (évite l'exécution de code / path traversal)
 */
async function processAndSaveImages(req, res, next) {
  try {
    if (!req.files || req.files.length === 0) return next();

    const saved = [];
    for (const file of req.files) {
      const filename = `${crypto.randomBytes(16).toString('hex')}.webp`;
      const destPath = path.join(UPLOAD_ROOT, filename);

      await sharp(file.buffer)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(destPath);

      saved.push({ filename, url: `/uploads/${filename}` });
    }
    req.uploadedFiles = saved;
    next();
  } catch (err) {
    next(new AppError("Échec du traitement de l'image.", 400));
  }
}

module.exports = { upload, processAndSaveImages, UPLOAD_ROOT };
