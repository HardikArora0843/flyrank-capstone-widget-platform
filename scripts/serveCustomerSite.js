import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5500;
const CUSTOMER_SITE_DIR = path.join(__dirname, '..', 'customer-site');

const server = http.createServer((req, res) => {
  let filePath = path.join(CUSTOMER_SITE_DIR, req.url === '/' ? 'index.html' : req.url);

  // Security: Prevent directory traversal
  if (!filePath.startsWith(CUSTOMER_SITE_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Customer Test Site (Second Origin) Running`);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(` Serving: ${CUSTOMER_SITE_DIR}`);
  console.log(`====================================================`);
});
