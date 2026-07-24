'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Play, Download, CheckCircle, AlertCircle, ChevronLeft } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

interface OfflineCourse {
  id: string;
  title: string;
  slug: string;
  thumbnail: string;
  progress: number;
  lessonsDownloaded: number;
  totalLessons: number;
  lastAccessed: string;
}

export default function OfflineCoursesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [courses, setCourses] = useState<OfflineCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const loadOfflineCourses = async () => {
      try {
        if ('caches' in window) {
          const cache = await caches.open('ascendly-offline-v1');
          const requests = await cache.keys();
          
          const courseMap = new Map<string, OfflineCourse>();
          
          for (const request of requests) {
            const url = new URL(request.url);
            if (url.pathname.startsWith('/api/v1/courses/') || url.pathname.includes('/learn/')) {
              const response = await cache.match(request);
              if (response) {
                try {
                  const data = await response.clone().json();
                  if (data.course) {
                    const course = data.course;
                    const existing = courseMap.get(course.id);
                    const lessonCount = course.lessons?.length || 0;
                    
                    if (!existing || existing.lessonsDownloaded < lessonCount) {
                      courseMap.set(course.id, {
                        id: course.id,
                        title: course.title,
                        slug: course.slug,
                        thumbnail: course.thumbnail_url || '/placeholder-course.jpg',
                        progress: 0,
                        lessonsDownloaded: lessonCount,
                        totalLessons: lessonCount,
                        lastAccessed: new Date().toISOString(),
                      });
                    }
                  }
                } catch {}
              }
            }
          }
          
          const indexedDB = window.indexedDB;
          if (indexedDB) {
            const db = await openOfflineDB();
            const progressData = await getAllProgress(db);
            progressData.forEach(p => {
              const course = courseMap.get(p.courseId);
              if (course) {
                course.progress = p.progress;
                course.lastAccessed = p.lastAccessed;
              }
            });
          }
          
          setCourses(Array.from(courseMap.values()));
        }
      } catch (error) {
        console.error('Failed to load offline courses:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadOfflineCourses();
  }, []);

  const openOfflineDB = () => {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ascendly-offline', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('progress')) {
          db.createObjectStore('progress', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('notes')) {
          db.createObjectStore('notes', { keyPath: 'id' });
        }
      };
    });
  };

  const getAllProgress = async (db: IDBDatabase) => {
    return new Promise<any[]>((resolve, reject) => {
      const transaction = db.transaction('progress', 'readonly');
      const store = transaction.objectStore('progress');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Hôm nay';
    if (days === 1) return 'Hôm qua';
    if (days < 7) return `${days} ngày trước`;
    return date.toLocaleDateString('vi-VN');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-0 dark:bg-neutral-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-0 dark:bg-neutral-950">
      <header className="sticky top-0 z-40 bg-neutral-0/80 dark:bg-neutral-950/80 backdrop-blur-sm border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="Quay lại"
            >
              <ChevronLeft className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
            </button>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Khóa học Offline</h1>
            <div className="w-10" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isOnline && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">Bạn đang offline</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Chỉ hiển thị khóa học đã tải trước. Kết nối internet để tải thêm nội dung.
              </p>
            </div>
          </div>
        )}

        {courses.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="h-16 w-16 text-neutral-300 dark:text-neutral-700 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
              Chưa có khóa học offline
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6 max-w-md mx-auto">
              Mở khóa học khi có internet để Ascendly tự động tải nội dung. Sau đó bạn có thể học mọi lúc, mọi nơi không cần mạng.
            </p>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              <BookOpen className="h-5 w-5" />
              Khám phá khóa học
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {courses.map((course) => (
              <article
                key={course.id}
                className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="relative aspect-video bg-neutral-100 dark:bg-neutral-800">
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Link
                      href={`/learn/${course.slug}`}
                      className="p-3 bg-white/90 dark:bg-neutral-900/90 rounded-full backdrop-blur-sm hover:bg-white dark:hover:bg-neutral-900 transition-colors"
                      aria-label={`Tiếp tục học ${course.title}`}
                    >
                      <Play className="h-6 w-6 text-neutral-900 dark:text-white ml-1" />
                    </Link>
                  </div>
                  <div className="absolute bottom-2 right-2">
                    <span className="bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium">
                      {course.lessonsDownloaded}/{course.totalLessons} bài
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-neutral-900 dark:text-white line-clamp-2 mb-2">
                    {course.title}
                  </h3>
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-neutral-600 dark:text-neutral-400">Tiến độ</span>
                      <span className="font-medium text-neutral-900 dark:text-white">{course.progress}%</span>
                    </div>
                    <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full transition-all duration-300"
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      {course.lessonsDownloaded} bài đã tải
                    </span>
                    <span>Lần xem: {formatDate(course.lastAccessed)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {isOnline && courses.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              Muốn tải thêm khóa học? Mở khóa học khi online để Ascendly tự động lưu nội dung.
            </p>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 font-medium hover:text-primary-700 dark:hover:text-primary-300"
            >
              <BookOpen className="h-5 w-5" />
              Xem thêm khóa học
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}