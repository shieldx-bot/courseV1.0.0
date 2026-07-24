'use client';

import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { Workbox } from 'workbox-window';
import { useRouter } from 'next/navigation';

interface PWAContextType {
  isInstallable: boolean;
  isOffline: boolean;
  install: () => Promise<void>;
  updateAvailable: boolean;
  applyUpdate: () => void;
  offlineReady: boolean;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

export function usePWA() {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error('usePWA must be used within a PWAProvider');
  }
  return context;
}

interface PWAProviderProps {
  children: ReactNode;
}

export function PWAProvider({ children }: PWAProviderProps) {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [wb, setWb] = useState<Workbox | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const workbox = new Workbox('/sw.js');
    setWb(workbox);

    workbox.addEventListener('installed', (event) => {
      if (!event.isUpdate) {
        console.log('PWA: Service worker installed for the first time');
        setOfflineReady(true);
      } else {
        console.log('PWA: Service worker updated');
        setUpdateAvailable(true);
      }
    });

    workbox.addEventListener('waiting', () => {
      setUpdateAvailable(true);
    });

    workbox.addEventListener('controlling', () => {
      window.location.reload();
    });

    workbox.register().catch((error) => {
      console.error('PWA: Service worker registration failed:', error);
    });

    return () => {
      workbox.addEventListener('installed', () => {});
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
      console.log('PWA: App installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('PWA: User accepted install');
    }
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  const applyUpdate = () => {
    if (wb) {
      wb.addEventListener('controlling', () => {
        window.location.reload();
      });
      wb.messageSkipWaiting();
    }
  };

  return (
    <PWAContext.Provider
      value={{
        isInstallable,
        isOffline,
        install,
        updateAvailable,
        applyUpdate,
        offlineReady,
      }}
    >
      {children}
    </PWAContext.Provider>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}