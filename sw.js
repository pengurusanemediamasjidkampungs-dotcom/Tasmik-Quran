/**
 * TASMIK QURAN 2026 - SERVICE WORKER (PRO)
 * ---------------------------------------
 * Menjadikan aplikasi lebih pantas (Cache-first)
 * Menyokong mod offline untuk kegunaan di kawasan rendah capaian internet.
 */

const CACHE_NAME = 'tasmik-v2026.01';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    './peserta_lelaki.hjson',
    './peserta_perempuan.hjson',
    './silibus.hjson',
    './logo.png',
    'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/hjson@3.2.2/bundle/hjson.min.js'
];

// 1. INSTALL: Simpan semua aset ke dalam cache
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('📦 SW: Caching App Shell...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// 2. ACTIVATE: Buang cache lama jika versi dikemaskini
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('🧹 SW: Clearing Old Cache...', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// 3. FETCH: Strategi Network-First untuk fail HJSON, Cache-First untuk aset statik
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Strategi Network-First untuk data (HJSON) supaya senarai pelajar sentiasa terkini
    if (url.pathname.endsWith('.hjson')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const clonedResponse = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clonedResponse);
                    });
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Strategi Cache-First untuk aset lain (CSS/JS/Fonts)
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).then((fetchResponse) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    // Hanya simpan request yang berjaya (status 200)
                    if (event.request.method === 'GET') {
                        cache.put(event.request, fetchResponse.clone());
                    }
                    return fetchResponse;
                });
            });
        }).catch(() => {
            // Jika offline dan aset tiada dalam cache
            if (event.request.mode === 'navigate') {
                return caches.match('./index.html');
            }
        })
    );
});
