/* Quilotórax Neo — service worker
   Cambia VERSION cada vez que subas un index.html nuevo a GitHub. */
const VERSION = 'quilotorax-v1.0.0';
const CORE = ['./', './index.html'];
const FONTS = 'quilotorax-fonts-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => { if (e.data === 'skip') self.skipWaiting(); });

function timeout(ms, p) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((r) => { clearTimeout(t); resolve(r); }, (err) => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fuentes de Google: caché primero (funcionan sin internet después de la primera carga)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONTS).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
        return res;
      }).catch(() => hit || new Response('', { status: 504 }))))
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navegación: red primero con límite de 3 s; si no hay red, la copia guardada.
  // Así nunca queda "cargando" sin internet y siempre toma la versión nueva cuando hay red.
  if (req.mode === 'navigate') {
    e.respondWith(
      timeout(3000, fetch(req)).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('./index.html', copy));
        }
        return res;
      }).catch(() => caches.match('./index.html', { ignoreSearch: true }).then((r) => r || caches.match('./')))
    );
    return;
  }

  // Resto del mismo origen: caché y actualización en segundo plano
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
