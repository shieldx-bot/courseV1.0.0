'use client';

import { useState, useEffect } from 'react';
import { usePWA } from '@/components/pwa-provider';
import { Smartphone, X, Check, Globe, Download } from 'lucide-react';

export function InstallPrompt() {
  const { isInstallable, install } = usePWA();
  const [dismissed, setDismissed] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isInstallable && !dismissed) {
      const timer = setTimeout(() => setShow(true), 30000);
      return () => clearTimeout(timer);
    }
  }, [isInstallable, dismissed]);

  if (!show || !isInstallable || dismissed) return null;

  const handleInstall = async () => {
    await install();
    setDismissed(true);
    setShow(false);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShow(false);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:bottom-4 md:w-96 z-50 animate-slide-up">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 p-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30">
            <Smartphone className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-neutral-900 dark:text-white">Cài đặt Ascendly</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Học offline mọi lúc, mọi nơi. Nhận thông báo khóa học mới.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 rounded"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleInstall}
            className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 transition-colors text-sm flex items-center justify-center gap-2"
          >
            <Download className="h-4 w-4" />
            Cài đặt ứng dụng
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Để sau
          </button>
        </div>
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-500 text-center">
          Hoặc thêm vào màn hình chính từ menu trình duyệt
        </p>
      </div>
    </div>
  );
}
    }
  }, []);

  useEffect(() => {
    if (isInstallable && !dismissed && !show) {
      const timer = setTimeout(() => setShow(true), 30000);
      return () => clearTimeout(timer);
    }
  }, [isInstallable, dismissed, show]);

  if (!show || dismissed || !isInstallable) return null;

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('ascendly-install-dismissed', Date.now().toString());
  };

  const handleInstall = async () => {
    await install();
    setShow(false);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:bottom-4 md:w-96 z-50 animate-slide-up">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
            <Download className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-neutral-900 dark:text-white">
              Cài đặt Ascendly
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Học offline mọi lúc, mọi nơi. Nhận thông báo khóa học mới. Truy cập nhanh như ứng dụng native.
            </p>
            <div className="flex items-center gap-2 mt-3 text-xs text-neutral-500 dark:text-neutral-500">
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                Học offline
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                Nhanh hơn
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                Thông báo
              </span>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleInstall}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
          >
            <Smartphone className="h-4 w-4" />
            Cài đặt ứng dụng
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Để sau
          </button>
        </div>
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-500 text-center">
          Hoặc thêm vào màn hình chính từ menu trình duyệt
        </p>
      </div>
    </div>
  );
}