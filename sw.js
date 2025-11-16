const CACHE_NAME = 'ecrano-v1.2.4';
const BASE_PATH = '/Ecrano-App'; // ✅ Chemin GitHub Pages

const urlsToCache = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/style.css`,
  `${BASE_PATH}/script.js`,
  `${BASE_PATH}/manifest.json`
];

// Installation du Service Worker
self.addEventListener('install', event => {
  console.log('🔧 Installation du Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Mise en cache des fichiers...');
        return cache.addAll(urlsToCache).catch(err => {
          console.error('❌ Erreur lors de la mise en cache:', err);
          // Continue même si certains fichiers échouent
          return urlsToCache.reduce((promise, url) => {
            return promise.then(() => {
              return cache.add(url).catch(err => {
                console.warn(`⚠️ Impossible de mettre en cache: ${url}`, err);
              });
            });
          }, Promise.resolve());
        });
      })
      .then(() => {
        console.log('✅ Service Worker installé');
        return self.skipWaiting(); // Active immédiatement
      })
  );
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', event => {
  console.log('🔄 Activation du Service Worker...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ Suppression ancien cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker activé');
        return self.clients.claim(); // Prend le contrôle immédiatement
      })
  );
});

// Stratégie Cache First avec fallback réseau
self.addEventListener('fetch', event => {
  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retourne depuis le cache si disponible
        if (response) {
          console.log('📦 Depuis le cache:', event.request.url);
          return response;
        }

        // Sinon, récupère depuis le réseau
        console.log('🌐 Depuis le réseau:', event.request.url);
        return fetch(event.request)
          .then(response => {
            // Vérifie si la réponse est valide
            if (!response || response.status !== 200 || response.type === 'opaque') {
              return response;
            }

            // Clone et met en cache pour les prochaines fois
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });

            return response;
          })
          .catch(error => {
            console.error('❌ Erreur réseau:', error);
            // Fallback vers index.html pour les routes HTML
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match(`${BASE_PATH}/index.html`);
            }
          });
      })
  );
});

