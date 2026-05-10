// Vida Buddies ERP — Service Worker
// Provides offline caching and enables PWA installability

const CACHE_NAME = 'vida-buddies-v2';

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png',
  '/manifest.json',
];

// Install event — cache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // Activate immediately without waiting for old SW to stop
  self.skipWaiting();
});

// Activate event — clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Take control of all open clients immediately
  self.clients.claim();
});

// ── Push Notification event ──────────────────────────────────
// Handles incoming Web Push messages and displays a native notification
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'VidaBuddies', body: event.data.text() };
  }

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192x192.png',
    badge: payload.badge || '/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      url: payload.url || '/',
    },
    tag: payload.tag || 'vida-notification',
    renotify: true,
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'VidaBuddies', options)
  );
});

// ── Notification Click handler ──────────────────────────────
// Opens the target URL when the user clicks a push notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing tab if one matches
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        return self.clients.openWindow(targetUrl);
      })
  );
});

// Fetch event — Network-first strategy for API/dynamic content,
// Cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API routes — always go to network
  if (url.pathname.startsWith('/api/')) return;

  // Skip Next.js internal assets — never cache compiled chunks
  // This prevents stale Turbopack modules from being served from SW cache
  if (url.pathname.startsWith('/_next/')) return;

  // For navigation requests (HTML pages) — network first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache a copy of the response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }

  // For static assets — cache first, fallback to network
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|webp|woff2?|ttf|eot|ico)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        });
      })
    );
    return;
  }

  // Default — network first
  event.respondWith(
    fetch(request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });
        return response;
      })
      .catch(() => caches.match(request))
  );
});
