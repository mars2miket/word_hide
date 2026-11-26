// Bump CACHE when you want to force-refresh all cached files.
var CACHE = 'vault-recall-v1.1.2';
var FILES = [
  './', 'index.html', 'manifest.json',
  'styles/components.css', 'styles/layout.css', 'styles/qbank.css',
  'styles/reset.css',  'styles/responsive.css', 'styles/tokens.css',

  'js/locales/en.js', 'js/locales/vi.js', 'js/locales/fr.js',
  'js/analytics.js', 'js/duplicates.js', 'js/exam.js', 
  'js/grid.js', 'js/i18n.js', 'js/lists.js',
  'js/main.js', 'js/modal.js', 'js/nav.js', 
  'js/notes.js', 'js/onboarding.js', 'js/qbank.js', 
  'js/sorting.js', 'js/speech-controls.js', 'js/speech-core.js', 
  'js/speech-engine.js', 'js/speech-popups.js', 'js/speech-voices.js',
  'js/state.js', 'js/storage.js', 'js/workspace.js', 
  'banks/AI.csv', 'banks/Business_Analysis.csv', 'banks/Electric_Utility.csv',
  'banks/Cybersecurity.csv', 'banks/Prosci.csv',
  'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

// Serve from cache, refresh in the background (updates appear on next load)
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  
  // Question banks: network first so new questions arrive, cache as offline fallback
  if (new URL(e.request.url).pathname.indexOf('Prosci') !== -1) {
    e.respondWith(fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () { return caches.match(e.request); }));
    return;
  }
  
  e.respondWith(caches.match(e.request).then(function (hit) {
    var net = fetch(e.request).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () { return hit; });
    return hit || net;
  }));
});