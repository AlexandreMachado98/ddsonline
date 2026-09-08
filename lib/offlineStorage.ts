// lib/offlineStorage.ts
// Gerenciador Offline-First para Coleta de Presenças em Campo sem Internet

export interface OfflineAttendance {
  localId: string;
  meetingId: string;
  name: string;
  cpf: string; // Função / Cargo
  savedSelfie: string;
  savedSignature: string;
  timestamp: string;
  synced?: boolean;
}

const DB_NAME = 'DdsOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'offline_attendances';
const LOCALSTORAGE_QUEUE_KEY = 'dds_offline_attendances_queue';
const LOCALSTORAGE_MEETINGS_CACHE_KEY = 'dds_cached_meetings_map';

// Inicializa ou obtém conexão com IndexedDB
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB não suportado'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'localId' });
        store.createIndex('meetingId', 'meetingId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Erro ao abrir IndexedDB'));
  });
}

// Fallback: LocalStorage
function getLocalStorageQueue(): OfflineAttendance[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalStorageQueue(queue: OfflineAttendance[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCALSTORAGE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Erro ao salvar fila no LocalStorage:', e);
  }
}

/**
 * Salva uma presença no armazenamento local seguro do dispositivo (IndexedDB / LocalStorage)
 */
export async function saveOfflineAttendance(
  item: Omit<OfflineAttendance, 'localId' | 'timestamp'>
): Promise<OfflineAttendance> {
  const fullItem: OfflineAttendance = {
    ...item,
    localId: `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    synced: false
  };

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(fullItem);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB indisponível, usando fallback de LocalStorage:', err);
    const queue = getLocalStorageQueue();
    // Evita duplicatas locais
    const filtered = queue.filter(q => !(q.meetingId === fullItem.meetingId && q.name.toLowerCase() === fullItem.name.toLowerCase()));
    filtered.push(fullItem);
    saveLocalStorageQueue(filtered);
  }

  return fullItem;
}

/**
 * Retorna todas as presenças pendentes de sincronização
 */
export async function getPendingAttendances(meetingId?: string): Promise<OfflineAttendance[]> {
  let list: OfflineAttendance[] = [];

  try {
    const db = await openDatabase();
    list = await new Promise<OfflineAttendance[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    list = getLocalStorageQueue();
  }

  if (meetingId) {
    return list.filter(item => item.meetingId === meetingId);
  }

  return list;
}

/**
 * Remove uma presença da fila após envio com sucesso
 */
export async function removeOfflineAttendance(localId: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(localId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const queue = getLocalStorageQueue();
    const updated = queue.filter(item => item.localId !== localId);
    saveLocalStorageQueue(updated);
  }
}

/**
 * Cache dos dados do DDS para permitir abrir a tela no campo mesmo sem sinal
 */
export function cacheMeetingData(meeting: any): void {
  if (typeof window === 'undefined' || !meeting || !meeting.id) return;
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_MEETINGS_CACHE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[meeting.id] = {
      ...meeting,
      _cachedAt: new Date().toISOString()
    };
    map['_last_meeting_id'] = meeting.id;
    localStorage.setItem(LOCALSTORAGE_MEETINGS_CACHE_KEY, JSON.stringify(map));
  } catch (err) {
    console.error('Erro ao salvar cache de reunião:', err);
  }
}

/**
 * Recupera dados de uma reunião salvos no cache local do dispositivo
 */
export function getCachedMeetingData(meetingId?: string): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_MEETINGS_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    if (meetingId && map[meetingId]) {
      return map[meetingId];
    }
    const lastId = map['_last_meeting_id'];
    if (lastId && map[lastId]) {
      return map[lastId];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Sincroniza todas as presenças locais com o servidor na nuvem
 */
export async function syncOfflineQueue(
  meetingId?: string,
  onProgress?: (synced: number, total: number) => void
): Promise<{ success: number; failed: number; total: number }> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return { success: 0, failed: 0, total: 0 };
  }

  const pending = await getPendingAttendances(meetingId);
  if (pending.length === 0) {
    return { success: 0, failed: 0, total: 0 };
  }

  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i];

    try {
      const res = await fetch('/api/presenca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          cpf: item.cpf,
          savedSelfie: item.savedSelfie,
          savedSignature: item.savedSignature,
          meetingId: item.meetingId
        })
      });

      const data = await res.json();
      if (data.success) {
        await removeOfflineAttendance(item.localId);
        successCount++;
      } else {
        console.warn(`Falha ao sincronizar presença local ${item.name}:`, data.error);
        failedCount++;
      }
    } catch (err) {
      console.error(`Erro de rede ao sincronizar presença ${item.name}:`, err);
      failedCount++;
    }

    if (onProgress) {
      onProgress(successCount, pending.length);
    }
  }

  return {
    success: successCount,
    failed: failedCount,
    total: pending.length
  };
}
