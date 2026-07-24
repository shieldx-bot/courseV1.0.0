export interface OfflineProgress {
  id?: number;
  courseId: string;
  lessonId: string;
  progress: number;
  completed: boolean;
  timestamp: number;
}

export interface OfflineNote {
  id?: number;
  courseId: string;
  lessonId: string;
  content: string;
  timestamp: number;
}

const DB_NAME = 'ascendly-offline';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('progress')) {
          const progressStore = db.createObjectStore('progress', { keyPath: 'id', autoIncrement: true });
          progressStore.createIndex('courseId', 'courseId', { unique: false });
          progressStore.createIndex('lessonId', 'lessonId', { unique: false });
          progressStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
          notesStore.createIndex('courseId', 'courseId', { unique: false });
          notesStore.createIndex('lessonId', 'lessonId', { unique: false });
          notesStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('cachedCourses')) {
          const courseStore = db.createObjectStore('cachedCourses', { keyPath: 'courseId' });
          courseStore.createIndex('cachedAt', 'cachedAt', { unique: false });
        }
      };
    });
  }
  return dbPromise;
}

export async function saveOfflineProgress(progress: Omit<OfflineProgress, 'id'>): Promise<number> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('progress', 'readwrite');
    const store = transaction.objectStore('progress');
    const request = store.add({ ...progress, timestamp: Date.now() });
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineProgress(courseId?: string): Promise<OfflineProgress[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('progress', 'readonly');
    const store = transaction.objectStore('progress');
    
    let request: IDBRequest<OfflineProgress[]>;
    if (courseId) {
      const index = store.index('courseId');
      request = index.getAll(courseId);
    } else {
      request = store.getAll();
    }
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function clearOfflineProgress(courseId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('progress', 'readwrite');
    const store = transaction.objectStore('progress');
    const index = store.index('courseId');
    const request = index.getAllKeys(courseId);
    
    request.onsuccess = () => {
      const keys = request.result;
      keys.forEach(key => store.delete(key));
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineNote(note: Omit<OfflineNote, 'id'>): Promise<number> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('notes', 'readwrite');
    const store = transaction.objectStore('notes');
    const request = store.add({ ...note, timestamp: Date.now() });
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineNotes(courseId?: string): Promise<OfflineNote[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('notes', 'readonly');
    const store = transaction.objectStore('notes');
    
    let request: IDBRequest<OfflineNote[]>;
    if (courseId) {
      const index = store.index('courseId');
      request = index.getAll(courseId);
    } else {
      request = store.getAll();
    }
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function clearOfflineNote(id: number): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('notes', 'readwrite');
    const store = transaction.objectStore('notes');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function cacheCourseData(courseId: string, data: any): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('cachedCourses', 'readwrite');
    const store = transaction.objectStore('cachedCourses');
    const request = store.put({
      courseId,
      data,
      cachedAt: Date.now(),
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedCourse(courseId: string): Promise<any | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('cachedCourses', 'readonly');
    const store = transaction.objectStore('cachedCourses');
    const request = store.get(courseId);
    request.onsuccess = () => resolve(request.result?.data || null);
    request.onerror = () => reject(request.error);
  });
}

export async function isCourseCached(courseId: string): Promise<boolean> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('cachedCourses', 'readonly');
    const store = transaction.objectStore('cachedCourses');
    const request = store.count(courseId);
    request.onsuccess = () => resolve(request.result > 0);
    request.onerror = () => reject(request.error);
  });
}

export async function clearCourseCache(courseId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('cachedCourses', 'readwrite');
    const store = transaction.objectStore('cachedCourses');
    const request = store.delete(courseId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllCachedCourses(): Promise<string[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('cachedCourses', 'readonly');
    const store = transaction.objectStore('cachedCourses');
    const request = store.getAllKeys();
    request.onsuccess = () => resolve((request.result as string[]) || []);
    request.onerror = () => reject(request.error);
  });
}

export async function syncOfflineData(apiBaseUrl: string, token: string): Promise<{ progress: number; notes: number }> {
  let progressSynced = 0;
  let notesSynced = 0;
  
  const progressItems = await getOfflineProgress();
  for (const item of progressItems) {
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          courseId: item.courseId,
          lessonId: item.lessonId,
          progress: item.progress,
          completed: item.completed,
        }),
      });
      
      if (response.ok) {
        await clearOfflineProgress(item.courseId);
        progressSynced++;
      }
    } catch (error) {
      console.warn('Failed to sync progress:', error);
    }
  }
  
  const notes = await getOfflineNotes();
  for (const note of notes) {
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          courseId: note.courseId,
          lessonId: note.lessonId,
          content: note.content,
        }),
      });
      
      if (response.ok) {
        await clearOfflineNote(note.id!);
        notesSynced++;
      }
    } catch (error) {
      console.warn('Failed to sync note:', error);
    }
  }
  
  return { progress: progressSynced, notes: notesSynced };
}

export function registerSync(): void {
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.sync.register('sync-progress').catch(console.warn);
      registration.sync.register('sync-notes').catch(console.warn);
    });
  }
}

export function requestOfflineCache(courseId: string): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.active?.postMessage({
        type: 'CACHE_COURSE',
        courseId,
      });
    });
  }
}

export function clearOfflineCache(courseId: string): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.active?.postMessage({
        type: 'CLEAR_COURSE_CACHE',
        courseId,
      });
    });
  }
}