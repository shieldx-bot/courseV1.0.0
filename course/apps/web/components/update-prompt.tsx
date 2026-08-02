'use client';

import { useEffect, useState } from 'react';
import { usePWA } from '@/components/pwa-provider';
import { RefreshCw, X, AlertCircle } from 'lucide-react';

export function UpdatePrompt() {
  const { updateAvailable, applyUpdate, offlineReady } = usePWA();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (updateAvailable) {
      setShowPrompt(true);
    }
  }, [updateAvailable]);

  if (!showPrompt) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-down" role="alert" aria-live="polite">
      <div className="flex items-center gap-3 bg-primary-600 text-white px-4 py-3 rounded-xl shadow-lg border border-primary-700 min-w-[300px]">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">Có phiên bản mới</p>
          <p className="text-xs text-primary-100 mt-0.5">
            {offlineReady 
              ? 'Cập nhật để nhận tính năng mới và sửa lỗi.' 
              : 'Tải phiên bản mới nhất.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              applyUpdate();
              setShowPrompt(false);
            }}
            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Cập nhật
          </button>
          <button
            onClick={() => setShowPrompt(false)}
            className="p-1.5 text-white/70 hover:text-white rounded-lg transition-colors"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}