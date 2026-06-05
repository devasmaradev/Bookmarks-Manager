/*
=========================================
  tree.js — Bookmark Manager
  Builds & manages the sidebar folder tree.
  DOM classes must match style.css:
  .folder-node, .folder-row, .folder-row-all,
  .folder-children, .folder-chevron,
  .folder-icon, .folder-label, .folder-count-badge
  States: .active, .expanded, .collapsed
=========================================
*/

"use strict";

const FolderTree = (() => {

  let _container        = null;
  let _activePath       = "ALL";
  let _onFolderSelected = null;
  let _onStateChange    = null;

  const _expandedPaths = new Set();

  /* =========================================
     INIT
     Called by app.js bindEvents()
  ========================================= */

  function init(containerElement, callback, onStateChange) {
    _container        = containerElement;
    _onFolderSelected = callback;
    _onStateChange    = onStateChange || null;
  }

  /* =========================================
     RENDER
     Called by app.js after import / loadSavedData
  ========================================= */

  function render(tree) {
    if (!_container) return;

    _container.innerHTML = "";

    /* "All Bookmarks" root node */
    _container.appendChild(_buildAllNode());

    if (!tree?.children?.length) return;

    const fragment = document.createDocumentFragment();
    tree.children.forEach(child => fragment.appendChild(_buildFolderNode(child)));
    _container.appendChild(fragment);

    _syncSelection();
  }

  /* =========================================
     "ALL BOOKMARKS" STATIC NODE
  ========================================= */

  function _buildAllNode() {
    const row = document.createElement("div");
    row.className = "folder-row folder-row-all";
    row.setAttribute("role",         "treeitem");
    row.setAttribute("tabindex",     "0");
    row.setAttribute("aria-selected", _activePath === "ALL" ? "true" : "false");
    if (_activePath === "ALL") row.classList.add("active");

    /* Spacer to align with chevron column */
    const spacer = document.createElement("span");
    spacer.className = "folder-chevron";
    spacer.setAttribute("aria-hidden", "true");

    const icon = document.createElement("span");
    icon.className = "folder-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>`;

    const label = document.createElement("span");
    label.className   = "folder-label";
    label.textContent = I18n.t("sidebar.allBookmarks");

    row.append(spacer, icon, label);

    row.addEventListener("click", () => _selectFolder("ALL"));
    row.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); _selectFolder("ALL"); }
    });

    return row;
  }

  /* =========================================
     BUILD FOLDER NODE
  ========================================= */

  function _buildFolderNode(node) {
    const hasChildren = Boolean(node.children?.length);
    const isExpanded  = _expandedPaths.has(node.path);

    /* Wrapper — role="treeitem" for ARIA tree */
    const wrapper = document.createElement("div");
    wrapper.className = `folder-node ${isExpanded ? "expanded" : "collapsed"}`;
    wrapper.dataset.path = node.path;
    wrapper.setAttribute("role", "treeitem");
    if (hasChildren) {
      wrapper.setAttribute("aria-expanded", String(isExpanded));
    }

    /* Row */
    const row = document.createElement("div");
    row.className = "folder-row";
    row.dataset.path = node.path;
    row.setAttribute("tabindex",      "0");
    row.setAttribute("aria-selected", _activePath === node.path ? "true" : "false");
    if (_activePath === node.path) row.classList.add("active");

    /* Chevron */
    const chevron = document.createElement("span");
    chevron.className = "folder-chevron";
    chevron.setAttribute("aria-hidden", "true");
    if (hasChildren) {
      chevron.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>`;
      chevron.style.cursor = "pointer";
      chevron.addEventListener("click", e => {
        e.stopPropagation();
        _toggleNode(wrapper, node.path);
      });
    }

    /* Folder icon */
    const icon = document.createElement("span");
    icon.className = "folder-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = hasChildren
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
          <polyline points="13 2 13 9 20 9"/>
        </svg>`;

    /* Label */
    const label = document.createElement("span");
    label.className   = "folder-label";
    label.textContent = node.name;
    label.title       = node.name;

    /* Count badge */
    const badge = document.createElement("span");
    badge.className   = "folder-count-badge";
    badge.textContent = (node.count || 0).toLocaleString();
    badge.setAttribute("aria-label", `${node.count || 0} bookmarks`);

    row.append(chevron, icon, label, badge);

    /* Children container */
    const children = document.createElement("div");
    children.className = "folder-children";
    children.setAttribute("role", "group");

    if (hasChildren) {
      node.children.forEach(child => children.appendChild(_buildFolderNode(child)));
    }

    /* Row events */
    row.addEventListener("click", () => _selectFolder(node.path));
    row.addEventListener("keydown", e => {
      switch (e.key) {
        case "Enter":
        case " ":
          e.preventDefault();
          _selectFolder(node.path);
          break;
        case "ArrowRight":
          if (hasChildren && !_expandedPaths.has(node.path)) {
            e.preventDefault();
            _toggleNode(wrapper, node.path);
          }
          break;
        case "ArrowLeft":
          if (_expandedPaths.has(node.path)) {
            e.preventDefault();
            _toggleNode(wrapper, node.path);
          }
          break;
        case "ArrowDown": {
          e.preventDefault();
          _focusNext(row);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          _focusPrev(row);
          break;
        }
      }
    });

    wrapper.append(row, children);
    return wrapper;
  }

  /* =========================================
     TOGGLE EXPAND / COLLAPSE
  ========================================= */

  function _toggleNode(wrapper, path) {
    const expanded = wrapper.classList.contains("expanded");
    wrapper.classList.toggle("expanded",   !expanded);
    wrapper.classList.toggle("collapsed",   expanded);
    if (wrapper.hasAttribute("aria-expanded")) {
      wrapper.setAttribute("aria-expanded", String(!expanded));
    }
    expanded ? _expandedPaths.delete(path) : _expandedPaths.add(path);
    _notifyStateChange();
  }

  /* =========================================
     SELECT FOLDER
  ========================================= */

  function _selectFolder(path) {
    _activePath = path || "ALL";
    _syncSelection();
    if (typeof _onFolderSelected === "function") {
      _onFolderSelected(_activePath);
    }
  }

  /* =========================================
     SYNC ACTIVE SELECTION IN DOM
  ========================================= */

  function _syncSelection() {
    if (!_container) return;

    _container.querySelectorAll(".folder-row").forEach(r => {
      r.classList.remove("active");
      r.setAttribute("aria-selected", "false");
    });

    if (_activePath === "ALL") {
      const allRow = _container.querySelector(".folder-row-all");
      if (allRow) {
        allRow.classList.add("active");
        allRow.setAttribute("aria-selected", "true");
      }
      return;
    }

    const target = _container.querySelector(
      `.folder-row[data-path="${CSS.escape(_activePath)}"]`
    );
    if (!target) return;

    target.classList.add("active");
    target.setAttribute("aria-selected", "true");
    _expandAncestors(target);
  }

  /* =========================================
     EXPAND ANCESTOR NODES
  ========================================= */

  function _expandAncestors(row) {
    let node = row.closest(".folder-node");
    while (node) {
      const path = node.dataset.path;
      if (path) _expandedPaths.add(path);
      node.classList.remove("collapsed");
      node.classList.add("expanded");
      if (node.hasAttribute("aria-expanded")) {
        node.setAttribute("aria-expanded", "true");
      }
      node = node.parentElement?.closest(".folder-node");
    }
  }

  /* =========================================
     KEYBOARD FOCUS HELPERS
  ========================================= */

  function _focusNext(currentRow) {
    const rows = Array.from(
      _container.querySelectorAll(".folder-row:not([style*='display: none'])")
    );
    const idx = rows.indexOf(currentRow);
    if (idx < rows.length - 1) rows[idx + 1].focus();
  }

  function _focusPrev(currentRow) {
    const rows = Array.from(
      _container.querySelectorAll(".folder-row:not([style*='display: none'])")
    );
    const idx = rows.indexOf(currentRow);
    if (idx > 0) rows[idx - 1].focus();
  }

  /* =========================================
     EXPAND / COLLAPSE ALL
     Bound by app.js expandAllBtn / collapseAllBtn
  ========================================= */

  function expandAll() {
    if (!_container) return;
    _container.querySelectorAll(".folder-node").forEach(node => {
      node.classList.remove("collapsed");
      node.classList.add("expanded");
      if (node.hasAttribute("aria-expanded")) node.setAttribute("aria-expanded", "true");
      if (node.dataset.path) _expandedPaths.add(node.dataset.path);
    });
    _notifyStateChange();
  }

  function collapseAll() {
    if (!_container) return;
    _container.querySelectorAll(".folder-node").forEach(node => {
      if (node.dataset.path === _activePath) return;
      node.classList.remove("expanded");
      node.classList.add("collapsed");
      if (node.hasAttribute("aria-expanded")) node.setAttribute("aria-expanded", "false");
      if (node.dataset.path) _expandedPaths.delete(node.dataset.path);
    });
    _syncSelection();
    _notifyStateChange();
  }

  function _notifyStateChange() {
    if (typeof _onStateChange === "function") {
      _onStateChange([..._expandedPaths]);
    }
  }

  function setExpandedPaths(paths) {
    _expandedPaths.clear();
    if (Array.isArray(paths)) paths.forEach(p => _expandedPaths.add(p));
  }

  /* =========================================
     PATH ACCESSORS
     Used by app.js to sync tree with view state
  ========================================= */

  function setActivePath(path) {
    if (path === null) {
      /* Clear all active states tanpa set path baru */
      _activePath = null;
      if (!_container) return;
      _container.querySelectorAll(".folder-row").forEach(r => {
        r.classList.remove("active");
        r.setAttribute("aria-selected", "false");
      });
      return;
    }
    _activePath = path || "ALL";
    _syncSelection();
  }

  function getActivePath() {
    return _activePath;
  }

  /* =========================================
     PUBLIC API
  ========================================= */

  return {
    init,
    render,
    expandAll,
    collapseAll,
    setActivePath,
    getActivePath,
    setExpandedPaths,
  };

})();