/*
=========================================
  storage.js — Bookmark Manager
  IndexedDB wrapper
  Stores: bookmarks, meta (theme, lang,
  folderTree)
=========================================
*/

"use strict";

const StorageManager = (() => {

  const DB_NAME         = "BookmarkManagerDB";
  const DB_VERSION      = 1;
  const STORE_BOOKMARKS = "bookmarks";
  const STORE_META      = "meta";

  let db          = null;
  let initPromise = null;

  /* =========================================
     OPEN / UPGRADE DATABASE
  ========================================= */

  function init() {
    if (db)          return Promise.resolve(db);
    if (initPromise) return initPromise;

    initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        initPromise = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        db = request.result;

        db.onversionchange = () => {
          db.close();
          db          = null;
          initPromise = null;
        };

        db.onerror = e => {
          console.error("[StorageManager] db error:", e.target.error);
        };

        resolve(db);
      };

      request.onupgradeneeded = ({ target }) => {
        const database = target.result;

        if (!database.objectStoreNames.contains(STORE_BOOKMARKS)) {
          const store = database.createObjectStore(STORE_BOOKMARKS, { keyPath: "id" });
          store.createIndex("title",  "title",  { unique: false });
          store.createIndex("url",    "url",    { unique: false });
          store.createIndex("folder", "folder", { unique: false });
          store.createIndex("path",   "path",   { unique: false });
        }

        if (!database.objectStoreNames.contains(STORE_META)) {
          database.createObjectStore(STORE_META, { keyPath: "key" });
        }
      };
    });

    return initPromise;
  }

  /* =========================================
     INTERNAL HELPERS
  ========================================= */

  function _ensureDB() {
    if (!db) throw new Error("[StorageManager] Not initialized. Call init() first.");
  }

  function _txDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror    = () => reject(tx.error);
      tx.onabort    = () => reject(tx.error ?? new Error("Transaction aborted"));
    });
  }

  function _reqResult(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  function _validateBookmark(b) {
    if (!b || typeof b !== "object")
      throw new TypeError("Bookmark must be an object");
    if (typeof b.id !== "string" || !b.id.trim())
      throw new TypeError("Bookmark.id must be a non-empty string");
    if (typeof b.title !== "string")
      throw new TypeError("Bookmark.title must be a string");
    if (typeof b.url !== "string" || !b.url.trim())
      throw new TypeError("Bookmark.url must be a non-empty string");
  }

  /* =========================================
     BOOKMARKS
  ========================================= */

  async function saveBookmarks(bookmarks) {
    _ensureDB();
    if (!Array.isArray(bookmarks)) throw new TypeError("Expected an array");
    bookmarks.forEach(_validateBookmark);

    const tx    = db.transaction(STORE_BOOKMARKS, "readwrite");
    const store = tx.objectStore(STORE_BOOKMARKS);
    store.clear();
    bookmarks.forEach(b => store.put(b));
    await _txDone(tx);
    return true;
  }

  async function loadBookmarks() {
    _ensureDB();
    const tx = db.transaction(STORE_BOOKMARKS, "readonly");
    return _reqResult(tx.objectStore(STORE_BOOKMARKS).getAll());
  }

  async function addBookmark(bookmark) {
    _ensureDB();
    _validateBookmark(bookmark);
    const tx = db.transaction(STORE_BOOKMARKS, "readwrite");
    tx.objectStore(STORE_BOOKMARKS).put(bookmark);
    await _txDone(tx);
    return true;
  }

  async function updateBookmark(bookmark) {
    _ensureDB();
    _validateBookmark(bookmark);
    const tx = db.transaction(STORE_BOOKMARKS, "readwrite");
    tx.objectStore(STORE_BOOKMARKS).put(bookmark);
    await _txDone(tx);
    return true;
  }

  async function deleteBookmark(id) {
    _ensureDB();
    if (!id) throw new TypeError("id is required");
    const tx = db.transaction(STORE_BOOKMARKS, "readwrite");
    tx.objectStore(STORE_BOOKMARKS).delete(id);
    await _txDone(tx);
    return true;
  }

  async function clearBookmarks() {
    _ensureDB();
    const tx = db.transaction(STORE_BOOKMARKS, "readwrite");
    tx.objectStore(STORE_BOOKMARKS).clear();
    await _txDone(tx);
    return true;
  }

  async function countBookmarks() {
    _ensureDB();
    const tx = db.transaction(STORE_BOOKMARKS, "readonly");
    return _reqResult(tx.objectStore(STORE_BOOKMARKS).count());
  }

  async function hasBookmarks() {
    return (await countBookmarks()) > 0;
  }

  /* =========================================
     META  (theme, lang, folderTree, …)
  ========================================= */

  async function setMeta(key, value) {
    _ensureDB();
    const tx = db.transaction(STORE_META, "readwrite");
    tx.objectStore(STORE_META).put({ key, value });
    await _txDone(tx);
    return true;
  }

  async function getMeta(key) {
    _ensureDB();
    const tx     = db.transaction(STORE_META, "readonly");
    const result = await _reqResult(tx.objectStore(STORE_META).get(key));
    return result ? result.value : null;
  }

  async function removeMeta(key) {
    _ensureDB();
    const tx = db.transaction(STORE_META, "readwrite");
    tx.objectStore(STORE_META).delete(key);
    await _txDone(tx);
    return true;
  }

  async function clearMeta() {
    _ensureDB();
    const tx = db.transaction(STORE_META, "readwrite");
    tx.objectStore(STORE_META).clear();
    await _txDone(tx);
    return true;
  }

  /* =========================================
     EXPORT / IMPORT
  ========================================= */

  async function exportData() {
    return {
      exportedAt: new Date().toISOString(),
      version:    1,
      bookmarks:  await loadBookmarks(),
      folderTree: await getMeta("folderTree"),
      theme:      await getMeta("theme"),
      lang:       await getMeta("lang"),
    };
  }

  async function importData(data) {
    if (!data || typeof data !== "object") throw new Error("Invalid import data");
    if (!Array.isArray(data.bookmarks))    throw new Error("Invalid bookmark list");

    data.bookmarks.forEach(_validateBookmark);
    await saveBookmarks(data.bookmarks);

    if (data.folderTree) await setMeta("folderTree", data.folderTree);
    if (data.theme === "light" || data.theme === "dark") await setMeta("theme", data.theme);
    if (data.lang) await setMeta("lang", data.lang);

    return true;
  }

  /* =========================================
     DESTROY
  ========================================= */

  function destroyDatabase() {
    if (db) { db.close(); db = null; initPromise = null; }

    return new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve(true);
      req.onerror   = () => reject(req.error);
      req.onblocked = () => reject(new Error("Deletion blocked by open connection"));
    });
  }

  /* =========================================
     PUBLIC API
  ========================================= */

  return {
    init,
    saveBookmarks,
    loadBookmarks,
    addBookmark,
    updateBookmark,
    deleteBookmark,
    clearBookmarks,
    countBookmarks,
    hasBookmarks,
    setMeta,
    getMeta,
    removeMeta,
    clearMeta,
    exportData,
    importData,
    destroyDatabase,
  };

})();