import type { VideoScript, CapCutTutorial } from './geminiService';

export interface ProjectData {
  blogContent: string;
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

const CURRENT_SESSION_META = 'nano_current_meta';
const CURRENT_SESSION_MEDIA = 'nano_current_media';
const HISTORY_INDEX = 'nano_history_index';

function projectMetaKey(id: string) { return `nano_proj_${id}`; }
function projectMediaKey(id: string) { return `nano_media_${id}`; }

function trySafeSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

// ── Current Session (auto-save / auto-restore) ──

export function saveCurrentSession(data: ProjectData): void {
  if (!data.videoScript) return;

  const meta = {
    blogContent: data.blogContent,
    selectedVoice: data.selectedVoice,
    videoScript: data.videoScript,
    capCutTutorial: data.capCutTutorial,
    audioDuration: data.audioDuration,
  };
  trySafeSet(CURRENT_SESSION_META, JSON.stringify(meta));

  const media = {
    generatedImages: data.generatedImages,
    audioUrl: data.audioUrl,
  };
  // Try full media, then images only, then nothing
  const mediaJson = JSON.stringify(media);
  if (!trySafeSet(CURRENT_SESSION_MEDIA, mediaJson)) {
    const imagesOnly = JSON.stringify({ generatedImages: data.generatedImages, audioUrl: null });
    if (!trySafeSet(CURRENT_SESSION_MEDIA, imagesOnly)) {
      trySafeSet(CURRENT_SESSION_MEDIA, JSON.stringify({ generatedImages: {}, audioUrl: null }));
    }
  }
}

export function loadCurrentSession(): ProjectData | null {
  try {
    const metaStr = localStorage.getItem(CURRENT_SESSION_META);
    if (!metaStr) return null;
    const meta = JSON.parse(metaStr);
    const mediaStr = localStorage.getItem(CURRENT_SESSION_MEDIA);
    const media = mediaStr ? JSON.parse(mediaStr) : { generatedImages: {}, audioUrl: null };
    return { ...meta, ...media };
  } catch {
    return null;
  }
}

export function clearCurrentSession(): void {
  localStorage.removeItem(CURRENT_SESSION_META);
  localStorage.removeItem(CURRENT_SESSION_MEDIA);
}

// ── History Index ──

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

// ── Save / Load / Delete Projects ──

export function saveProjectToHistory(data: ProjectData): { success: boolean; mediaStored: boolean } {
  if (!data.videoScript) return { success: false, mediaStored: false };

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const meta = {
    blogContent: data.blogContent,
    selectedVoice: data.selectedVoice,
    videoScript: data.videoScript,
    capCutTutorial: data.capCutTutorial,
    audioDuration: data.audioDuration,
  };

  if (!trySafeSet(projectMetaKey(id), JSON.stringify(meta))) {
    return { success: false, mediaStored: false };
  }

  // Try to store media with progressive degradation
  let mediaStored = false;
  const fullMedia = JSON.stringify({ generatedImages: data.generatedImages, audioUrl: data.audioUrl });
  if (trySafeSet(projectMediaKey(id), fullMedia)) {
    mediaStored = true;
  } else {
    const imagesOnly = JSON.stringify({ generatedImages: data.generatedImages, audioUrl: null });
    if (trySafeSet(projectMediaKey(id), imagesOnly)) {
      mediaStored = true;
    } else {
      trySafeSet(projectMediaKey(id), JSON.stringify({ generatedImages: {}, audioUrl: null }));
    }
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
    mediaStored,
  };

  const index = loadIndex();
  index.unshift(entry);
  saveIndex(index);

  return { success: true, mediaStored };
}

export function loadProjectFromHistory(id: string): ProjectData | null {
  try {
    const metaStr = localStorage.getItem(projectMetaKey(id));
    if (!metaStr) return null;
    const meta = JSON.parse(metaStr);
    const mediaStr = localStorage.getItem(projectMediaKey(id));
    const media = mediaStr ? JSON.parse(mediaStr) : { generatedImages: {}, audioUrl: null };
    return { ...meta, ...media };
  } catch {
    return null;
  }
}

export function deleteProjectFromHistory(id: string): void {
  localStorage.removeItem(projectMetaKey(id));
  localStorage.removeItem(projectMediaKey(id));
  const index = loadIndex().filter(e => e.id !== id);
  saveIndex(index);
}

export function getStorageUsageMB(): number {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!;
    total += key.length + (localStorage.getItem(key)?.length || 0);
  }
  return Math.round((total * 2) / (1024 * 1024) * 10) / 10; // UTF-16 = 2 bytes/char
}
