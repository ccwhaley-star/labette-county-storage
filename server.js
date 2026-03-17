const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3457;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  // Redirect .html URLs to clean extensionless URLs (301)
  if (urlPath.endsWith('.html')) {
    const clean = urlPath === '/index.html' ? '/' : urlPath.slice(0, -5);
    res.writeHead(301, { 'Location': clean, ...SECURITY_HEADERS });
    res.end();
    return;
  }

  // Resolve clean URLs
  let filePath;
  if (urlPath === '/') {
    filePath = path.join(ROOT, 'index.html');
  } else {
    const ext = path.extname(urlPath).toLowerCase();
    if (ext) {
      // Has a file extension — serve directly (css, js, img, etc.)
      filePath = path.normalize(path.join(ROOT, urlPath));
    } else {
      // No extension — try .html
      filePath = path.normalize(path.join(ROOT, urlPath + '.html'));
    }
  }

  // Prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
    res.end('Forbidden');
    return;
  }

  const resolvedExt = path.extname(filePath).toLowerCase();
  const contentType = MIME[resolvedExt] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT' || err.code === 'EISDIR') {
        const notFoundPath = path.join(ROOT, '404.html');
        fs.readFile(notFoundPath, (err404, content404) => {
          res.writeHead(404, { 'Content-Type': 'text/html', ...SECURITY_HEADERS });
          res.end(err404 ? '404 Not Found' : content404);
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
        res.end('Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType, ...SECURITY_HEADERS });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Labette County Storage dev server running at http://localhost:${PORT}`);
});
