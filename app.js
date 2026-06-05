/*
=========================================
  app.js — Bookmark Manager
  Main application controller.
  Coordinates: I18n, StorageManager,
  BookmarkParser, FolderTree
=========================================
*/

"use strict";

/* =========================================
   APPLICATION STATE
========================================= */

let _bookmarks        = [];
let _folderTree       = null;
let _selectedBookmark = null;
let _activeFolder     = "ALL";
let _currentView      = "bookmarks"; /* "bookmarks" | "domains" | "duplicates" */
let _detailsPanelOpen = false;
let _toastTimer       = null;
let _searchDebounce   = null;
let _crudTarget       = null; /* bookmark being edited, or null for add */
let _deleteTarget     = null; /* bookmark pending delete confirmation */
let _hasUnsavedChanges = false;

/* =========================================
   BOOTSTRAP
========================================= */

document.addEventListener("DOMContentLoaded", _init);

async function _init() {
  try {
    I18n.init();
    _showLoading(true);
    await StorageManager.init();
    _bindEvents();
    await _loadSavedData();
    await _applyTheme();
    _updateLangButton();
  } catch (err) {
    console.error("[app] init error:", err);
    showToast(I18n.t("toast.startFailed"), "error");
  } finally {
    _showLoading(false);
  }
}

/* =========================================
   ELEMENT HELPER
========================================= */

function _el(id) {
  return document.getElementById(id);
}

/* =========================================
   EVENT BINDING
========================================= */

function _bindEvents() {

  /* Import — topbar label + empty-state CTA */
  _el("bookmarkFile").addEventListener("change",    _handleImport);
  _el("bookmarkFileCta").addEventListener("change", _handleImport);

  /* Search */
  const searchInput = _el("searchInput");
  const searchClear = _el("searchClear");

  searchInput.addEventListener("input", () => {
    searchClear.hidden = !searchInput.value;
    clearTimeout(_searchDebounce);
    _searchDebounce = setTimeout(() => {
      if (_currentView === "bookmarks") _renderBookmarks();
    }, 180);
  });

  searchClear.addEventListener("click", () => {
    searchInput.value  = "";
    searchClear.hidden = true;
    if (_currentView !== "bookmarks") _backToBookmarks();
    else _renderBookmarks();
    searchInput.focus();
  });

  /* Topbar actions */

  /* Export JSON button is optional */
  const btnExportJson = _el("btnExportJson");
  if (btnExportJson) {
    btnExportJson.addEventListener("click", _exportJSON);
  }

  const btnExportHtml = _el("btnExportHtml");
  if (btnExportHtml) {
    btnExportHtml.addEventListener("click", _exportHTML);
  }

  _el("btnClearData").addEventListener("click", _requestClearData);
  _el("btnTheme").addEventListener("click", _toggleTheme);
  _el("btnLang").addEventListener("click", _toggleLang);
  _el("btnAddBookmark").addEventListener("click", () => _openCrudModal(null));

  /* Unsaved banner dismiss */
  _el("unsavedBannerDismiss").addEventListener("click", () => {
    _el("unsavedBanner").hidden = true;
  });

  /* Stat cards */
  const domainsCard    = _el("domainsCard");
  const duplicatesCard = _el("duplicatesCard");

  domainsCard.addEventListener("click",   _showDomains);
  duplicatesCard.addEventListener("click", _showDuplicates);

  domainsCard.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); _showDomains(); }
  });
  duplicatesCard.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); _showDuplicates(); }
  });

  /* View controls */
  _el("btnBackToBookmarks").addEventListener("click", _backToBookmarks);
  _el("expandAllBtn").addEventListener("click",   () => FolderTree.expandAll());
  _el("collapseAllBtn").addEventListener("click", () => FolderTree.collapseAll());

  /* Mobile / responsive */
  _el("mobileMenuBtn").addEventListener("click", _toggleMobileSidebar);
  _el("mobileOverlay").addEventListener("click", () => {
    _closeMobileSidebar();
    _closeDetailsPanel();
  });
  _el("closePanelBtn").addEventListener("click", _closeDetailsPanel);

/* Confirm dialog */
  _el("dialogCancel").addEventListener("click", _hideDialog);
  _el("dialogConfirm").addEventListener("click", () => {
    if (_deleteTarget) {
      const target  = _deleteTarget;
      _deleteTarget = null;
      _hideDialog();
      _executeDeleteBookmark(target);
    } else {
      _hideDialog();
      _executeClearData();
    }
  });

  /* Dialog backdrop — click outside to close */
  _el("confirmDialog").addEventListener("click", e => {
    if (e.target === _el("confirmDialog")) _hideDialog();
  });

  /* CRUD modal */
  _el("crudCancelBtn").addEventListener("click", _closeCrudModal);
  _el("crudSaveBtn").addEventListener("click",   _handleCrudSave);
  _el("crudModal").addEventListener("click", e => {
    if (e.target === _el("crudModal")) _closeCrudModal();
  });

  /* Folder tree */
  FolderTree.init(_el("folderTree"), _onFolderSelected);

  /* Global keyboard shortcuts */
  document.addEventListener("keydown", _handleKeyboard);
}

/* =========================================
   UNSAVED CHANGES INDICATOR
   Called after any mutating action:
   add, edit, delete bookmark.
   Cleared after export.
========================================= */

