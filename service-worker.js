// ===================================
// SERVICE WORKER PARA NOTIFICACIONES PUSH
// ===================================

const VERSION = '1.0.0';
const CACHE_NAME = `pma-cache-${VERSION}`;

// ===================================
// EVENTO: Instalación del Service Worker
// ===================================
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker versión:', VERSION);
  
  // Activar inmediatamente sin esperar
  self.skipWaiting();
});

// ===================================
// EVENTO: Activación del Service Worker
// ===================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activado');
  
  // Tomar control de todas las páginas inmediatamente
  event.waitUntil(
    self.clients.claim()
  );
});

// ===================================
// EVENTO: Recibir notificación push
// ===================================
self.addEventListener('push', (event) => {
  console.log('[SW] Notificación push recibida');

  let notificacion = {
    title: 'PMA - Programa de Mejoramiento Académico',
    body: 'Nueva notificación del PMA',
    icon: 'https://vkfjttukyrtiumzfmyuk.supabase.co/storage/v1/object/public/img/LOGO.png',
    badge: 'https://vkfjttukyrtiumzfmyuk.supabase.co/storage/v1/object/public/img/LOGO.png',
    data: {
      url: '/'
    }
  };

  // Si viene con datos personalizados, usarlos
  if (event.data) {
    try {
      const payload = event.data.json();
      notificacion = {
        ...notificacion,
        ...payload
      };
    } catch (error) {
      console.log('[SW] Usando notificación por defecto');
    }
  }

  const promesaMostrar = self.registration.showNotification(notificacion.title, {
    body: notificacion.body,
    icon: notificacion.icon,
    badge: notificacion.badge,
    tag: 'pma-notification',
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: notificacion.data
  });

  event.waitUntil(promesaMostrar);
});

// ===================================
// EVENTO: Click en notificación
// ===================================
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Click en notificación');

  event.notification.close();

  // URL a la que redirigir (puede venir en los datos de la notificación)
  const urlDestino = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Si ya hay una pestaña abierta, enfocarla
        for (const client of clientList) {
          if (client.url === self.registration.scope + urlDestino.substring(1) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Si no hay pestaña abierta, abrir una nueva
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlDestino);
        }
      })
  );
});

// ===================================
// EVENTO: Error en push
// ===================================
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Suscripción push cambió');
  
  // Aquí puedes renovar la suscripción si es necesario
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true
    }).then((subscription) => {
      console.log('[SW] Nueva suscripción creada:', subscription);
      // Aquí deberías enviar la nueva suscripción a Supabase
    })
  );
});

// ===================================
// EVENTO: Mensaje desde el cliente
// ===================================
self.addEventListener('message', (event) => {
  console.log('[SW] Mensaje recibido del cliente:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Service Worker cargado correctamente');
