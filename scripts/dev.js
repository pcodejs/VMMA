const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
for (const file of ['.env.local', '.env']) {
  const envPath = path.join(root, file);
  if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
}
const handlers = { '/api/payment': require('../api/payment'), '/api/receipt': require('../api/receipt'), '/api/register': require('../api/register'), '/api/tax-code': require('../api/tax-code') };
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  res.status = code => { res.statusCode = code; return res; };
  res.json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
  if (handlers[pathname]) {
    let body = '';
    let bodyBytes = 0;
    const maxBodyBytes = pathname === '/api/receipt' ? require('../lib/receipt').MAX_REQUEST_BYTES : 16000;
    for await (const chunk of req) {
      body += chunk;
      bodyBytes += chunk.length;
      if (bodyBytes > maxBodyBytes) { res.status(413).json({ error: 'Thông tin đăng ký quá dài.' }); return; }
    }
    req.body = body;
    await handlers[pathname](req, res);
    return;
  }
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const target = path.resolve(root, relative);
  const allowed = target.startsWith(root + path.sep) && !relative.split('/').some(part => part.startsWith('.')) && (relative.startsWith('assets/') || relative.startsWith('licenses/') || !relative.includes('/') && /\.(?:html|css|js)$/.test(relative));
  if (!allowed || !fs.existsSync(target) || !fs.statSync(target).isFile()) { res.statusCode = 404; res.end('Not found'); return; }
  res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
  fs.createReadStream(target).pipe(res);
}).listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log('Local preview http://127.0.0.1:4173'));
