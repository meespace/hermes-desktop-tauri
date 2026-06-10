const store = new Map<string, string>()

const localStorageMock: Storage = {
  clear() {
    store.clear()
  },
  getItem(key) {
    return store.has(key) ? store.get(key)! : null
  },
  key(index) {
    return [...store.keys()][index] ?? null
  },
  get length() {
    return store.size
  },
  removeItem(key) {
    store.delete(key)
  },
  setItem(key, value) {
    store.set(key, String(value))
  }
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: localStorageMock
  })
}
