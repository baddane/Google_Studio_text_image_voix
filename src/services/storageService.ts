import type { VideoScript, CapCutTutorial } from './geminiService';

export interface ProjectData {
  blogContent: string;
  videoDuration: number;
  selectedVoice: string;
  videoScript: VideoScript | null;
  capCutTutorial: CapCutTutorial | null;
  audioDuration: number;
  generatedImages: Record<number, string[]>;
  audioUrl: string | null;
}

export interface HistoryEntry {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  hasScript: boolean;
  hasImages: boolean;
  hasAudio: boolean;
  hasTuto: boolean;
  imageCount: number;
  scenesCount: number;
  mediaStored: boolean;
}

// ── IndexedDB helpers (unlimited storage for media) ──

const DB_NAME = 'nano_studio';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── localStorage helpers (lightweight index & meta only) ──

const HISTORY_INDEX = 'nano_history_index';

function trySafeSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

// ── Current Session (auto-save / auto-restore via IndexedDB) ──

const CURRENT_SESSION_KEY = 'current_session';

export async function saveCurrentSession(data: ProjectData): Promise<void> {
  if (!data.videoScript) return;
  try {
    await idbPut(CURRENT_SESSION_KEY, data);
  } catch {
    // Silently fail — session restore is best-effort
  }
}

export async function loadCurrentSession(): Promise<ProjectData | null> {
  try {
    const data = await idbGet<ProjectData>(CURRENT_SESSION_KEY);
    return data && data.videoScript ? data : null;
  } catch {
    return null;
  }
}

export async function clearCurrentSession(): Promise<void> {
  try {
    await idbDelete(CURRENT_SESSION_KEY);
  } catch {
    // ignore
  }
}

// ── History Index (lightweight, stays in localStorage) ──

function loadIndex(): HistoryEntry[] {
  try {
    const str = localStorage.getItem(HISTORY_INDEX);
    return str ? JSON.parse(str) : [];
  } catch {
    return [];
  }
}

function saveIndex(entries: HistoryEntry[]) {
  trySafeSet(HISTORY_INDEX, JSON.stringify(entries));
}

export function getHistoryIndex(): HistoryEntry[] {
  return loadIndex();
}

// ── Save / Load / Delete Projects (IndexedDB for full data) ──

export async function saveProjectToHistory(data: ProjectData): Promise<{ success: boolean; mediaStored: boolean }> {
  if (!data.videoScript) return { success: false, mediaStored: false };

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    // Store full project data (meta + media) in IndexedDB — no size limit
    await idbPut(`project_${id}`, data);
  } catch {
    return { success: false, mediaStored: false };
  }

  const imageCount = Object.values(data.generatedImages).reduce((sum, imgs) => sum + imgs.filter(Boolean).length, 0);

  const entry: HistoryEntry = {
    id,
    title: data.videoScript.title,
    createdAt: now,
    updatedAt: now,
    hasScript: true,
    hasImages: imageCount > 0,
    hasAudio: !!data.audioUrl,
    hasTuto: !!data.capCutTutorial,
    imageCount,
    scenesCount: data.videoScript.scenes.length,
    mediaStored: true,
  };

  const index = loadIndex();
  index.unshift(entry);
  saveIndex(index);

  return { success: true, mediaStored: true };
}

export async function loadProjectFromHistory(id: string): Promise<ProjectData | null> {
  try {
    const data = await idbGet<ProjectData>(`project_${id}`);
    return data || null;
  } catch {
    return null;
  }
}

export async function deleteProjectFromHistory(id: string): Promise<void> {
  try {
    await idbDelete(`project_${id}`);
  } catch {
    // ignore
  }
  const index = loadIndex().filter(e => e.id !== id);
  saveIndex(index);
}

export async function getStorageUsageMB(): Promise<number> {
  try {
    const estimate = await navigator.storage.estimate();
    return Math.round((estimate.usage || 0) / (1024 * 1024) * 10) / 10;
  } catch {
    return 0;
  }
}

export async function getStorageQuotaMB(): Promise<number> {
  try {
    const estimate = await navigator.storage.estimate();
    return Math.round((estimate.quota || 0) / (1024 * 1024));
  } catch {
    return 0;
  }
}
