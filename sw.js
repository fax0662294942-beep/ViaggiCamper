const CACHE_NAME = 'moneytracker-v9';

const CDN_LIBS = [
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

const LOCAL_ASSETS = [
  '/MoneyTracker7.0/',
  '/MoneyTracker7.0/index.html',
  '/MoneyTracker7.0/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cacha assets locali
      await cache.addAll(LOCAL_ASSETS).catch(err => console.warn('Local cache parziale:', err));
      
      // Cacha librerie CDN (una per una per non fallire tutto se una manca)
      for (const url of CDN_LIBS) {
        try {
          const response = await fetch(url, { mode: 'cors' });
          if (response.ok) {
            await cache.put(url, response);
            console.log('Cachato:', url);
          }
        } catch (err) {
          console.warn('Non cachato (continuo):', url, err.message);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => {
          console.log('Elimino cache vecchia:', key);
          return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  const isHTML = event.request.mode === 'navigate' || url.endsWith('.html');

  if (isHTML) {
    // Network first per HTML: aggiornamenti immediati
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache first per tutto il resto (CDN libs, icone, manifest)
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => undefined);
      })
    );
  }
});
