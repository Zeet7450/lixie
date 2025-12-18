/**
 * Notification service for PWA
 * Handles notification permissions and sending notifications for hot/breaking news
 */

export interface NotificationPermission {
  granted: boolean;
  denied: boolean;
  default: boolean;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      granted: false,
      denied: false,
      default: false,
    };
  }

  if (Notification.permission === 'granted') {
    return {
      granted: true,
      denied: false,
      default: false,
    };
  }

  if (Notification.permission === 'denied') {
    return {
      granted: false,
      denied: true,
      default: false,
    };
  }

  // Request permission
  const permission = await Notification.requestPermission();
  
  return {
    granted: permission === 'granted',
    denied: permission === 'denied',
    default: permission === 'default',
  };
}

/**
 * Check if notification permission is granted
 */
export function hasNotificationPermission(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  return Notification.permission === 'granted';
}

/**
 * Register service worker for push notifications
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    
    console.log('Service Worker registered:', registration);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Send notification for hot/breaking news
 */
export async function sendHotNewsNotification(
  article: {
    id: number;
    title: string;
    description: string;
    category: string;
    region: string;
    source_id: string;
  }
): Promise<void> {
  if (!hasNotificationPermission()) {
    console.log('Notification permission not granted');
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  
  const regionNames: Record<string, string> = {
    'id': 'Indonesia',
    'cn': 'China',
    'intl': 'Internasional',
  };

  const regionName = regionNames[article.region] || article.region;
  const title = `🔥 ${regionName}: ${article.title}`;
  const body = article.description || 'Berita breaking terbaru';

  await registration.showNotification(title, {
    body,
    icon: '/images/logo-lixie.png',
    badge: '/images/logo-lixie.png',
    tag: `hot-news-${article.id}`,
    requireInteraction: false,
    data: {
      articleId: article.id,
      category: article.category,
      region: article.region,
      source: article.source_id,
    },
    // actions is supported in Service Worker notifications but not in standard NotificationOptions type
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
  } as NotificationOptions & { actions?: Array<{ action: string; title: string }> });
}

/**
 * Initialize notification system
 */
export async function initializeNotifications(): Promise<{
  permissionGranted: boolean;
  serviceWorkerRegistered: boolean;
}> {
  let permissionGranted = false;
  let serviceWorkerRegistered = false;

  // Register service worker first
  const registration = await registerServiceWorker();
  if (registration) {
    serviceWorkerRegistered = true;
  }

  // Check if permission is already granted
  if (hasNotificationPermission()) {
    permissionGranted = true;
    return { permissionGranted, serviceWorkerRegistered };
  }

  return { permissionGranted, serviceWorkerRegistered };
}
