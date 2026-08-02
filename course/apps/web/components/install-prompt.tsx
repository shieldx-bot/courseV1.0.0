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