function _markUnsaved() {
  _hasUnsavedChanges = true;
  StorageManager.setMeta("hasUnsaved", true).catch(() => {});
  _applyUnsavedUI(true);
}

function _clearUnsaved() {
  _hasUnsavedChanges = false;
  StorageManager.setMeta("hasUnsaved", false).catch(() => {});
  _applyUnsavedUI(false);
}

function _applyUnsavedUI(hasUnsaved) {
  /* Banner */
  const banner = _el("unsavedBanner");
  if (banner) {
    if (hasUnsaved) {
      _el("unsavedBannerText").textContent = I18n.t("unsaved.banner");
      _el("unsavedBannerDismiss").title    = I18n.t("unsaved.dismiss");
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }
  }

  /* Dot on Export HTML button */
  const btnExport = _el("btnExportHtml");
  if (btnExport) {
    btnExport.querySelectorAll(".btn-unsaved-dot").forEach(d => d.remove());
    if (hasUnsaved && !btnExport.querySelector(".btn-unsaved-dot")) {
      const dot = document.createElement("span");
      dot.className = "btn-unsaved-dot";
      dot.setAttribute("aria-hidden", "true");
      btnExport.appendChild(dot);
    }
  }
}

/* =========================================
   FOLDER SELECTION CALLBACK
   Passed to FolderTree.init() as the callback.
========================================= */

function _onFolderSelected(path) {
  _activeFolder = path;
  _currentView  = "bookmarks";
  _updateAddBookmarkBtn();
  _updateViewBadge(I18n.t("badge.bookmarks"));
  _el("btnBackToBookmarks").hidden = true;
  _renderBookmarks();
  _closeMobileSidebar();
  StorageManager.setMeta("activeFolder", path).catch(() => {});
}

function _updateAddBookmarkBtn() {
  const btn = _el("btnAddBookmark");
  if (!btn) return;
  const isAll = _activeFolder === "ALL";
  btn.disabled = isAll;
  btn.title    = isAll ? (I18n.getLang() === "id"
    ? "Pilih folder terlebih dahulu untuk menambahkan bookmark"
    : "Select a folder first to add a bookmark") : "";
}

/* =========================================
   KEYBOARD SHORTCUTS
========================================= */

function _handleKeyboard(e) {
  /* Escape — close panels in priority order */
  if (e.key === "Escape") {
    if (!_el("crudModal").hidden)          { _closeCrudModal(); return; }
    if (!_el("confirmDialog").hidden)      { _hideDialog(); return; }
    if (_detailsPanelOpen)                 { _closeDetailsPanel(); return; }
    _closeMobileSidebar();
    return;
  }

  /* Ctrl/Cmd + F — focus search */
  if ((e.ctrlKey || e.metaKey) && e.key === "f") {
    e.preventDefault();
    const inp = _el("searchInput");
    inp.focus();
    inp.select();
  }
}

/* =========================================
   MOBILE SIDEBAR
========================================= */

function _toggleMobileSidebar() {
  _el("sidebar").classList.contains("open")
    ? _closeMobileSidebar()
    : _openMobileSidebar();
}

function _openMobileSidebar() {
  _el("sidebar").classList.add("open");
  _el("mobileOverlay").classList.add("visible");
  _el("mobileOverlay").removeAttribute("aria-hidden");
  _el("mobileMenuBtn").setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden";
}

function _closeMobileSidebar() {
  _el("sidebar").classList.remove("open");
  _el("mobileOverlay").classList.remove("visible");
  _el("mobileOverlay").setAttribute("aria-hidden", "true");
  _el("mobileMenuBtn").setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
}

/* =========================================
   DETAILS PANEL
   Floating modal on viewports <= 1200px
   (matches CSS @media max-width: 1200px)
========================================= */

function _openDetailsPanel(bookmark) {
  _showBookmarkDetails(bookmark);

  if (window.innerWidth <= 1200) {
    _el("detailsPanel").classList.add("mobile-open");
    _el("mobileOverlay").classList.add("visible");
    _el("mobileOverlay").removeAttribute("aria-hidden");
    _detailsPanelOpen = true;
    document.body.style.overflow = "hidden";
  }
}

function _closeDetailsPanel() {
  if (!_detailsPanelOpen) return;
  _el("detailsPanel").classList.remove("mobile-open");
  _el("mobileOverlay").classList.remove("visible");
  _el("mobileOverlay").setAttribute("aria-hidden", "true");
  _detailsPanelOpen = false;
  document.body.style.overflow = "";
}

/* =========================================
   CONFIRM DIALOG
========================================= */

function _showDialog(descKey = "dialog.clearDesc") {
  _el("dialogDesc").textContent    = I18n.t(descKey);
  _el("confirmDialog").hidden      = false;
  document.body.style.overflow     = "hidden";
  _el("dialogCancel").focus();
}

function _hideDialog() {
  _el("confirmDialog").hidden  = true;
  document.body.style.overflow = "";
  _deleteTarget                = null;
}

/* =========================================
   UNSAVED CHANGES INDICATOR
   _markUnsaved() — dipanggil setiap ada
   mutasi: add, edit, delete.
   _clearUnsaved() — dipanggil setelah export
   atau clear.
========================================= */

function _markUnsaved() {
  _hasUnsavedChanges = true;
  StorageManager.setMeta("hasUnsaved", true).catch(() => {});
  _applyUnsavedUI(true);
}

