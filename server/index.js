const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const morgan = require('morgan');
const { initDb } = require('./db/connection');
const errorHandler = require('./middleware/error-handler');

const app = express();
const PORT = process.env.PORT || 3000;

const UI5_CDN = 'https://sdk.openui5.org';
const UI5_CACHE_DIR = path.join(__dirname, '..', 'data', 'ui5-cache');

app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));

app.use(express.static(path.join(__dirname, '..', 'webapp')));

// Proxy OpenUI5 CDN resources through our server with disk cache.
// The browser can't reach the CDN directly (corporate proxy), but Node can.
app.use('/resources', (req, res, next) => {
  const resourcePath = req.path;
  const cachedFile = path.join(UI5_CACHE_DIR, resourcePath);

  if (fs.existsSync(cachedFile)) {
    return res.sendFile(cachedFile);
  }

  const cdnUrl = UI5_CDN + '/resources' + resourcePath;

  https.get(cdnUrl, (cdnRes) => {
    if (cdnRes.statusCode !== 200) {
      res.status(cdnRes.statusCode).end();
      cdnRes.resume();
      return;
    }

    const chunks = [];
    cdnRes.on('data', (c) => chunks.push(c));
    cdnRes.on('end', () => {
      const body = Buffer.concat(chunks);

      const dir = path.dirname(cachedFile);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(cachedFile, body);

      const ext = path.extname(resourcePath).toLowerCase();
      const mimeMap = {
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.css': 'text/css',
        '.xml': 'application/xml',
        '.html': 'text/html',
        '.properties': 'text/plain',
        '.less': 'text/plain',
        '.svg': 'image/svg+xml',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.png': 'image/png',
        '.gif': 'image/gif',
      };
      res.set('Content-Type', mimeMap[ext] || 'application/octet-stream');
      res.set('Cache-Control', 'public, max-age=86400');
      res.send(body);
    });
  }).on('error', (err) => {
    console.error('CDN fetch error:', cdnUrl, err.message);
    res.status(502).json({ error: 'Failed to fetch UI5 resource' });
  });
});

app.use('/api/projects', require('./routes/projects'));
app.use('/api/projects', require('./routes/items'));
app.use('/api/projects', require('./routes/summary'));
app.use('/api/admin/ricef-types', require('./routes/ricef-types'));
app.use('/api/admin/estimation-grid', require('./routes/estimation-grid'));
app.use('/api/admin/blended-rates', require('./routes/blended-rates'));
app.use('/api/admin/complexity-definitions', require('./routes/complexity-defs'));
app.use('/api/admin/dropdowns', require('./routes/dropdowns'));
app.use('/api/admin/sheet-types', require('./routes/sheet-types'));

// SPA fallback — only for navigation routes, not for missing resources/API calls
app.get('*', (req, res, next) => {
  const p = req.path;
  if (p.startsWith('/api/') || p.startsWith('/resources/') ||
      p.match(/\.(js|json|xml|css|map|png|jpg|gif|svg|woff|woff2|ttf|properties)$/)) {
    return next();
  }
  res.sendFile(path.join(__dirname, '..', 'webapp', 'index.html'));
});

app.use(errorHandler);

fs.mkdirSync(UI5_CACHE_DIR, { recursive: true });
initDb();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`RICEFW Estimator running on http://localhost:${PORT}`);
  console.log(`UI5 resources proxied from CDN with disk cache at: ${UI5_CACHE_DIR}`);
});
