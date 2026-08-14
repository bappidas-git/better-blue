// Namespaced localStorage helpers.
//
// Every key is stored under the `bb.` namespace (`getItem('auth')` reads
// `bb.auth`), values are JSON-encoded, and nothing here ever throws: storage
// can be unavailable (private browsing, disabled cookies, quota exceeded, SSR),
// and a persistence failure must never break a user flow. Callers get a
// fallback value or `false` instead.

const NAMESPACE = 'bb.'

/** Full storage key for `key` — useful when debugging in devtools. */
export function namespacedKey(key) {
  return `${NAMESPACE}${key}`
}

function getStore() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    // Accessing localStorage can throw when cookies/storage are blocked.
    return null
  }
}

/** Reads and JSON-parses a value; returns `fallback` when absent or invalid. */
export function getItem(key, fallback = null) {
  const store = getStore()
  if (!store) return fallback
  try {
    const raw = store.getItem(namespacedKey(key))
    return raw === null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

/** JSON-encodes and writes a value. Returns `true` when it was persisted. */
export function setItem(key, value) {
  const store = getStore()
  if (!store) return false
  try {
    store.setItem(namespacedKey(key), JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/** Removes a single namespaced key. */
export function removeItem(key) {
  const store = getStore()
  if (!store) return false
  try {
    store.removeItem(namespacedKey(key))
    return true
  } catch {
    return false
  }
}

/** Removes every `bb.`-namespaced key, leaving other apps' keys untouched. */
export function clearNamespace() {
  const store = getStore()
  if (!store) return false
  try {
    Object.keys(store)
      .filter((key) => key.startsWith(NAMESPACE))
      .forEach((key) => store.removeItem(key))
    return true
  } catch {
    return false
  }
}

export const storage = Object.freeze({
  get: getItem,
  set: setItem,
  remove: removeItem,
  clear: clearNamespace,
  key: namespacedKey,
})
