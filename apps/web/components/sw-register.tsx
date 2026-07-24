'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function SWRegister() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('SW registered:', registration.scope);

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New SW available, will reload on next visit');
                if (confirm('Có phiên bản mới. Tải lại để cập nhật?')) {
                  window.location.reload();
                }
              }
            });
          }
        });
      } catch (error) {
        console.error('SW registration failed:', error);
      }
    };

    registerSW();
  }, [pathname]);

  return null;
}