// Metro config: also forwards /proxy/* to the local F1 live-timing proxy (port 8787),
// so it's reachable through the Expo tunnel.
const { getDefaultConfig } = require('expo/metro-config');
const http = require('http');
const config = getDefaultConfig(__dirname);
config.server = config.server || {};
const prev = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const mw = prev ? prev(middleware, server) : middleware;
  return (req, res, next) => {
    if (!req.url.startsWith('/proxy/')) return mw(req, res, next);
    const p = http.request({ host: '127.0.0.1', port: 8787, path: req.url.slice(6), method: req.method, headers: { accept: 'application/json' } }, r => {
      res.writeHead(r.statusCode || 502, r.headers); r.pipe(res);
    });
    p.on('error', e => { res.writeHead(502, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: e.message })); });
    req.pipe(p);
  };
};
module.exports = config;