function _clearUnsaved() {
  _hasUnsavedChanges = false;
  StorageManager.setMeta("hasUnsaved", false).catch(() => {});
  _applyUnsavedUI(false);
}

function _applyUnsavedUI(hasUnsaved) {
  const banner = _el("unsavedBanner");
  if (banner) {
    if (hasUnsaved) {
      _el("unsavedBannerText").textContent = I18n.t("unsaved.banner");
      _el("unsavedBannerDismiss").title    = I18n.t("unsaved.dismiss");
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }
  }

  const btnExport = _el("btnExportHtml");
  if (btnExport) {
    btnExport.querySelectorAll(".btn-unsaved-dot").forEach(d => d.remove());
    if (hasUnsaved) {
      const dot = document.createElement("span");
      dot.className = "btn-unsaved-dot";
      dot.setAttribute("aria-hidden", "true");
      btnExport.appendChild(dot);
    }
  }
}

/* =========================================
   LOADING OVERLAY
   #loadingOverlay visibility via [hidden] attr
========================================= */

function _showLoading(visible, messageKey = "loading.default") {
  const overlay = _el("loadingOverlay");
  overlay.hidden = !visible;
  if (visible) {
    const text = overlay.querySelector(".loading-text");
    if (text) text.textContent = I18n.t(messageKey);
  }
}

/* =========================================
   TOAST
   Manages a single toast at a time.
   Types: "success" | "error" | "info"
========================================= */

