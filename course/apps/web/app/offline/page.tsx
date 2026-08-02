'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { WifiOff, RefreshCw, Home, BookOpen } from 'lucide-react';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <WifiOff className="mx-auto h-16 w-16 text-amber-500" strokeWidth={1.5} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Bạn đang ngoại tuyến</h1>
        <p className="text-gray-600 mb-8">
          Không có kết nối internet. Các bài học đã tải trước vẫn có sẵn để xem offline.
        </p>

        <div className="space-y-3">
          {isOnline ? (
            <button
              onClick={handleRetry}
              className="w-full bg-amber-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-5 w-5" />
              Kết nối đã trở lại — Tải lại trang
            </button>
          ) : (
            <>
              <button
                onClick={handleRetry}
                className="w-full bg-amber-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-5 w-5 animate-spin" />
                Thử kết nối lại
              </button>
              <Link
                href="/offline-courses"
                className="w-full block bg-white text-amber-600 border-2 border-amber-500 px-6 py-3 rounded-lg font-medium hover:bg-amber-50 transition-colors flex items-center justify-center gap-2"
              >
                <BookOpen className="h-5 w-5" />
                Xem khóa học đã tải (Offline)
              </Link>
            </>
          )}
          <Link
            href="/"
            className="w-full block text-gray-600 hover:text-gray-900 font-medium flex items-center justify-center gap-2"
          >
            <Home className="h-5 w-5" />
            Về trang chủ
          </Link>
        </div>

        <div className="mt-10 p-4 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-800">
          <p className="font-medium mb-1">Mẹo:</p>
          <p>Mở ứng dụng khi có Wi-Fi để tải trước bài học. Ascendly sẽ tự động lưu nội dung để bạn xem offline.</p>
        </div>
      </div>
    </div>
  );
}