/**
 * VokaLog Local Storage Mock (S3 / Cloudflare R2 Compatible)
 * Port: 9090
 * Supports presigned PUT uploads, public GET downloads, and CORS preflight.
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 9090;
const UPLOAD_ROOT = path.join(__dirname, 'uploads');

// Ensure base upload directory exists
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

// Global CORS Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['*'],
  exposedHeaders: ['ETag', 'Content-Length', 'Content-Type']
}));

// Preflight handler
app.options('*', (req, res) => {
  res.status(200).end();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'vokalog-mock-storage',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

/**
 * PUT /:bucket/* - Presigned URL Binary Upload
 */
app.put('/:bucket/*', (req, res) => {
  const bucket = req.params.bucket;
  const key = req.params[0];

  if (!bucket || !key) {
    return res.status(400).json({ error: 'Bucket and key are required' });
  }

  const targetPath = path.join(UPLOAD_ROOT, bucket, key);
  const targetDir = path.dirname(targetPath);

  // Prevent directory traversal attacks
  if (!targetPath.startsWith(UPLOAD_ROOT)) {
    return res.status(403).json({ error: 'Access denied: invalid file path' });
  }

  try {
    fs.mkdirSync(targetDir, { recursive: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create storage directory', details: err.message });
  }

  const writeStream = fs.createWriteStream(targetPath);
  let totalBytes = 0;

  req.on('data', (chunk) => {
    totalBytes += chunk.length;
  });

  req.pipe(writeStream);

  writeStream.on('finish', () => {
    // Record metadata (content-type, upload timestamp, size)
    const contentType = req.headers['content-type'] || 'application/octet-stream';
    const metaPath = targetPath + '.meta.json';
    const metadata = {
      bucket,
      key,
      contentType,
      size: totalBytes,
      uploadedAt: new Date().toISOString()
    };

    try {
      fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
    } catch (e) {
      console.warn(`[MockStorage] Failed to write meta file for ${key}:`, e.message);
    }

    const etag = `"${Buffer.from(`${bucket}-${key}-${totalBytes}`).toString('hex')}"`;
    res.setHeader('ETag', etag);
    res.status(200).json({
      success: true,
      bucket,
      key,
      size: totalBytes,
      contentType
    });
  });

  writeStream.on('error', (err) => {
    res.status(500).json({ error: 'Write failed', details: err.message });
  });
});

/**
 * GET /:bucket/* - Public Download / Read
 */
app.get('/:bucket/*', (req, res) => {
  const bucket = req.params.bucket;
  const key = req.params[0];

  const targetPath = path.join(UPLOAD_ROOT, bucket, key);

  if (!targetPath.startsWith(UPLOAD_ROOT)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ error: 'Object not found' });
  }

  // Determine Content-Type from metadata or file extension
  let contentType = 'application/octet-stream';
  const metaPath = targetPath + '.meta.json';

  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (meta.contentType) contentType = meta.contentType;
    } catch (_) {}
  } else {
    const ext = path.extname(key).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.json') contentType = 'application/json';
  }

  res.setHeader('Content-Type', contentType);
  const stream = fs.createReadStream(targetPath);
  stream.pipe(res);
});

/**
 * HEAD /:bucket/* - Header metadata check
 */
app.head('/:bucket/*', (req, res) => {
  const bucket = req.params.bucket;
  const key = req.params[0];
  const targetPath = path.join(UPLOAD_ROOT, bucket, key);

  if (!fs.existsSync(targetPath)) {
    return res.status(404).end();
  }

  const stat = fs.statSync(targetPath);
  res.setHeader('Content-Length', stat.size);
  res.status(200).end();
});

// Start listening
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`[VokaLog] Mock S3/R2 Storage Server listening on port ${PORT}`);
  console.log(`  Upload URL: http://127.0.0.1:${PORT}/:bucket/:key`);
  console.log(`  Storage directory: ${UPLOAD_ROOT}`);
  console.log(`=======================================================`);
});

module.exports = { app, server };