function showToast(message, type = "success") {
  const container = _el("toastContainer");
  clearTimeout(_toastTimer);

  const existing = container.querySelector(".toast");
  if (existing) existing.remove();

  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>`,
  };

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role",      "status");
  toast.setAttribute("aria-live", "polite");
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-msg">${_escapeHTML(message)}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));

  _toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 3200);
}

/* =========================================
   IMPORT
========================================= */

async function _handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!/\.(html?|htm)$/i.test(file.name)) {
    showToast(I18n.t("toast.importFailed"), "error");
    event.target.value = "";
    return;
  }

  try {
    _showLoading(true, "loading.importing");

    const text   = await file.text();
    const result = BookmarkParser.parse(text);

    _bookmarks        = result.bookmarks;
    _folderTree       = result.tree;
    _selectedBookmark = null;
    _activeFolder     = "ALL";

    await StorageManager.saveBookmarks(_bookmarks);
    await StorageManager.setMeta("folderTree", _folderTree);
    await StorageManager.setMeta("activeFolder", "ALL");

    _updateStats();
    FolderTree.setActivePath("ALL");
    FolderTree.render(_folderTree);

    _currentView = "bookmarks";
    _el("btnBackToBookmarks").hidden = true;
    _updateViewBadge(I18n.t("badge.bookmarks"));
    _renderBookmarks();
    _updateImportButtonVisibility();

    showToast(I18n.t("toast.imported", { count: _bookmarks.length.toLocaleString() }));
  } catch (err) {
    console.error("[app] import error:", err);
    showToast(I18n.t("toast.importFailed"), "error");
  } finally {
    _showLoading(false);
    event.target.value = "";
  }
}

/* =========================================
   IMPORT BUTTON VISIBILITY
   Topbar Import: hidden when no bookmarks
   Empty-state CTA: shown when no bookmarks
========================================= */

function _updateImportButtonVisibility() {
  const hasData = _bookmarks.length > 0;
  const topbarBtn = _el("topbarImportBtn");
  const labelSpan = topbarBtn?.querySelector(".btn-label");

  if (topbarBtn) {
    topbarBtn.hidden = !hasData;
    if (labelSpan && hasData) {
      labelSpan.textContent = I18n.t("action.importOther");
      labelSpan.setAttribute("data-i18n", "action.importOther");
    }
  }

  const btnAdd    = _el("btnAddBookmark");
  const btnExport = _el("btnExportHtml");
  const btnClear  = _el("btnClearData");

  if (btnAdd)    btnAdd.hidden    = !hasData;
  if (btnExport) btnExport.hidden = !hasData;
  if (btnClear)  btnClear.hidden  = !hasData;

  if (hasData) _updateAddBookmarkBtn();
}

/* =========================================
   LOAD SAVED DATA
========================================= */

async function _loadSavedData() {
  _bookmarks  = await StorageManager.loadBookmarks();
  _folderTree = await StorageManager.getMeta("folderTree");

  if (!_folderTree) {
    _folderTree = {
      id:       _uuid(),
      name:     "ROOT",
      path:     "",
      count:    0,
      children: [],
    };
  }

  const savedUnsaved = await StorageManager.getMeta("hasUnsaved");
  _hasUnsavedChanges = savedUnsaved === true;
  _applyUnsavedUI(_hasUnsavedChanges);

  _updateStats();
  FolderTree.render(_folderTree);
  _renderBookmarks();
  _updateImportButtonVisibility();
}

/* =========================================
   STATS
========================================= */

function _updateStats() {
  _el("statBookmarks").textContent  = _bookmarks.length.toLocaleString();
  _el("statFolders").textContent    = new Set(_bookmarks.map(b => b.path)).size.toLocaleString();
  _el("statDomains").textContent    = BookmarkParser.countUniqueDomains(_bookmarks).toLocaleString();
  _el("statDuplicates").textContent = BookmarkParser.countDuplicates(_bookmarks).toLocaleString();
}

/* =========================================
   RENDER BOOKMARKS (main view)
========================================= */

function _renderBookmarks() {
  const keyword  = _el("searchInput").value;
  const filtered = BookmarkParser
    .searchBookmarks(_bookmarks, keyword)
    .filter(b =>
      _activeFolder === "ALL" ||
      b.path === _activeFolder ||
      b.path.startsWith(_activeFolder + "/")
    );

  _el("currentFolderName").textContent =
    _activeFolder === "ALL" ? I18n.t("view.allBookmarks") : _activeFolder;

  _el("bookmarkCount").textContent = I18n.formatCount(filtered.length, "item");

  _renderBookmarkList(filtered);
}

/* =========================================
   VIEW NAVIGATION
========================================= */

function _backToBookmarks() {
  _currentView  = "bookmarks";
  _activeFolder = "ALL";
  _el("btnBackToBookmarks").hidden = true;
  _updateViewBadge(I18n.t("badge.bookmarks"));
  FolderTree.setActivePath("ALL");
  _renderBookmarks();
  StorageManager.setMeta("activeFolder", "ALL").catch(() => {});
}

function _updateViewBadge(label) {
  _el("viewBadge").textContent = label;
}

/* =========================================
   RENDER BOOKMARK LIST
========================================= */

function _renderBookmarkList(items) {
  const container = _el("bookmarkContainer");
  container.innerHTML = "";

  if (!items.length && !_bookmarks.length) {
    /* Truly empty — show full empty state with import CTA */
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "empty-state large";
    emptyDiv.innerHTML = `
      <div class="empty-illustration" aria-hidden="true">
        <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="80" height="80" rx="20" fill="currentColor" fill-opacity="0.06"/>
          <path d="M52 20H28a4 4 0 0 0-4 4v32l16-10 16 10V24a4 4 0 0 0-4-4z"
            stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round" stroke-opacity="0.3"/>
        </svg>
      </div>
      <p class="empty-title">${_escapeHTML(I18n.t("empty.noBookmarksTitle"))}</p>
      <p class="empty-desc">${_escapeHTML(I18n.t("empty.noBookmarksDesc"))}</p>
      <label class="btn btn-primary empty-cta" role="button" tabindex="0"
        aria-label="Import bookmarks file">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <span>${_escapeHTML(I18n.t("action.importFile"))}</span>
        <input type="file" accept=".html,.htm" hidden aria-label="Choose bookmark HTML file"
          id="bookmarkFileCtaDynamic">
      </label>
    `;
    /* Bind the dynamically created file input */
    const dynInput = emptyDiv.querySelector("#bookmarkFileCtaDynamic");
    if (dynInput) dynInput.addEventListener("change", _handleImport);
    container.appendChild(emptyDiv);
    return;
  }

  if (!items.length) {
    container.appendChild(_buildEmptyState(
      "search",
      I18n.t("empty.noResults"),
      I18n.t("empty.noResultsDesc")
    ));
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach(bookmark => fragment.appendChild(_createBookmarkNode(bookmark)));
  container.appendChild(fragment);
}

/* =========================================
   BOOKMARK ITEM NODE
   Uses <template id="bookmarkTemplate">
========================================= */

function _createBookmarkNode(bookmark) {
  const template   = _el("bookmarkTemplate");
  const clone      = template.content.cloneNode(true);
  const root       = clone.querySelector(".bookmark-item");
  const faviconImg = clone.querySelector(".bookmark-favicon");
  const faviconFb  = clone.querySelector(".bookmark-favicon-fallback");
  const domain     = BookmarkParser.getDomain(bookmark.url);

  /* Favicon */
  if (domain) {
    faviconImg.src = _faviconURL(domain);
    faviconImg.alt = domain;
    faviconImg.onerror = () => {
      faviconImg.style.display = "none";
      faviconFb.style.display  = "flex";
    };
  } else {
    faviconImg.style.display = "none";
    faviconFb.style.display  = "flex";
  }

  /* Text */
  clone.querySelector(".bookmark-title").textContent = bookmark.title;
  clone.querySelector(".bookmark-url").textContent   = bookmark.url;

  /* Chips */
  const domainChip = clone.querySelector(".chip-domain");
  const folderChip = clone.querySelector(".chip-folder");

  if (domain) {
    domainChip.textContent = domain;
  } else {
    domainChip.style.display = "none";
  }

  if (bookmark.path) {
    folderChip.textContent = bookmark.path;
    folderChip.title       = bookmark.path;
  } else {
    folderChip.style.display = "none";
  }

  root.setAttribute("aria-label", bookmark.title);

  /* Open in new tab */
  clone.querySelector(".bookmark-open-btn").addEventListener("click", e => {
    e.stopPropagation();
    _openURL(bookmark.url);
  });

  /* Edit button */
  clone.querySelector(".bookmark-edit-btn").addEventListener("click", e => {
    e.stopPropagation();
    _openCrudModal(bookmark);
  });

  /* Delete button */
  clone.querySelector(".bookmark-delete-btn").addEventListener("click", e => {
    e.stopPropagation();
    _deleteBookmark(bookmark);
  });

  /* Select → open details */
  root.addEventListener("click", () => {
    document.querySelectorAll(".bookmark-item.active")
      .forEach(n => n.classList.remove("active"));
    root.classList.add("active");
    _openDetailsPanel(bookmark);
  });

  root.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); root.click(); }
  });

  return clone;
}

/* =========================================
   BOOKMARK DETAILS PANEL
   Content rendered directly as innerHTML.
   All class names match style.css.
========================================= */

function _showBookmarkDetails(bookmark) {
  _selectedBookmark = bookmark;

  const panel  = _el("bookmarkDetails");
  const domain = BookmarkParser.getDomain(bookmark.url);
  const href   = _isSafeURL(bookmark.url) ? bookmark.url : "#";
  const added  = new Date(bookmark.addDate).toLocaleString(undefined, {
    year:   "numeric",
    month:  "short",
    day:    "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });

  panel.innerHTML = `
    <div class="detail-section">
      <div class="detail-favicon-row">
        <div class="detail-favicon-wrap">
          <img id="detailFaviconImg"
            class="detail-favicon"
            src="${_faviconURL(domain)}"
            alt="${_escapeHTML(domain)}"
            loading="lazy"
            width="28"
            height="28">
          <svg id="detailFaviconFb"
            class="detail-favicon-fb"
            style="display:none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        </div>
        <span class="detail-domain">${_escapeHTML(domain || "—")}</span>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-label">${I18n.t("panel.title")}</div>
      <div class="detail-value">${_escapeHTML(bookmark.title)}</div>
    </div>

    <div class="detail-section">
      <div class="detail-label">${I18n.t("panel.url")}</div>
      <div class="detail-value">
        <a href="${_escapeHTML(href)}"
          target="_blank"
          rel="noopener noreferrer"
          class="detail-url-link"
          title="${_escapeHTML(bookmark.url)}">
          ${_escapeHTML(bookmark.url)}
        </a>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-label">${I18n.t("panel.folderPath")}</div>
      <div class="detail-value">${_escapeHTML(bookmark.path || "—")}</div>
    </div>

    <div class="detail-section">
      <div class="detail-label">${I18n.t("panel.dateAdded")}</div>
      <div class="detail-value">${_escapeHTML(added)}</div>
    </div>

    <div class="detail-actions">
      <button id="detailOpenBtn" class="btn btn-primary detail-btn">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        ${I18n.t("action.openLink")}
      </button>
      <button id="detailCopyBtn" class="btn btn-secondary detail-btn">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        ${I18n.t("action.copyURL")}
      </button>
      <button id="detailEditBtn" class="btn btn-secondary detail-btn">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        ${I18n.t("action.edit")}
      </button>
    </div>
  `;

  /* Favicon fallback */
  const fImg = panel.querySelector("#detailFaviconImg");
  const fFb  = panel.querySelector("#detailFaviconFb");
  if (fImg) {
    fImg.onerror = () => {
      fImg.style.display = "none";
      fFb.style.display  = "block";
    };
  }

  /* Actions */
  panel.querySelector("#detailOpenBtn").addEventListener("click",
    () => _openURL(bookmark.url)
  );

  panel.querySelector("#detailCopyBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(bookmark.url);
      showToast(I18n.t("toast.copied"));
    } catch {
      showToast(I18n.t("toast.copyFailed"), "error");
    }
  });

  panel.querySelector("#detailEditBtn").addEventListener("click",
    () => _openCrudModal(bookmark)
  );
}

/* =========================================
   CRUD MODAL
   null = Add mode, bookmark object = Edit mode
========================================= */

function _openCrudModal(bookmark) {
  _crudTarget = bookmark;

  const isEdit = bookmark !== null;
  _el("crudModalTitle").textContent = isEdit
    ? I18n.t("action.edit")
    : I18n.t("action.addBookmark");

  const defaultPath = (!isEdit && _activeFolder !== "ALL") ? _activeFolder : "";

  _el("crudInputTitle").value = isEdit ? (bookmark.title || "") : "";
  _el("crudInputUrl").value   = isEdit ? (bookmark.url   || "") : "";

  const pathInput = _el("crudInputPath");
  pathInput.value    = isEdit ? (bookmark.path || "") : defaultPath;
  pathInput.readOnly = true;

  _el("crudSaveBtn").textContent   = I18n.t("action.save");
  _el("crudCancelBtn").textContent = I18n.t("action.cancel");

  _el("crudModal").hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => _el("crudInputTitle").focus(), 50);
}

function _closeCrudModal() {
  _el("crudModal").hidden = true;
  document.body.style.overflow = "";
  _crudTarget = null;
}

async function _handleCrudSave() {
  const title = _el("crudInputTitle").value.trim();
  const url   = _el("crudInputUrl").value.trim();
  const path  = _el("crudInputPath").value.trim();

  if (!title) {
    showToast(I18n.t("toast.validationTitle"), "error");
    return;
  }

  if (!url) {
    showToast(I18n.t("toast.validationUrl"), "error");
    return;
  }

  if (!_isSafeURL(url)) {
    showToast(I18n.t("toast.validationUrlInvalid"), "error");
    return;
  }

  try {
    if (_crudTarget) {
      /* UPDATE */
      const updated = { ..._crudTarget, title, url, path };
      await StorageManager.updateBookmark(updated);
      const idx = _bookmarks.findIndex(b => b.id === _crudTarget.id);
      if (idx !== -1) _bookmarks[idx] = updated;

      /* Rebuild folder counts & re-persist tree */
      BookmarkParser.rebuildCounts(_folderTree, _bookmarks);
      await StorageManager.setMeta("folderTree", _folderTree);
      FolderTree.render(_folderTree);

      _markUnsaved();
      showToast(I18n.t("toast.saved"));
    } else {
      /* CREATE */
      const finalPath = path || "Uncategorized";
      const folder    = finalPath.split("/").pop();
      const newBm = {
        id:      _uuid(),
        title,
        url,
        path:    finalPath,
        folder,
        addDate: Date.now(),
      };
      await StorageManager.addBookmark(newBm);
      _bookmarks.push(newBm);

      /* Rebuild folder counts & re-persist tree */
      BookmarkParser.rebuildCounts(_folderTree, _bookmarks);
      await StorageManager.setMeta("folderTree", _folderTree);
      FolderTree.render(_folderTree);

      _markUnsaved();
      showToast(I18n.t("toast.added"));
    }

    const prevTarget = _crudTarget;
    _closeCrudModal();
    _updateStats();
    _renderBookmarks();

    /* Update details panel if it was showing the edited bookmark */
    if (prevTarget && _selectedBookmark?.id === prevTarget.id) {
      const updated = _bookmarks.find(b => b.id === prevTarget.id);
      if (updated) _showBookmarkDetails(updated);
    }
  } catch (err) {
    console.error("[app] crud save error:", err);
    showToast(I18n.t("toast.saveFailed"), "error");
  }
}

/* =========================================
   DELETE BOOKMARK
========================================= */

function _deleteBookmark(bookmark) {
  if (!bookmark?.id) return;
  _deleteTarget = bookmark;
  _showDialog("dialog.deleteDesc");
}

async function _executeDeleteBookmark(bookmark) {
  if (!bookmark?.id) return;

  try {
    await StorageManager.init();
    await StorageManager.deleteBookmark(bookmark.id);
    _bookmarks = _bookmarks.filter(b => b.id !== bookmark.id);

    BookmarkParser.rebuildCounts(_folderTree, _bookmarks);
    await StorageManager.setMeta("folderTree", _folderTree);
    FolderTree.render(_folderTree);
    if (_activeFolder !== "ALL") FolderTree.setActivePath(_activeFolder);

    _updateStats();
    _renderBookmarks();

    if (_selectedBookmark?.id === bookmark.id) {
      _selectedBookmark = null;
      _el("bookmarkDetails").innerHTML = `
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 15l-2 5L9 9l11 4-5 2z"/>
          </svg>
          <p class="empty-hint">${I18n.t("empty.selectBookmark")}</p>
        </div>
      `;
    }

    _markUnsaved();
    showToast(I18n.t("toast.deleted"), "info");
  } catch (err) {
    console.error("[app] delete error:", err);
    showToast(I18n.t("toast.deleteFailed"), "error");
  }
}

/* =========================================
   DOMAINS VIEW
========================================= */

function _showDomains() {
  _currentView = "domains";

  const domains = BookmarkParser.getDomains(_bookmarks);

  _el("currentFolderName").textContent = I18n.t("view.uniqueDomains");
  _el("bookmarkCount").textContent     = I18n.formatCount(domains.length, "domain");
  _el("btnBackToBookmarks").hidden     = false;
  _updateViewBadge(I18n.t("badge.domains"));

  _renderDomainList(domains);
}

function _renderDomainList(domains) {
  const container = _el("bookmarkContainer");
  container.innerHTML = "";

  if (!domains.length) {
    container.appendChild(_buildEmptyState("globe", I18n.t("empty.noDomains")));
    return;
  }

  const fragment = document.createDocumentFragment();

  domains.forEach(({ domain, count }) => {
    const template = _el("domainItemTemplate");
    const clone    = template.content.cloneNode(true);
    const item     = clone.querySelector(".domain-item");
    const favImg   = clone.querySelector(".domain-favicon");

    favImg.src     = _faviconURL(domain);
    favImg.alt     = domain;
    favImg.onerror = () => { favImg.style.display = "none"; };

    clone.querySelector(".domain-name").textContent  = domain;
    clone.querySelector(".domain-count").textContent = I18n.formatCount(count, "bookmark");

    item.setAttribute("aria-label", `${domain} — ${I18n.formatCount(count, "bookmark")}`);

    item.addEventListener("click",   () => _filterByDomain(domain));
    item.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); _filterByDomain(domain); }
    });

    fragment.appendChild(clone);
  });

  container.appendChild(fragment);
}

function _filterByDomain(domain) {
  const filtered = _bookmarks.filter(b => BookmarkParser.getDomain(b.url) === domain);

  _el("currentFolderName").textContent = domain;
  _el("bookmarkCount").textContent     = I18n.formatCount(filtered.length, "item");
  _el("btnBackToBookmarks").hidden     = false;
  _updateViewBadge(I18n.t("badge.domain"));

  _renderBookmarkList(filtered);
}

/* =========================================
   DUPLICATES VIEW
========================================= */

function _showDuplicates() {
  _currentView = "duplicates";

  const duplicates = BookmarkParser.getDuplicateURLs(_bookmarks);

  _el("currentFolderName").textContent = I18n.t("view.duplicateURLs");
  _el("bookmarkCount").textContent     = I18n.formatCount(duplicates.length, "group");
  _el("btnBackToBookmarks").hidden     = false;
  _updateViewBadge(I18n.t("badge.duplicates"));

  _renderDuplicateGroups(duplicates);
}

function _renderDuplicateGroups(groups) {
  const container = _el("bookmarkContainer");
  container.innerHTML = "";

  if (!groups.length) {
    container.appendChild(_buildEmptyState(
      "check",
      I18n.t("empty.noDuplicates"),
      I18n.t("empty.noDuplicatesDesc")
    ));
    return;
  }

  const fragment = document.createDocumentFragment();

  groups.forEach(group => {
    const firstItem = group.items[0];
    let expanded    = false;

    /* Group wrapper */
    const wrapper = document.createElement("div");
    wrapper.className = "dup-group collapsed";

    /* Header */
    const header = document.createElement("div");
    header.className = "dup-header";
    header.setAttribute("role",         "button");
    header.setAttribute("tabindex",     "0");
    header.setAttribute("aria-expanded","false");

    const toggleIcon = document.createElement("span");
    toggleIcon.className = "dup-toggle";
    toggleIcon.setAttribute("aria-hidden", "true");
    toggleIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>`;

    const info = document.createElement("div");
    info.className = "dup-info";
    info.innerHTML = `
      <p class="dup-title">${_escapeHTML(firstItem?.title || "(Untitled)")}</p>
      <p class="dup-url">${_escapeHTML(group.url)}</p>
    `;

    const badge = document.createElement("span");
    badge.className   = "dup-count-badge";
    badge.textContent = I18n.t("count.copies", { n: group.count });

    header.append(toggleIcon, info, badge);

    /* Items */
    const itemsWrap = document.createElement("div");
    itemsWrap.className = "dup-items";

    group.items.forEach(item => {
      const row = document.createElement("div");
      row.className = "dup-item";
      row.setAttribute("tabindex", "0");
      row.setAttribute("role",     "button");

      const itemDomain = BookmarkParser.getDomain(item.url);
      const dateStr    = new Date(item.addDate).toLocaleDateString(undefined, {
        year:  "numeric",
        month: "short",
        day:   "numeric",
      });

      const favEl = document.createElement("img");
      favEl.className = "dup-favicon";
      favEl.src       = _faviconURL(itemDomain);
      favEl.alt       = itemDomain;
      favEl.width     = 16;
      favEl.height    = 16;
      favEl.loading   = "lazy";
      favEl.onerror   = () => { favEl.style.display = "none"; };

      const bodyEl = document.createElement("div");
      bodyEl.className = "dup-item-body";
      bodyEl.innerHTML = `
        <p class="dup-item-title">${_escapeHTML(item.title)}</p>
        <p class="dup-item-path">${_escapeHTML(item.path || "—")}</p>
      `;

      const dateEl = document.createElement("span");
      dateEl.className   = "dup-item-date";
      dateEl.textContent = dateStr;

      row.append(favEl, bodyEl, dateEl);

      row.addEventListener("click", e => {
        e.stopPropagation();
        document.querySelectorAll(".dup-item.active")
          .forEach(r => r.classList.remove("active"));
        row.classList.add("active");
        _openDetailsPanel(item);
      });

      row.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); row.click(); }
      });

      itemsWrap.appendChild(row);
    });

    /* Toggle expand/collapse */
    function _toggle() {
      expanded = !expanded;
      wrapper.classList.toggle("expanded",   expanded);
      wrapper.classList.toggle("collapsed", !expanded);
      header.setAttribute("aria-expanded", String(expanded));
    }

    header.addEventListener("click", _toggle);
    header.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); _toggle(); }
    });

    wrapper.append(header, itemsWrap);
    fragment.appendChild(wrapper);
  });

  container.appendChild(fragment);
}

