// ===================================
// SERVICE WORKER PARA NOTIFICACIONES PUSH - PMA
// ===================================

// Versión del Service Worker
const VERSION = 'v1.0.0';
const CACHE_NAME = `pma-cache-${VERSION}`;

// ===================================
// INSTALACIÓN
// ===================================
self.addEventListener('install', (event) => {
  console.log('✅ Service Worker instalado:', VERSION);
  // Activar inmediatamente
  self.skipWaiting();
});

// ===================================
// ACTIVACIÓN
// ===================================
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activado:', VERSION);
  // Tomar control de todas las páginas inmediatamente
  event.waitUntil(self.clients.claim());
});

// ===================================
// RECIBIR NOTIFICACIÓN PUSH
// ===================================
self.addEventListener('push', (event) => {
  console.log('📩 Notificación push recibida');
  
  let notificationData = {
    title: 'PMA - Notificación',
    body: 'Tienes una nueva notificación del Programa de Mejoramiento Académico',
    icon: 'https://vkfjttukyrtiumzfmyuk.supabase.co/storage/v1/object/public/img/LOGO.png',
    badge: 'https://vkfjttukyrtiumzfmyuk.supabase.co/storage/v1/object/public/img/LOGO.png',
    data: {
      url: '/'
    }
  };

  // Si viene data en el push, usarla
  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        title: payload.title || notificationData.title,
        body: payload.body || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        data: {
          url: payload.url || '/'
        }
      };
    } catch (e) {
      console.error('Error al parsear payload:', e);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      vibrate: [200, 100, 200],
      data: notificationData.data,
      requireInteraction: false,
      tag: 'pma-notification'
    })
  );
});

// ===================================
// CLICK EN NOTIFICACIÓN
// ===================================
self.addEventListener('notificationclick', (event) => {
  console.log('🖱️ Click en notificación');
  
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Buscar si ya hay una ventana abierta
        for (let client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Si no hay ventana abierta, abrir una nueva
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// ===================================
// CERRAR NOTIFICACIÓN
// ===================================
self.addEventListener('notificationclose', (event) => {
  console.log('❌ Notificación cerrada');
});

// ===================================
// FETCH (Opcional - para offline)
// ===================================
self.addEventListener('fetch', (event) => {
  // No interceptar fetch por ahora, solo manejar notificaciones
  return;
});
