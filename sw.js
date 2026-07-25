const CACHE_NAME = "cahier-classe-v3";
const FICHIERS_A_METTRE_EN_CACHE = [
  "./",
  "./index.html",
  "./app.min.js",
  "./react.production.min.js",
  "./react-dom.production.min.js",
  "./styles.css",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FICHIERS_A_METTRE_EN_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(noms.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Réseau d'abord (pour toujours avoir la dernière version en ligne),
// bascule sur le cache uniquement si hors-ligne.
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((reponse) => {
        const copie = reponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copie));
        return reponse;
      })
      .catch(() => caches.match(event.request))
  );
});