/* =========================================
   EXPORT JSON
========================================= */

function _exportJSON() {
  if (!_bookmarks.length) {
    showToast(I18n.t("empty.noBookmarks"), "info");
    return;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    version:    1,
    bookmarks:  _bookmarks,
    folderTree: _folderTree,
  };

  const blob = new Blob(
    [JSON.stringify(payload, null, 2)],
    { type: "application/json" }
  );
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `bookmarks_${new Date().toISOString().slice(0, 10)}.json`;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 2000);
  _clearUnsaved();
  showToast(I18n.t("toast.exported"));
}

/* =========================================
   EXPORT HTML (Netscape Bookmark Format)
   Compatible for re-import to browsers.
========================================= */

function _exportHTML() {
  if (!_bookmarks.length) {
    showToast(I18n.t("empty.noBookmarks"), "info");
    return;
  }

  /* Group bookmarks by path/folder */
  const folderMap = new Map();
  _bookmarks.forEach(b => {
    const key = b.path || "Uncategorized";
    if (!folderMap.has(key)) folderMap.set(key, []);
    folderMap.get(key).push(b);
  });

  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

  /* Build folder tree structure from paths */
  const rendered = new Set();

  function _renderFolder(path, indent) {
    const pad = "    ".repeat(indent);
    const name = path.split("/").pop();
    let out = `${pad}<DT><H3>${_escapeHTML(name)}</H3>\n${pad}<DL><p>\n`;

    /* Find subfolders */
    folderMap.forEach((bms, key) => {
      if (key !== path && key.startsWith(path + "/")) {
        const rest = key.slice(path.length + 1);
        if (!rest.includes("/")) {
          if (!rendered.has(key)) {
            rendered.add(key);
            out += _renderFolder(key, indent + 1);
          }
        }
      }
    });

    /* Bookmarks in this folder */
    const bms = folderMap.get(path) || [];
    bms.forEach(b => {
      const addDate = Math.floor((b.addDate || Date.now()) / 1000);
      out += `${pad}    <DT><A HREF="${_escapeHTML(b.url)}" ADD_DATE="${addDate}">${_escapeHTML(b.title)}</A>\n`;
    });

    out += `${pad}</DL><p>\n`;
    return out;
  }

  /* Render top-level folders first */
  folderMap.forEach((bms, path) => {
    if (!path.includes("/") && path !== "Uncategorized") {
      if (!rendered.has(path)) {
        rendered.add(path);
        html += _renderFolder(path, 1);
      }
    }
  });

  /* Render Uncategorized */
  if (folderMap.has("Uncategorized")) {
    folderMap.get("Uncategorized").forEach(b => {
      const addDate = Math.floor((b.addDate || Date.now()) / 1000);
      html += `    <DT><A HREF="${_escapeHTML(b.url)}" ADD_DATE="${addDate}">${_escapeHTML(b.title)}</A>\n`;
    });
  }

  html += `</DL><p>\n`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `bookmarks_${new Date().toISOString().slice(0, 10)}.html`;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 2000);
  _clearUnsaved();
  showToast(I18n.t("toast.exportedHtml"));
}

