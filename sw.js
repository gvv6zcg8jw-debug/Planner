// Guarda o app no aparelho para abrir sem internet.
const CACHE = 'planner-v1';
const SHELL = ['./', './index.html', './config.js', './manifest.webmanifest', './apple-touch-icon.png', './icon-192.png', './icon-512.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co') || url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/v1/')) return; // dados: sempre pela rede
  if (url.origin !== self.location.origin && url.hostname !== 'cdn.jsdelivr.net') return;
  const key = req.mode === 'navigate' ? './index.html' : req;
  if (url.pathname.endsWith('/config.js')) { // configuração: rede primeiro
    e.respondWith(fetch(req).then(r => { if (r.ok) caches.open(CACHE).then(c => c.put(req, r.clone())); return r; }).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(key, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r && r.ok) c.put(key, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || new Response('Sem conexão', { status: 503 });
  }));
});
