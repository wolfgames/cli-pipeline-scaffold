/**
 * Vitest global setup — runs in the main process before any test workers.
 *
 * Sets up browser-only globals that @adobe/data needs at module init time.
 * Must run before any test file imports @adobe/data.
 */
export function setup() {
  // @adobe/data blob-store has a top-level await that calls globalThis.caches.open.
  // Stub the Cache API so the module loads without crashing in the node environment.
  if (!(globalThis as any).caches) {
    const fakeCache = {
      put: () => Promise.resolve(),
      match: () => Promise.resolve(undefined),
      delete: () => Promise.resolve(false),
      keys: () => Promise.resolve([]),
    };
    (globalThis as any).caches = {
      open: () => Promise.resolve(fakeCache),
      has: () => Promise.resolve(false),
      delete: () => Promise.resolve(false),
      keys: () => Promise.resolve([]),
      match: () => Promise.resolve(undefined),
    };
  }
}
