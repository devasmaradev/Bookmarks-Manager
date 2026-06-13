"use strict";

const I18n = (() => {

  /* =========================================
     TRANSLATION DICTIONARY
  ========================================= */

  const dict = {
    en: {
      "app.title": "Bookmark Manager — Organize Your Browser Bookmarks",
      "app.name":  "Bookmark Manager",

      "action.import":            "Import",
      "action.importFile":        "Import Bookmarks",
      "action.export":            "Export JSON",
      "action.clear":             "Clear",
      "action.cancel":            "Cancel",
      "action.confirmDelete":     "Delete All",
      "action.confirmClear":      "Clear All Data",
      "action.back":              "Back",
      "action.darkMode":          "Dark",
      "action.lightMode":         "Light",
      "action.expandAll":         "Expand all",
      "action.collapseAll":       "Collapse all",
      "action.openLink":          "Open Link",
      "action.copyURL":           "Copy URL",
      "action.exportHtml":        "Export HTML",
      "action.save":              "Save",
      "action.addBookmark":       "Add Bookmark",
      "action.edit":              "Edit",
      "action.delete":            "Delete",
      "action.importOther":       "Import More",

      "sidebar.folders":      "Folders",
      "sidebar.allBookmarks": "All Bookmarks",

      "search.placeholder": "Search bookmarks…",

      "stat.totalBookmarks": "Total Bookmarks",
      "stat.totalFolders":   "Total Folders",
      "stat.uniqueDomains":  "Unique Domains",
      "stat.duplicateURLs":  "Duplicate URLs",

      "view.allBookmarks":  "All Bookmarks",
      "view.uniqueDomains": "Unique Domains",
      "view.duplicateURLs": "Duplicate URLs",

      "badge.bookmarks":  "Bookmarks",
      "badge.domains":    "Domains",
      "badge.domain":     "Domain",
      "badge.duplicates": "Duplicates",

      "panel.details":    "Details",
      "panel.title":      "Title",
      "panel.url":        "URL",
      "panel.folderPath": "Folder Path",
      "panel.dateAdded":  "Date Added",

      "dialog.confirmTitle": "Are you sure?",
      "dialog.clearDesc":    "This will permanently delete all bookmark data and cannot be undone.",
      "dialog.deleteDesc":   "This will permanently delete this bookmark and cannot be undone.",

      "loading.default":   "Loading…",
      "loading.importing": "Importing bookmarks…",

      "toast.imported":             "Imported {count} bookmarks",
      "toast.importFailed":         "Import failed. Please use a valid HTML bookmark file.",
      "toast.exported":             "Exported successfully",
      "toast.cleared":              "All data cleared",
      "toast.copied":               "URL copied",
      "toast.copyFailed":           "Copy failed",
      "toast.startFailed":          "Failed to start application",
      "toast.saved":                "Bookmark saved",
      "toast.deleted":              "Bookmark deleted",
      "toast.deleteFailed":         "Failed to delete bookmark.",
      "toast.validationTitle":      "Please enter a title.",
      "toast.validationUrl":        "Please enter a URL.",
      "toast.validationUrlInvalid": "Please enter a valid URL (https:// or http://).",
      "toast.added":                "Bookmark added",
      "toast.saveFailed":           "Failed to save bookmark.",
      "toast.savedFailed":          "Please fill in Title and URL.",
      "toast.exportedHtml":         "Exported as HTML",

      "unsaved.banner":  "You have unsaved changes — export HTML to preserve them.",
      "unsaved.dismiss": "Dismiss",

      "empty.noBookmarks":      "No bookmarks available",
      "empty.noBookmarksTitle": "No bookmarks yet",
      "empty.noBookmarksDesc":  "Import a browser bookmark HTML file to get started",
      "empty.noResults":        "No results found",
      "empty.noResultsDesc":    "Try a different search term",
      "empty.noDomains":        "No domains found",
      "empty.noDuplicates":     "No duplicates found",
      "empty.noDuplicatesDesc": "All your bookmarks have unique URLs",
      "empty.selectBookmark":   "Select a bookmark to view details",

      "count.copies": "{n} copies",

      "unit.item":      "{n} item",
      "unit.items":     "{n} items",
      "unit.bookmark":  "{n} bookmark",
      "unit.bookmarks": "{n} bookmarks",
      "unit.domain":    "{n} domain",
      "unit.domains":   "{n} domains",
      "unit.group":     "{n} group",
      "unit.groups":    "{n} groups",
      "unit.folder":    "{n} folder",
      "unit.folders":   "{n} folders",
    },

    id: {
      "app.title": "Pengelola Bookmark — Mengatur Bookmark Browser Anda",
      "app.name":  "Pengelola Bookmark",

      "action.import":            "Impor",
      "action.importFile":        "Impor Bookmark",
      "action.export":            "Ekspor JSON",
      "action.clear":             "Hapus",
      "action.cancel":            "Batal",
      "action.confirmDelete":     "Hapus Semua",
      "action.confirmClear":      "Hapus Semua Data",
      "action.back":              "Kembali",
      "action.darkMode":          "Gelap",
      "action.lightMode":         "Terang",
      "action.expandAll":         "Buka semua",
      "action.collapseAll":       "Tutup semua",
      "action.openLink":          "Buka Link",
      "action.copyURL":           "Salin URL",
      "action.exportHtml":        "Ekspor HTML",
      "action.save":              "Simpan",
      "action.addBookmark":       "Tambah Bookmark",
      "action.edit":              "Edit",
      "action.delete":            "Hapus",
      "action.importOther":       "Impor Lainnya",

      "sidebar.folders":      "Folder",
      "sidebar.allBookmarks": "Semua Bookmark",

      "search.placeholder": "Cari bookmark…",

      "stat.totalBookmarks": "Total Bookmark",
      "stat.totalFolders":   "Total Folder",
      "stat.uniqueDomains":  "Domain Unik",
      "stat.duplicateURLs":  "URL Duplikat",

      "view.allBookmarks":  "Semua Bookmark",
      "view.uniqueDomains": "Domain Unik",
      "view.duplicateURLs": "URL Duplikat",

      "badge.bookmarks":  "Bookmark",
      "badge.domains":    "Domain",
      "badge.domain":     "Domain",
      "badge.duplicates": "Duplikat",

      "panel.details":    "Detail",
      "panel.title":      "Judul",
      "panel.url":        "URL",
      "panel.folderPath": "Jalur Folder",
      "panel.dateAdded":  "Tanggal Ditambahkan",

      "dialog.confirmTitle": "Anda yakin?",
      "dialog.clearDesc":    "Ini akan menghapus semua data bookmark secara permanen dan tidak dapat dibatalkan.",
      "dialog.deleteDesc":   "Ini akan menghapus bookmark ini secara permanen dan tidak dapat dibatalkan.",

      "loading.default":   "Memuat…",
      "loading.importing": "Mengimpor bookmark…",

      "toast.imported":             "Berhasil mengimpor {count} bookmark",
      "toast.importFailed":         "Impor gagal. Gunakan file HTML bookmark yang valid.",
      "toast.exported":             "Berhasil diekspor",
      "toast.cleared":              "Semua data dihapus",
      "toast.copied":               "URL disalin",
      "toast.copyFailed":           "Gagal menyalin",
      "toast.startFailed":          "Gagal memulai aplikasi",
      "toast.saved":                "Bookmark disimpan",
      "toast.deleted":              "Bookmark dihapus",
      "toast.deleteFailed":         "Gagal menghapus bookmark.",
      "toast.added":                "Bookmark ditambahkan",
      "toast.saveFailed":           "Gagal menyimpan bookmark.",
      "toast.validationTitle":      "Harap isi judul.",
      "toast.validationUrl":        "Harap isi URL.",
      "toast.validationUrlInvalid": "URL tidak valid. Gunakan format https:// atau http://.",
      "toast.savedFailed":          "Harap isi Judul dan URL.",
      "toast.exportedHtml":         "Berhasil diekspor sebagai HTML",

      "unsaved.banner":  "Ada perubahan yang belum disimpan — ekspor HTML untuk menjaganya.",
      "unsaved.dismiss": "Tutup",

      "empty.noBookmarks":      "Tidak ada bookmark",
      "empty.noBookmarksTitle": "Belum ada bookmark",
      "empty.noBookmarksDesc":  "Impor file HTML bookmark dari browser untuk memulai",
      "empty.noResults":        "Tidak ditemukan hasil",
      "empty.noResultsDesc":    "Coba kata kunci lain",
      "empty.noDomains":        "Tidak ada domain",
      "empty.noDuplicates":     "Tidak ada duplikat",
      "empty.noDuplicatesDesc": "Semua bookmark Anda memiliki URL yang unik",
      "empty.selectBookmark":   "Pilih bookmark untuk melihat detail",

      "count.copies": "{n} salinan",

      "unit.item":      "{n} item",
      "unit.items":     "{n} item",
      "unit.bookmark":  "{n} bookmark",
      "unit.bookmarks": "{n} bookmark",
      "unit.domain":    "{n} domain",
      "unit.domains":   "{n} domain",
      "unit.group":     "{n} grup",
      "unit.groups":    "{n} grup",
      "unit.folder":    "{n} folder",
      "unit.folders":   "{n} folder",
    },
  };

  /* =========================================
     STATE
  ========================================= */

  const STORAGE_KEY = "lang";
  const SUPPORTED   = ["en", "id"];
  const DEFAULT     = "en";

  let currentLang = DEFAULT;

  /* =========================================
     INIT
  ========================================= */

  function init() {
    const stored = _readStorage();
    currentLang  = SUPPORTED.includes(stored) ? stored : _detectBrowserLang();
    _writeStorage(currentLang);
    _applyDOM();
  }

  /* =========================================
     TRANSLATE
  ========================================= */

  function t(key, vars) {
    const locale   = dict[currentLang] || dict[DEFAULT];
    const fallback = dict[DEFAULT];
    let str        = locale[key] ?? fallback[key] ?? key;

    if (vars && typeof vars === "object") {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      });
    }

    return str;
  }

  function formatCount(n, unit) {
    const key = currentLang === "id" ? `unit.${unit}` : (n === 1 ? `unit.${unit}` : `unit.${unit}s`);
    return t(key, { n: n.toLocaleString() });
  }

  /* =========================================
     LANG CONTROLS
  ========================================= */

  function getLang() {
    return currentLang;
  }

  function toggleLang() {
    const idx   = SUPPORTED.indexOf(currentLang);
    currentLang = SUPPORTED[(idx + 1) % SUPPORTED.length];
    _writeStorage(currentLang);
    _applyDOM();
  }

  function setLang(lang) {
    if (!SUPPORTED.includes(lang)) return;
    currentLang = lang;
    _writeStorage(currentLang);
    _applyDOM();
  }

  /* =========================================
     DOM APPLICATION
  ========================================= */

  function _applyDOM() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
    });

    document.querySelectorAll("[data-i18n-title]").forEach(el => {
      el.title = t(el.getAttribute("data-i18n-title"));
    });

    document.querySelectorAll("[data-i18n-aria]").forEach(el => {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
    });

    document.title            = t("app.title");
    document.documentElement.lang = currentLang;
  }

  /* =========================================
     STORAGE HELPERS
  ========================================= */

  function _readStorage() {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }

  function _writeStorage(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* non-fatal */ }
  }

  /* =========================================
     BROWSER LANGUAGE DETECTION
  ========================================= */

  function _detectBrowserLang() {
    const nav = (navigator.language || navigator.userLanguage || "").toLowerCase();
    return nav.startsWith("id") ? "id" : DEFAULT;
  }

  /* =========================================
     PUBLIC API
  ========================================= */

  return {
    init,
    t,
    formatCount,
    getLang,
    setLang,
    toggleLang,
    applyDOM: _applyDOM,
  };

})();