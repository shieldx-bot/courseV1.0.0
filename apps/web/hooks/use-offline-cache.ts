import { useCallback, useState } from 'react';
import { 
  saveOfflineProgress, 
  getOfflineProgress, 
  clearOfflineProgress,
  saveOfflineNote,
  getOfflineNotes,
  clearOfflineNote,
  cacheCourseData,
  getCachedCourse,
  isCourseCached,
  clearCourseCache,
  syncOfflineData,
  requestOfflineCache,
  clearOfflineCache,
} from '@/lib/offline-db';

export function useOfflineProgress(courseId?: string) {
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const loadProgress = useCallback(async () => {
    try {
      const items = await getOfflineProgress(courseId);
      const progressMap: Record<string, number> = {};
      items.forEach(item => {
        progressMap[`${item.courseId}-${item.lessonId}`] = item.progress;
      });
      setProgress(progressMap);
    } catch (error) {
      console.error('Failed to load offline progress:', error);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  const saveProgress = useCallback(async (
    courseId: string,
    lessonId: string,
    progress: number,
    completed: boolean
  ) => {
    await saveOfflineProgress({ courseId, lessonId, progress, completed, timestamp: Date.now() });
    setProgress(prev => ({ ...prev, [`${courseId}-${lessonId}`]: progress }));
  }, []);

  const clearProgress = useCallback(async (courseId: string) => {
    await clearOfflineProgress(courseId);
    setProgress(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        if (key.startsWith(`${courseId}-`)) delete next[key];
      });
      return next;
    });
  }, []);

  return { progress, loading, saveProgress, clearProgress, refresh: loadProgress };
}

export function useOfflineNotes(lessonId?: string) {
  const [notes, setNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotes = useCallback(async () => {
    if (!lessonId) {
      setNotes([]);
      setLoading(false);
      return;
    }
    try {
      const items = await getOfflineNotes();
      const lessonNotes = items
        .filter(n => n.lessonId === lessonId)
        .map(n => n.content);
      setNotes(lessonNotes);
    } catch (error) {
      console.error('Failed to load offline notes:', error);
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  const saveNote = useCallback(async (lessonId: string, content: string) => {
    await saveOfflineNote({ lessonId, content, timestamp: Date.now() });
    if (lessonId === lessonId) {
      setNotes(prev => [...prev, content]);
    }
  }, []);

  const deleteNote = useCallback(async (noteId: number) => {
    await clearOfflineNote(noteId);
    loadNotes();
  }, [loadNotes]);

  return { notes, loading, saveNote, deleteNote, refresh: loadNotes };
}

export function useOfflineCourseCache() {
  const [cachedCourses, setCachedCourses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [caching, setCaching] = useState<string | null>(null);

  const loadCachedCourses = useCallback(async () => {
    try {
      const courses = await getAllCachedCourses();
      setCachedCourses(courses);
    } catch (error) {
      console.error('Failed to load cached courses:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const cacheCourse = useCallback(async (courseId: string) => {
    setCaching(courseId);
    try {
      await requestOfflineCache(courseId);
      setCachedCourses(prev => [...prev, courseId]);
    } catch (error) {
      console.error('Failed to cache course:', error);
    } finally {
      setCaching(null);
    }
  }, []);

  const removeCache = useCallback(async (courseId: string) => {
    await clearOfflineCache(courseId);
    setCachedCourses(prev => prev.filter(id => id !== courseId));
  }, []);

  const isCached = useCallback((courseId: string) => {
    return cachedCourses.includes(courseId);
  }, [cachedCourses]);

  return { 
    cachedCourses, 
    loading, 
    caching, 
    cacheCourse, 
    removeCache, 
    isCached,
    refresh: loadCachedCourses,
  };
}

export function useOfflineSync() {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [syncResult, setSyncResult] = useState<{ progress: number; notes: number } | null>(null);

  const sync = useCallback(async (apiBaseUrl: string, token: string) => {
    setSyncing(true);
    try {
      const result = await syncOfflineData(apiBaseUrl, token);
      setSyncResult(result);
      setLastSync(Date.now());
      return result;
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    } finally {
      setSyncing(false);
    }
  }, []);

  return { syncing, lastSync, syncResult, sync };
}

async function getAllCachedCourses(): Promise<string[]> {
  const { getAllCachedCourses } = await import('@/lib/offline-db');
  return getAllCachedCourses();
}