/* =========================================
   CLEAR DATA
========================================= */

function _requestClearData() {
  _deleteTarget = null;
  _showDialog("dialog.clearDesc");
}

async function _executeClearData() {
  try {
    _showLoading(true);
    await StorageManager.clearBookmarks();
    await StorageManager.removeMeta("folderTree");
    await StorageManager.removeMeta("activeFolder");
    await StorageManager.removeMeta("hasUnsaved");
  } catch (err) {
    console.error("[app] clearData error:", err);
  } finally {
    _showLoading(false);
  }

  _bookmarks        = [];
  _folderTree       = null;
  _selectedBookmark = null;
  _activeFolder     = "ALL";
  _currentView      = "bookmarks";

  _updateStats();
  FolderTree.render(null);
  _el("btnBackToBookmarks").hidden = true;
  _updateViewBadge(I18n.t("badge.bookmarks"));
  _renderBookmarks();
  _updateImportButtonVisibility();

  /* Reset details panel */
  _el("bookmarkDetails").innerHTML = `
    <div class="empty-state">
      <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 15l-2 5L9 9l11 4-5 2z"/>
      </svg>
      <p class="empty-hint">${I18n.t("empty.selectBookmark")}</p>
    </div>
  `;

  _clearUnsaved();
  showToast(I18n.t("toast.cleared"), "info");
}

