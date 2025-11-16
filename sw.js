const CACHE_NAME = 'ecrano-v1.2.5'; // ✅ Change la version
const BASE_PATH = '/Ecrano-App';

const urlsToCache = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/style.css`,
  `${BASE_PATH}/script.js`,
  `${BASE_PATH}/manifest.json`
];

// ========================================
// 🔧 INSTALLATION
// ========================================
self.addEventListener('install', event => {
  console.log('🔧 Installation du Service Worker v1.2.5...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Mise en cache des fichiers...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Service Worker installé');
        return self.skipWaiting(); // ✅ Active immédiatement
      })
      .catch(err => {
        console.error('❌ Erreur installation:', err);
      })
  );
});

// ========================================
// 🔄 ACTIVATION
// ========================================
self.addEventListener('activate', event => {
  console.log('🔄 Activation du Service Worker v1.2.5...');
  
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
        return self.clients.claim(); // ✅ Prend le contrôle immédiatement
      })
  );
});

// ========================================
// 📡 FETCH - STRATÉGIE AMÉLIORÉE
// ========================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // ⚠️ TOUJOURS vérifier le réseau pour sw.js et manifest.json
  if (url.pathname.includes('sw.js') || url.pathname.includes('manifest.json')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') {
    return;
  }

  // ✅ STRATÉGIE : Network First pour les fichiers HTML/CSS/JS
  // (pour avoir toujours la dernière version)
  if (url.pathname.endsWith('.html') || 
      url.pathname.endsWith('.css') || 
      url.pathname.endsWith('.js') ||
      url.pathname === `${BASE_PATH}/` ||
      url.pathname === BASE_PATH) {
    
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // ✅ Mise à jour du cache avec la nouvelle version
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          console.log('🌐 Depuis le réseau (mis en cache):', event.request.url);
          return response;
        })
        .catch(() => {
          // ❌ Fallback vers le cache si hors ligne
          console.log('📦 Fallback cache:', event.request.url);
          return caches.match(event.request);
        })
    );
    return;
  }

  // ✅ STRATÉGIE : Cache First pour les images et autres assets
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          console.log('📦 Depuis le cache:', event.request.url);
          return response;
        }

        return fetch(event.request)
          .then(response => {
            if (!response || response.status !== 200) {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });

            return response;
          });
      })
  );
});
