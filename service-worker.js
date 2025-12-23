const APP_VERSION = '1.0.2'; // ← INCREMENT THIS when you update files
const CACHE_NAME = `finance-tracker-${APP_VERSION}`;

const urlsToCache = [
  './',
  './index.html',
  './finance.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // NOTE: Icons are NOT cached here - they're optional for first load
];

// ============ INSTALL ============
self.addEventListener('install', event => {
  console.log(`📦 Installing Service Worker v${APP_VERSION}`);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ Caching app core files');
        // Cache essential files only (skip icons for now)
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // Force service worker to activate immediately
        return self.skipWaiting();
      })
      .catch(error => {
        console.log('❌ Cache failed:', error);
      })
  );
});

// ============ ACTIVATE ============
self.addEventListener('activate', event => {
  console.log('✅ Service Worker activated');
  
  event.waitUntil(
    // Clean up old caches
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete old caches (keep current)
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      // Claim all clients (takes control immediately)
      return self.clients.claim();
    })
  );
});

// ============ FETCH ============
self.addEventListener('fetch', event => {
  // Skip non-GET requests and browser extensions
  if (event.request.method !== 'GET' || 
      event.request.url.startsWith('chrome-extension://')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // If cached, return it
        if (cachedResponse) {
          console.log('📂 From cache:', event.request.url);
          return cachedResponse;
        }
        
        // Otherwise fetch from network
        console.log('🌐 Fetching:', event.request.url);
        return fetch(event.request)
          .then(networkResponse => {
            // Cache successful responses (except icons on first load)
            if (networkResponse.ok && 
                !event.request.url.includes('icon') && 
                event.request.url.startsWith(location.origin)) {
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, networkResponse.clone());
              });
            }
            return networkResponse;
          })
          .catch(error => {
            console.log('❌ Network failed:', error);
            
            // Special handling for icons - return placeholder
            if (event.request.url.includes('icon')) {
              return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192"><rect width="192" height="192" fill="#10b981"/><text x="96" y="96" font-family="Arial" font-size="96" fill="white" text-anchor="middle" dominant-baseline="middle">💰</text></svg>',
                {
                  headers: { 'Content-Type': 'image/svg+xml' }
                }
              );
            }
            
            // For HTML pages, return offline page
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('./index.html');
            }
            
            return new Response('Offline - please check connection', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// ============ MESSAGES ============
self.addEventListener('message', event => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
  
  if (event.data.action === 'clearCache') {
    caches.delete(CACHE_NAME);
  }
  
  if (event.data.action === 'updateApp') {
    // Force update by deleting cache and reloading
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ action: 'reload' }));
      });
    });
  }
});

// ============ PERIODIC SYNC ============
// (Optional - for future background sync)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-finance-data') {
    console.log('🔄 Background sync running');
    // Add background sync logic here later
  }
});

// ============ BACKGROUND FETCH ============
// (Optional - for large downloads)
self.addEventListener('backgroundfetchsuccess', event => {
  console.log('✅ Background fetch successful');
  event.updateUI({ title: 'Finance data updated' });
});