/* =========================================
   THEME
   data-theme="light"|"dark" on <html>
   Persisted via StorageManager.setMeta("theme")
========================================= */

async function _applyTheme() {
  const saved = await StorageManager.getMeta("theme");
  document.documentElement.setAttribute(
    "data-theme",
    saved === "dark" ? "dark" : "light"
  );
  _updateThemeButton();
}

function _updateThemeButton() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const btn    = _el("btnTheme");

  btn.querySelector(".icon-sun").style.display  = isDark ? "none" : "";
  btn.querySelector(".icon-moon").style.display = isDark ? ""     : "none";

  const label = _el("themeLabel");
  label.textContent = isDark ? I18n.t("action.lightMode") : I18n.t("action.darkMode");
  label.setAttribute("data-i18n", isDark ? "action.lightMode" : "action.darkMode");
}

async function _toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const next   = isDark ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  _updateThemeButton();
  await StorageManager.setMeta("theme", next);
}

/* =========================================
   LANGUAGE
========================================= */

async function _toggleLang() {
  I18n.toggleLang();
  _updateLangButton();
  await StorageManager.setMeta("lang", I18n.getLang());
  _reapplyDynamicText();
}

function _updateLangButton() {
  _el("langLabel").textContent = I18n.getLang().toUpperCase();
}

