// ------------------
//| VERSION ANDROID |
//------------------- Version 2.3.0

const CACHE_NAME = 'ecrano-v2.3.1';

// Chemins RELATIFS : l'appli est publiée sous /Ecrano-App/ sur GitHub Pages
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './sync-maison.js',
  './manifest.json',
  './icons/icon-48x48.png',
  './icons/icon-96x96.png',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// Ancienne copie de secours de la bibliothèque (v2.2.0) : l'appli la lit
// pour la migration puis la supprime elle-même. Le service worker n'y touche pas.
const CACHES_A_GARDER = ['ecrano-backup-v1'];

// Installation du Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache ouvert');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && !CACHES_A_GARDER.includes(cacheName)) {
            console.log('Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Stratégie Cache First avec fallback réseau
self.addEventListener('fetch', event => {
  const request = event.request;

  // On ne s'occupe que des fichiers de l'appli (GET, même origine).
  // Les requêtes vers le serveur maison (autre adresse) passent directement.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: request.mode === 'navigate' })
      .then(response => {
        // Retourne la ressource du cache si disponible
        if (response) {
          return response;
        }
        // Sinon, récupère depuis le réseau
        return fetch(request).then(response => {
          // Vérifie si la réponse est valide
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          // Clone la réponse
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache);
          });
          return response;
        }).catch(() => {
          // Hors ligne : on affiche l'appli pour toute navigation
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return Response.error();
        });
      })
  );
});
