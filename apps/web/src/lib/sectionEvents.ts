const EVENT = 'gp-work:sections-changed'

export function notifySectionsChanged(): void {
  window.dispatchEvent(new Event(EVENT))
}

export function onSectionsChanged(listener: () => void): () => void {
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
