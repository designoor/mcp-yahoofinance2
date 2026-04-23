interface Entry<V> {
  value: V;
  expiresAt: number;
}

export function ttlCache<V>(ttlMs: number) {
  const store = new Map<string, Entry<V>>();

  return {
    get(key: string): V | undefined {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= Date.now()) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key: string, value: V): void {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
  };
}
