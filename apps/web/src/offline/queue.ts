import { apiRequest } from '@/api/client'
import { addExecutionPhotos, newClientId } from '@/api/fieldApi'
import { uploadWorkPhotos } from '@/api/uploadsApi'

const DB_NAME = 'gp-work-field-v1'
const STORE = 'operations'

export type QueueItem =
  | {
      id: string
      kind: 'REQUEST'
      path: string
      method: string
      body: Record<string, unknown>
      createdAt: string
      attempts: number
      lastError?: string
    }
  | {
      id: string
      kind: 'PHOTO'
      executionId: number
      clientPhotoId: string
      phase: 'BEFORE' | 'AFTER' | 'ISSUE'
      file: Blob
      fileName: string
      capturedAt: string
      latitude?: number
      longitude?: number
      createdAt: string
      attempts: number
      lastError?: string
    }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = action(tx.objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}

export async function listQueued(): Promise<QueueItem[]> {
  const rows = await transact<QueueItem[]>('readonly', (store) => store.getAll())
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function queueRequest(path: string, method: string, body: Record<string, unknown>) {
  const item: QueueItem = { id: newClientId(), kind: 'REQUEST', path, method, body, createdAt: new Date().toISOString(), attempts: 0 }
  return transact('readwrite', (store) => store.put(item))
}

export function queuePhoto(input: Omit<Extract<QueueItem, { kind: 'PHOTO' }>, 'id' | 'kind' | 'createdAt' | 'attempts'>) {
  const item: QueueItem = { ...input, id: newClientId(), kind: 'PHOTO', createdAt: new Date().toISOString(), attempts: 0 }
  return transact('readwrite', (store) => store.put(item))
}

async function removeQueued(id: string) {
  await transact('readwrite', (store) => store.delete(id))
}

async function saveQueued(item: QueueItem) {
  await transact('readwrite', (store) => store.put(item))
}

export async function processQueue(): Promise<{ sent: number; remaining: number }> {
  if (!navigator.onLine) return { sent: 0, remaining: (await listQueued()).length }
  const items = await listQueued()
  let sent = 0
  for (const item of items) {
    try {
      if (item.kind === 'REQUEST') {
        await apiRequest(item.path, { method: item.method, body: JSON.stringify(item.body) })
      } else {
        const file = new File([item.file], item.fileName, { type: item.file.type || 'image/jpeg' })
        const [url] = await uploadWorkPhotos([file])
        await addExecutionPhotos(item.executionId, {
          photos: [{
            clientPhotoId: item.clientPhotoId,
            phase: item.phase,
            url,
            capturedAt: item.capturedAt,
            latitude: item.latitude,
            longitude: item.longitude,
          }],
        })
      }
      await removeQueued(item.id)
      sent += 1
    } catch (error) {
      item.attempts += 1
      item.lastError = error instanceof Error ? error.message : String(error)
      await saveQueued(item)
      break
    }
  }
  return { sent, remaining: (await listQueued()).length }
}
