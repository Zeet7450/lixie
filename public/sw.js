// Service Worker for PWA Notifications
const CACHE_NAME = 'lixie-news-v1';
const NOTIFICATION_ICON = '/images/logo-lixie.png';

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  return self.clients.claim();
});

// Push event - handle push notifications
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  let notificationData = {
    title: 'Lixie News',
    body: 'Breaking news update',
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_ICON,
    tag: 'lixie-news',
    requireInteraction: false,
    data: {},
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || 'Lixie News',
        body: data.body || 'Breaking news update',
        icon: data.icon || NOTIFICATION_ICON,
        badge: NOTIFICATION_ICON,
        tag: data.tag || 'lixie-news',
        requireInteraction: false,
        data: data.data || {},
      };
    } catch (e) {
      console.error('Error parsing push data:', e);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
      actions: [
        {
          action: 'open',
          title: 'Baca',
        },
        {
          action: 'close',
          title: 'Tutup',
        },
      ],
    })
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event);
  
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Open the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (event.notification.data?.articleId) {
            return client.focus().then(() => {
              client.postMessage({
                type: 'OPEN_ARTICLE',
                articleId: event.notification.data.articleId,
              });
            });
          }
          return client.focus();
        }
      }
      // If app is not open, open it
      if (clients.openWindow) {
        const url = event.notification.data?.articleId
          ? `${self.location.origin}/article/${event.notification.data.articleId}`
          : self.location.origin;
        return clients.openWindow(url);
      }
    })
  );
});

// Message event - handle messages from app
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
