// Petit serveur HTTP statique pour les tests (et pour essayer le jeu sur un téléphone du réseau local).
//   node tests/lib/serve.js [port]          sert le dépôt sur http://127.0.0.1:<port>/
// En module : const { serve } = require('./lib/serve'); const s = await serve(racine);
//   s.url, s.override('/sw.js', { body, delay, status }), s.clear(), s.requests (journal), await s.close()
// http://127.0.0.1 est un contexte sûr : le service worker y fonctionne comme en https.
const http = require('http'), fs = require('fs'), path = require('path');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8'
};
function serve(root, { port = 0, host = '127.0.0.1' } = {}) {
  root = path.resolve(root);
  const overrides = new Map(), requests = [];
  const server = http.createServer((req, res) => {
    const send = (status, body, type) => {
      res.writeHead(status, { 'Content-Type': type || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    };
    // adresse malformée (« // », « %E0 »…) : 400, le serveur continue de servir les requêtes suivantes
    let u, p;
    try { u = new URL(req.url.replace(/^\/{2,}/, '/'), 'http://x'); p = decodeURIComponent(u.pathname); }
    catch (e) { requests.push(req.url); return send(400, 'requête invalide'); }
    requests.push(p + u.search);
    const o = overrides.get(p);
    const go = () => {
      if (o && o.body !== undefined) return send(o.status || 200, o.body, o.type || TYPES[path.extname(p)]);
      if (o && o.status) return send(o.status, '');
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(root, p);
      if (f !== root && !f.startsWith(root + path.sep)) return send(403, '');
      fs.readFile(f, (err, data) => err ? send(404, 'introuvable') : send(200, data, TYPES[path.extname(f)]));
    };
    if (o && o.delay) setTimeout(go, o.delay); else go();
  });
  return new Promise(resolve => server.listen(port, host, () => {
    const a = server.address();
    resolve({
      url: `http://${host}:${a.port}/`, port: a.port, requests,
      override(p, o) { overrides.set(p, o); }, clear() { overrides.clear(); },
      close: () => new Promise(r => { server.closeAllConnections && server.closeAllConnections(); server.close(() => r()); })
    });
  }));
}
module.exports = { serve };
if (require.main === module) {
  const port = +process.argv[2] || 8080;
  serve(path.resolve(__dirname, '..', '..'), { port, host: '0.0.0.0' }).then(s => console.log(`Orbita servi sur http://localhost:${s.port}/ (Ctrl+C pour arrêter)`));
}
