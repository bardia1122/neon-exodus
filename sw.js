// Bump the cache name on every release so clients pull fresh files.
const CACHE = 'neon-exodus-v1.0.0';
const ASSETS = [
  './', './index.html', './manifest.json', './icon.svg',
  './vendor/three.min.js',
  './js/audio.js', './js/world.js', './js/weapons.js',
  './js/enemies.js', './js/player.js', './js/game.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit =>
      hit || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});