function _reapplyDynamicText() {
  /* Re-render active view with updated translations */
  if      (_currentView === "bookmarks")  _renderBookmarks();
  else if (_currentView === "domains")    _showDomains();
  else if (_currentView === "duplicates") _showDuplicates();

  _updateThemeButton();
  _updateImportButtonVisibility();

  /* Update "All Bookmarks" label in the already-rendered tree */
  const allLabel = document.querySelector(".folder-row-all .folder-label");
  if (allLabel) allLabel.textContent = I18n.t("sidebar.allBookmarks");
}

/* =========================================
   EMPTY STATE BUILDER
   iconKey: "search" | "globe" | "check"
========================================= */

const _emptyIcons = {
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
    stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>`,
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
    stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>`,
};

function _buildEmptyState(iconKey, title, desc = "") {
  const div = document.createElement("div");
  div.className = "empty-state large";
  div.innerHTML = `
    <div class="empty-illustration" aria-hidden="true">
      ${_emptyIcons[iconKey] || _emptyIcons.search}
    </div>
    <p class="empty-title">${_escapeHTML(title)}</p>
    ${desc ? `<p class="empty-desc">${_escapeHTML(desc)}</p>` : ""}
  `;
  return div;
}

/* =========================================
   UTILITIES
========================================= */

function _escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#39;");
}

function _isSafeURL(url) {
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

function _openURL(url) {
  if (_isSafeURL(url)) window.open(url, "_blank", "noopener,noreferrer");
}

function _faviconURL(domain) {
  return domain
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
    : "";
}

function _uuid() {
  return typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}