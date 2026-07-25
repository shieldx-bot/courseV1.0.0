/// <reference types="serwist" />

import { Serwist, NetworkFirst, StaleWhileRevalidate, CacheFirst, ExpirationPlugin } from 'serwist';

declare global {
  interface ServiceWorkerGlobalScope {
    __SW_MANIFEST?: string[];
  }
}

const swSelf = self as unknown as ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: swSelf.__SW_MANIFEST || [
    { url: '/', revision: '1' },
    { url: '/offline', revision: '1' },
    { url: '/offline-courses', revision: '1' },
  ],
  runtimeCaching: [
    {
      matcher: ({ request }) => request.destination === 'document',
      handler: new NetworkFirst({
        cacheName: 'pages',
        networkTimeoutSeconds: 10,
        plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 })],
      }),
    },
    {
      matcher: ({ request }) => request.destination === 'script' || request.destination === 'style',
      handler: new StaleWhileRevalidate({
        cacheName: 'static-resources',
        plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 })],
      }),
    },
    {
      matcher: ({ request }) => request.destination === 'image',
      handler: new CacheFirst({
        cacheName: 'images',
        plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    {
      matcher: ({ url }) => url.pathname.startsWith('/api/v1/'),
      handler: new NetworkFirst({
        cacheName: 'api',
        networkTimeoutSeconds: 10,
        plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 5 * 60 })],
      }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher: ({ request }) => request.mode === 'navigate',
      },
    ],
  },
});

serwist.addEventListeners();
