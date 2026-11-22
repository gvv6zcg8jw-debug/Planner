// Planner Financeiro: guarda o app no aparelho para abrir sem internet.
// A página principal é sempre buscada na rede primeiro, para atualizações chegarem na hora;
// a cópia guardada só é usada quando não há internet.
const CACHE = 'planner-v2';
const SHELL = ['./', './index.html', './config.js', './manifest.webmanifest', './apple-touch-icon.png', './icon-192.png', './icon-512.png'];
const CDN = ['https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map(u => fetch(new Request(u, { cache: 'reload' })).then(r => r.ok && c.put(u, r)).catch(() => {})));
    await Promise.all(CDN.map(u => { const ac = new AbortController(); setTimeout(() => ac.abort(), 8000);
      return fetch(u, { signal: ac.signal }).then(r => r.ok && c.put(u, r)).catch(() => {}); }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    // recarrega as janelas abertas para já mostrar a versão nova
    const wins = await self.clients.matchAll({ type: 'window' });
    for (const w of wins) { try { await w.navigate(w.url); } catch (err) {} }
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co') || url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/v1/')) return; // dados: sempre pela rede
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && url.hostname !== 'cdn.jsdelivr.net') return;

  const isPage = req.mode === 'navigate' || (sameOrigin && (url.pathname.endsWith('/') || url.pathname.endsWith('.html')));
  const isConfig = sameOrigin && url.pathname.endsWith('/config.js');

  if (isPage || isConfig) { // rede primeiro
    const key = isPage ? './index.html' : './config.js';
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const r = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
        if (r && r.ok) { c.put(key, r.clone()); return r; }
        throw new Error('rede');
      } catch (err) {
        return (await c.match(key)) || (await c.match(req, { ignoreSearch: true })) || new Response('Sem conexão', { status: 503 });
      }
    })());
    return;
  }

  // ícones e biblioteca de gráficos: cópia guardada, atualizada em segundo plano
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || new Response('Sem conexão', { status: 503 });
  }));
});
