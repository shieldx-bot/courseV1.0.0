/// <reference types="serwist" />

import { Serwist } from 'serwist';

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: [
    { url: '/', revision: '1' },
    { url: '/offline', revision: '1' },
    { url: '/offline-courses', revision: '1' },
  ],
  runtimeCaching: [
    {
      matcher: ({ request }) => request.destination === 'document',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
        expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
        networkTimeoutSeconds: 10,
      },
    },
    {
      matcher: ({ request }) => request.destination === 'script' || request.destination === 'style',
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-resources',
        expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      matcher: ({ request }) => request.destination === 'image',
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      matcher: ({ url }) => url.pathname.startsWith('/api/v1/'),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api',
        expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 },
        networkTimeoutSeconds: 10,
      },
    },
  ],
  fallbackEntries: [
    { url: '/offline', revision: '1' },
  ],
});

serwist.addEventListeners();