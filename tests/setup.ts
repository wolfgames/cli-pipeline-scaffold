/**
 * Vitest global test setup.
 *
 * Stubs browser-only globals that @adobe/data references at module load time
 * in the node test environment.
 */

// @adobe/data BlobStore's serialize-to-storage calls globalThis.caches.open()
// and indexedDB.open() at top-level await. Provide minimal stubs so the
// module loads without crashing under node.
const noop = () => undefined;

if (!(globalThis as any).caches) {
  (globalThis as any).caches = {
    open: () => Promise.resolve({
      put: () => Promise.resolve(),
      match: () => Promise.resolve(undefined),
      delete: () => Promise.resolve(false),
      keys: () => Promise.resolve([]),
    }),
    has: () => Promise.resolve(false),
    delete: () => Promise.resolve(false),
    keys: () => Promise.resolve([]),
    match: () => Promise.resolve(undefined),
  };
}

if (!(globalThis as any).indexedDB) {
  const fakeReq = { result: null, onsuccess: noop, onerror: noop, onupgradeneeded: noop };
  (globalThis as any).indexedDB = {
    open: () => fakeReq,
    deleteDatabase: () => fakeReq,
  };
}
