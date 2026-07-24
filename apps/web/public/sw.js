/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string }>;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

const CACHE_NAMES = {
  static: 'ascendly-static-v1',
  api: 'ascendly-api-v1',
  images: 'ascendly-images-v1',
  offline: 'ascendly-offline-v1',
};

registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: CACHE_NAMES.offline,
      networkTimeoutSeconds: 3,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 7 * 24 * 60 * 60,
        }),
      ],
    }),
    {
      allowlist: [/^\/$/],
    }
  )
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/v1/courses/') || url.pathname.startsWith('/api/v1/lessons/'),
  new StaleWhileRevalidate({
    cacheName: CACHE_NAMES.api,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 24 * 60 * 60,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/v1/'),
  new NetworkFirst({
    cacheName: CACHE_NAMES.api,
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 5 * 60,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

registerRoute(
  ({ url }) => url.pathname.match(/\.(?:png|jpg|jpeg|svg|webp|avif|gif|ico)$/),
  new CacheFirst({
    cacheName: CACHE_NAMES.images,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

registerRoute(
  ({ url }) => url.pathname.match(/\.(?:js|css|woff2?|ttf|eot)$/),
  new CacheFirst({
    cacheName: CACHE_NAMES.static,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data?.type === 'CACHE_COURSE' && event.data.courseId) {
    cacheCourseForOffline(event.data.courseId);
  }
  
  if (event.data?.type === 'CLEAR_COURSE_CACHE' && event.data.courseId) {
    clearCourseCache(event.data.courseId);
  }
});

async function cacheCourseForOffline(courseId: string) {
  try {
    const cache = await caches.open(CACHE_NAMES.offline);
    const courseResponse = await fetch(`/api/v1/courses/${courseId}?include=lessons`);
    if (courseResponse.ok) {
      await cache.put(`/api/v1/courses/${courseId}?include=lessons`, courseResponse);
      
      const courseData = await courseResponse.clone().json();
      if (courseData.course?.lessons) {
        for (const lesson of courseData.course.lessons) {
          try {
            const lessonResponse = await fetch(`/api/v1/lessons/${lesson.id}`);
            if (lessonResponse.ok) {
              await cache.put(`/api/v1/lessons/${lesson.id}`, lessonResponse);
            }
          } catch {
            console.warn(`Failed to cache lesson ${lesson.id}`);
          }
        }
      }
      console.log(`Course ${courseId} cached for offline access`);
    }
  } catch (error) {
    console.error('Failed to cache course for offline:', error);
  }
}

async function clearCourseCache(courseId: string) {
  try {
    const cache = await caches.open(CACHE_NAMES.offline);
    await cache.delete(`/api/v1/courses/${courseId}?include=lessons`);
    console.log(`Cleared cache for course ${courseId}`);
  } catch (error) {
    console.error('Failed to clear course cache:', error);
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-progress') {
    event.waitUntil(syncOfflineProgress());
  }
  if (event.tag === 'sync-notes') {
    event.waitUntil(syncOfflineNotes());
  }
});

async function syncOfflineProgress() {
  try {
    const db = await openOfflineDB();
    const pendingProgress = await getAllPendingProgress(db);
    
    for (const progress of pendingProgress) {
      try {
        const response = await fetch('/api/v1/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(progress.data),
        });
        
        if (response.ok) {
          await deletePendingProgress(db, progress.id);
        }
      } catch {
        console.warn('Failed to sync progress:', progress.id);
      }
    }
  } catch (error) {
    console.error('Failed to sync offline progress:', error);
  }
}

async function syncOfflineNotes() {
  try {
    const db = await openOfflineDB();
    const pendingNotes = await getAllPendingNotes(db);
    
    for (const note of pendingNotes) {
      try {
        const response = await fetch(`/api/v1/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(note.data),
        });
        
        if (response.ok) {
          await deletePendingNote(db, note.id);
        }
      } catch {
        console.warn('Failed to sync note:', note.id);
      }
    }
  } catch (error) {
    console.error('Failed to sync offline notes:', error);
  }
}

function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ascendly-offline', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('progress')) {
        db.createObjectStore('progress', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('pendingSync')) {
        db.createObjectStore('pendingSync', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

function getAllPendingProgress(db: IDBDatabase): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('progress', 'readonly');
    const store = transaction.objectStore('progress');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllPendingNotes(db: IDBDatabase): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('notes', 'readonly');
    const store = transaction.objectStore('notes');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deletePendingProgress(db: IDBDatabase, id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('progress', 'readwrite');
    const store = transaction.objectStore('progress');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function deletePendingNote(db: IDBDatabase, id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('notes', 'readwrite');
    const store = transaction.objectStore('notes');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'periodic-sync-courses') {
    event.waitUntil(updateCachedCourses());
  }
});

async function updateCachedCourses() {
  try {
    const cache = await caches.open(CACHE_NAMES.offline);
    const requests = await cache.keys();
    
    for (const request of requests) {
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/v1/courses/')) {
        try {
          const response = await fetch(request.url);
          if (response.ok) {
            await cache.put(request, response);
          }
        } catch {
          console.warn('Failed to update cached course:', request.url);
        }
      }
    }
  } catch (error) {
    console.error('Periodic sync failed:', error);
  }
}

console.log('Ascendly Service Worker loaded');