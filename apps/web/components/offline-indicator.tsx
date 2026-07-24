'use client';

import { usePWA } from '@/components/pwa-provider';
import { WifiOff, Wifi, AlertTriangle, CheckCircle, Download, Info } from 'lucide-react';
import { useState, useEffect } from 'react';

export function OfflineIndicator() {
  const { isOffline, offlineReady, isInstallable } = usePWA();
  const [showOfflineToast, setShowOfflineToast] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (isOffline && !wasOffline) {
      setShowOfflineToast(true);
      setWasOffline(true);
      const timer = setTimeout(() => setShowOfflineToast(false), 8000);
      return () => clearTimeout(timer);
    }
    if (!isOffline && wasOffline) {
      setWasOffline(false);
      setShowOfflineToast(true);
      const timer = setTimeout(() => setShowOfflineToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isOffline, wasOffline]);

  if (!isOffline && !showOfflineToast) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${
        showOfflineToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg backdrop-blur-sm border ${
        isOffline
          ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100'
          : 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100'
      }`}>
        {isOffline ? (
          <>
            <WifiOff className="h-5 w-5 flex-shrink-0" />
            <div className="flex-1 min-w-[200px]">
              <p className="font-medium">Đang ngoại tuyến</p>
              <p className="text-sm opacity-80">
                Các bài học đã tải vẫn có sẵn. Dữ liệu sẽ đồng bộ khi có mạng.
              </p>
            </div>
            <a
              href="/offline-courses"
              className="text-sm font-medium underline hover:no-underline whitespace-nowrap"
            >
              Xem khóa học offline
            </a>
          </>
        ) : (
          <>
            <Wifi className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
            <div className="flex-1">
              <p className="font-medium">Đã kết nối lại</p>
              <p className="text-sm opacity-80">Đang đồng bộ dữ liệu...</p>
            </div>
          </>
        )}
        <button
          onClick={() => setShowOfflineToast(false)}
          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 flex-shrink-0"
          aria-label="Đóng"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function OfflineBanner() {
  const { isOffline, offlineReady } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  if (!isOffline || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-800">
            <WifiOff className="h-5 w-5 text-amber-700 dark:text-amber-300" />
          </div>
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-100">Bạn đang ngoại tuyến</p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {offlineReady
                ? 'Các khóa học đã tải vẫn có sẵn để học. Dữ liệu sẽ đồng bộ khi có kết nối.'
                : 'Kết nối internet để tải khóa học và đồng bộ tiến độ.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href="/offline-courses"
            className="px-3 py-1.5 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap"
          >
            <Download className="h-4 w-4 inline mr-1" />
            Xem offline
          </a>
          <button
            onClick={() => setDismissed(true)}
            className="p-2 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800 rounded-lg transition-colors"
            aria-label="Đóng thông báo"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export function InstallPrompt() {
  const { isInstallable, install } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  if (!isInstallable || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:bottom-4 md:w-96 z-50">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 p-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30">
            <Download className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-neutral-900 dark:text-white">Cài đặt Ascendly</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Học offline mọi lúc, mọi nơi. Nhận thông báo khóa học mới.
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 rounded"
            aria-label="Đóng"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={async () => {
              await install();
              setDismissed(true);
            }}
            className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 transition-colors text-sm"
          >
            Cài đặt ứng dụng
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="px-4 py-2 text-neutral-600 dark:text-neutral-400 font-medium hover:text-neutral-900 dark:hover:text-white text-sm"
          }
          >
            Sau
          </button>
        </div>
      </div>
    </div>
  );
}

export function UpdatePrompt() {
  const { updateAvailable, applyUpdate } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:bottom-4 md:w-96 z-50">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 p-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30">
            <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-neutral-900 dark:text-white">Có bản cập nhật mới</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Tải bản mới nhất để có tính năng tốt nhất và sửa lỗi.
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 rounded"
            aria-label="Đóng"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => {
              applyUpdate();
              setDismissed(true);
            }}
            className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 transition-colors text-sm"
          >
            Cập nhật ngay
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="px-4 py-2 text-neutral-600 dark:text-neutral-400 font-medium hover:text-neutral-900 dark:hover:text-white text-sm"
          }
          >
            Sau
          </button>
        </div>
      </div>
    </div>
  );
}