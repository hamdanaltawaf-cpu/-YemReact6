/* Public content only. Sessions, private pages, APIs and video files never enter this cache. */
const CACHE = 'yemreact-public-v4.2';
const MAX_ENTRIES = 160;
async function store(request, response) {
  const cache = await caches.open(CACHE);
  await cache.put(request, response);
  const keys = await cache.keys();
  const removable = keys.filter(key => new URL(key.url).pathname !== '/offline');
  while (keys.length > MAX_ENTRIES && removable.length) {
    await cache.delete(removable.shift());
    keys.pop();
  }
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.add('/offline');
    // Precache the offline page's script and stylesheet references for a usable fallback.
    const html = await (await cache.match('/offline')).text();
    const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^\"]+)"/g)].map(match => match[1]))];
    await cache.addAll(assets);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('yemreact-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', event => {
  const req = event.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const publicPage = ['/', '/library', '/about', '/offline'].includes(url.pathname) || url.pathname.startsWith('/r/');
  const asset = url.pathname.startsWith('/_next/static/') || /^\/media\/.*\.webp$/.test(url.pathname) || url.pathname.startsWith('/icons/');
  if (req.mode === 'navigate' && publicPage) {
    event.respondWith(fetch(req).then(res => {
      if (res.ok) event.waitUntil(store(req, res.clone()));
      return res;
    }).catch(async () => await caches.match(req) || await caches.match('/offline')));
  } else if (asset) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) event.waitUntil(store(req, res.clone()));
      return res;
    })));
  }
});
