/*
=========================================
storage.js
Bookmark Manager
IndexedDB Wrapper
=========================================
*/

const StorageManager = (() => {

    const DB_NAME    = "BookmarkManagerDB";
    const DB_VERSION = 1;
    const STORE_BOOKMARKS = "bookmarks";
    const STORE_META      = "meta";

    let db = null;

    /* =========================================
       OPEN DATABASE
    ========================================= */

    async function init() {

        if (db) return db;

        return new Promise((resolve, reject) => {

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);

            request.onsuccess = () => {
                db = request.result;
                db.onversionchange = () => { db.close(); db = null; };
                resolve(db);
            };

            request.onupgradeneeded = event => {

                const database = event.target.result;

                if (!database.objectStoreNames.contains(STORE_BOOKMARKS)) {

                    const bookmarkStore = database.createObjectStore(
                        STORE_BOOKMARKS, { keyPath: "id" }
                    );

                    bookmarkStore.createIndex("title",  "title",  { unique: false });
                    bookmarkStore.createIndex("url",    "url",    { unique: false });
                    bookmarkStore.createIndex("folder", "folder", { unique: false });
                    bookmarkStore.createIndex("path",   "path",   { unique: false });
                }

                if (!database.objectStoreNames.contains(STORE_META)) {
                    database.createObjectStore(STORE_META, { keyPath: "key" });
                }
            };
        });
    }

    /* =========================================
       HELPERS
    ========================================= */

    function ensureDB() {
        if (!db) throw new Error("Database not initialized");
    }

    function transactionPromise(transaction) {
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve(true);
            transaction.onerror   = () => reject(transaction.error);
            transaction.onabort   = () => reject(transaction.error || new Error("Transaction aborted"));
        });
    }

    function requestToPromise(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror   = () => reject(request.error);
        });
    }

    /* =========================================
       SAVE BOOKMARKS
    ========================================= */

    async function saveBookmarks(bookmarks) {

        ensureDB();

        if (!Array.isArray(bookmarks)) {
            throw new TypeError("Bookmarks must be array");
        }

        const transaction = db.transaction(STORE_BOOKMARKS, "readwrite");
        const store = transaction.objectStore(STORE_BOOKMARKS);

        await requestToPromise(store.clear());

        for (const bookmark of bookmarks) {
            validateBookmark(bookmark);
            store.put(bookmark);
        }

        await transactionPromise(transaction);
        return true;
    }

    /* =========================================
       LOAD BOOKMARKS
    ========================================= */

    async function loadBookmarks() {

        ensureDB();

        const transaction = db.transaction(STORE_BOOKMARKS, "readonly");
        const store = transaction.objectStore(STORE_BOOKMARKS);
        return requestToPromise(store.getAll());
    }

    /* =========================================
       META
    ========================================= */

    async function setMeta(key, value) {

        ensureDB();

        const transaction = db.transaction(STORE_META, "readwrite");
        const store = transaction.objectStore(STORE_META);

        await requestToPromise(store.put({ key, value }));
        await transactionPromise(transaction);
        return true;
    }

    async function getMeta(key) {

        ensureDB();

        const transaction = db.transaction(STORE_META, "readonly");
        const store = transaction.objectStore(STORE_META);
        const result = await requestToPromise(store.get(key));
        return result ? result.value : null;
    }

    async function removeMeta(key) {

        ensureDB();

        const transaction = db.transaction(STORE_META, "readwrite");
        const store = transaction.objectStore(STORE_META);

        await requestToPromise(store.delete(key));
        await transactionPromise(transaction);
        return true;
    }

    /* =========================================
       CLEAR
    ========================================= */

    async function clearBookmarks() {

        ensureDB();

        const transaction = db.transaction(STORE_BOOKMARKS, "readwrite");
        const store = transaction.objectStore(STORE_BOOKMARKS);

        await requestToPromise(store.clear());
        await transactionPromise(transaction);
        return true;
    }

    async function clearMeta() {

        ensureDB();

        const transaction = db.transaction(STORE_META, "readwrite");
        const store = transaction.objectStore(STORE_META);

        await requestToPromise(store.clear());
        await transactionPromise(transaction);
        return true;
    }

    /* =========================================
       COUNT
    ========================================= */

    async function countBookmarks() {

        ensureDB();

        const transaction = db.transaction(STORE_BOOKMARKS, "readonly");
        const store = transaction.objectStore(STORE_BOOKMARKS);
        return requestToPromise(store.count());
    }

    async function hasBookmarks() {
        return (await countBookmarks()) > 0;
    }

    /* =========================================
       EXPORT
    ========================================= */

    async function exportData() {
        return {
            exportedAt: new Date().toISOString(),
            bookmarks:  await loadBookmarks(),
            folderTree: await getMeta("folderTree"),
            theme:      await getMeta("theme")
        };
    }

    /* =========================================
       IMPORT
    ========================================= */

    async function importData(data) {

        if (!data || typeof data !== "object") {
            throw new Error("Invalid import data");
        }

        if (!Array.isArray(data.bookmarks)) {
            throw new Error("Invalid bookmark list");
        }

        data.bookmarks.forEach(validateBookmark);
        await saveBookmarks(data.bookmarks);

        if (data.folderTree) {
            await setMeta("folderTree", data.folderTree);
        }

        if (data.theme === "light" || data.theme === "dark") {
            await setMeta("theme", data.theme);
        }

        return true;
    }

    /* =========================================
       DESTROY
    ========================================= */

    async function destroyDatabase() {

        if (db) { db.close(); db = null; }

        return new Promise((resolve, reject) => {

            const request = indexedDB.deleteDatabase(DB_NAME);

            request.onsuccess  = () => resolve(true);
            request.onerror    = () => reject(request.error);
            request.onblocked  = () => reject(new Error("Database delete blocked"));
        });
    }

    /* =========================================
       VALIDATION
    ========================================= */

    function validateBookmark(bookmark) {

        if (!bookmark || typeof bookmark !== "object") {
            throw new Error("Invalid bookmark");
        }

        if (typeof bookmark.id !== "string") {
            throw new Error("Bookmark id invalid");
        }

        if (typeof bookmark.title !== "string") {
            throw new Error("Bookmark title invalid");
        }

        if (typeof bookmark.url !== "string") {
            throw new Error("Bookmark url invalid");
        }
    }

    /* =========================================
       API
    ========================================= */

    return {
        init,
        saveBookmarks,
        loadBookmarks,
        setMeta,
        getMeta,
        removeMeta,
        clearBookmarks,
        clearMeta,
        countBookmarks,
        hasBookmarks,
        exportData,
        importData,
        destroyDatabase
    };

})();
