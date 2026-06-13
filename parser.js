"use strict";

const BookmarkParser = (() => {

  /* =========================================
     UUID
  ========================================= */

  function _uuid() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }

  /* =========================================
     PARSE HTML FILE
  ========================================= */

  function parse(htmlText) {
    if (typeof htmlText !== "string" || !htmlText.trim()) {
      return { bookmarks: [], tree: _folderNode("ROOT", "") };
    }

    const doc       = new DOMParser().parseFromString(htmlText, "text/html");
    const bookmarks = [];
    const rootTree  = _folderNode("ROOT", "");
    const rootDL    = doc.querySelector("dl");

    if (!rootDL) return { bookmarks, tree: rootTree };

    _walkDL(rootDL, [], rootTree, bookmarks);
    rebuildCounts(rootTree, bookmarks);

    return { bookmarks, tree: rootTree };
  }

  /* =========================================
     WALK DL
  ========================================= */

  function _walkDL(dlNode, currentPath, treeNode, bookmarks) {
    Array.from(dlNode.children).forEach((node, i, children) => {
      if (node.tagName?.toUpperCase() === "DT") {
        _processDT(node, children, i, currentPath, treeNode, bookmarks);
      }
    });
  }

  /* =========================================
     PROCESS DT
  ========================================= */

  function _processDT(dtNode, siblings, index, currentPath, treeNode, bookmarks) {
    const dtChildren    = Array.from(dtNode.children);
    const folderHeading = dtChildren.find(c => c.tagName?.toUpperCase() === "H3");
    const anchorLink    = dtChildren.find(c => c.tagName?.toUpperCase() === "A");

    if (folderHeading) {
      const name      = _sanitize(folderHeading.textContent) || "Unnamed Folder";
      const pathParts = [...currentPath, name];
      const node      = _folderNode(name, pathParts.join("/"));

      treeNode.children.push(node);

      let nestedDL = dtChildren.find(c => c.tagName?.toUpperCase() === "DL");
      if (!nestedDL) {
        const next = siblings[index + 1];
        if (next?.tagName?.toUpperCase() === "DL") nestedDL = next;
      }

      if (nestedDL) _walkDL(nestedDL, pathParts, node, bookmarks);
      return;
    }

    if (anchorLink) {
      const url = (anchorLink.getAttribute("href") || "").trim();
      if (!url || !_isSafeProtocol(url)) return;

      const title  = _sanitize(anchorLink.textContent) || "(Untitled)";
      const folder = currentPath.length ? currentPath[currentPath.length - 1] : "Uncategorized";
      const path   = currentPath.length ? currentPath.join("/") : "Uncategorized";

      bookmarks.push(_bookmark(title, url, folder, path, anchorLink));
    }
  }

  /* =========================================
     FACTORIES
  ========================================= */

  function _bookmark(title, url, folder, path, anchor) {
    const raw     = anchor.getAttribute("add_date");
    const addDate = raw && Number.isFinite(Number(raw)) && Number(raw) > 0
      ? Number(raw) * 1000
      : Date.now();
    return { id: _uuid(), title, url, folder, path, addDate };
  }

  function _folderNode(name, path) {
    return { id: _uuid(), name, path, count: 0, children: [] };
  }

  /* =========================================
     TEXT SANITIZATION
  ========================================= */

  function _sanitize(text) {
    return (text || "").trim().replace(/\s+/g, " ");
  }

  /* =========================================
     URL UTILITIES
  ========================================= */

  function _isSafeProtocol(url) {
    try {
      return ["http:", "https:"].includes(new URL(url).protocol);
    } catch {
      return false;
    }
  }

  function getDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      return "";
    }
  }

  function normalizeURL(url) {
    try {
      const parsed = new URL(url);
      parsed.hash  = "";

      const params = [...parsed.searchParams.entries()].sort((a, b) =>
        a[0].localeCompare(b[0])
      );
      parsed.search = "";
      params.forEach(([k, v]) => parsed.searchParams.append(k, v));

      let out = parsed.toString();
      if (out.endsWith("/")) out = out.slice(0, -1);
      return out.toLowerCase();
    } catch {
      return (url || "").trim().toLowerCase();
    }
  }

  /* =========================================
     REBUILD FOLDER COUNTS
  ========================================= */

  function rebuildCounts(tree, bookmarks) {
    const nodeMap = new Map();

    function _map(node) {
      node.count = 0;
      nodeMap.set(node.path, node);
      node.children.forEach(_map);
    }
    _map(tree);

    bookmarks.forEach(({ path }) => {
      const parts = (path || "").split("/");
      let cur = "";
      parts.forEach(part => {
        cur = cur ? `${cur}/${part}` : part;
        const n = nodeMap.get(cur);
        if (n) n.count++;
      });
    });

    function _sum(node) {
      node.children.forEach(_sum);
      node.count = node.children.reduce((s, c) => s + c.count, node.count);
    }
    _sum(tree);
  }

  /* =========================================
     STATISTICS
  ========================================= */

  function countDuplicates(bookmarks) {
    const map = new Map();
    bookmarks.forEach(b => {
      const url = normalizeURL(b.url);
      map.set(url, (map.get(url) || 0) + 1);
    });
    let total = 0;
    map.forEach(count => { if (count > 1) total += count; });
    return total;
  }

  function countUniqueDomains(bookmarks) {
    return new Set(
      bookmarks.map(b => getDomain(b.url)).filter(Boolean)
    ).size;
  }

  /* =========================================
     DOMAIN LIST
  ========================================= */

  function getDomains(bookmarks) {
    const map = new Map();
    bookmarks.forEach(b => {
      const d = getDomain(b.url);
      if (d) map.set(d, (map.get(d) || 0) + 1);
    });
    return [...map.entries()]
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain));
  }

  /* =========================================
     DUPLICATE URL GROUPS
  ========================================= */

  function getDuplicateURLs(bookmarks) {
    const map = new Map();
    bookmarks.forEach(b => {
      const url = normalizeURL(b.url);
      if (!map.has(url)) map.set(url, []);
      map.get(url).push(b);
    });
    return [...map.entries()]
      .filter(([, items]) => items.length > 1)
      .map(([url, items]) => ({ url, count: items.length, items }))
      .sort((a, b) => b.count - a.count);
  }

  /* =========================================
     SEARCH
  ========================================= */

  function searchBookmarks(bookmarks, keyword) {
    const q = (keyword || "").trim().toLowerCase();
    if (!q) return bookmarks;

    return bookmarks.filter(b =>
      (b.title  || "").toLowerCase().includes(q) ||
      (b.url    || "").toLowerCase().includes(q) ||
      (b.folder || "").toLowerCase().includes(q) ||
      (b.path   || "").toLowerCase().includes(q)
    );
  }

  /* =========================================
     PUBLIC API
  ========================================= */

  return {
    parse,
    getDomain,
    normalizeURL,
    rebuildCounts,
    countDuplicates,
    countUniqueDomains,
    getDomains,
    getDuplicateURLs,
    searchBookmarks,
  };

})();