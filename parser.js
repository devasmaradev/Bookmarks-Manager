/*
=========================================
parser.js
Bookmark Manager
=========================================
*/

const BookmarkParser = (() => {

    /* =========================================
       UUID
    ========================================= */

    function createUUID() {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return crypto.randomUUID();
        }
        return Date.now().toString(36) + Math.random().toString(36).slice(2);
    }

    /* =========================================
       PUBLIC PARSE
    ========================================= */

    function parse(htmlText) {

        const parser   = new DOMParser();
        const doc      = parser.parseFromString(htmlText, "text/html");
        const bookmarks = [];
        const rootTree  = createFolderNode("ROOT", "");
        const rootDL    = doc.querySelector("dl");

        if (!rootDL) return { bookmarks, tree: rootTree };

        walkDL(rootDL, [], rootTree, bookmarks);
        rebuildCountsFromBookmarks(rootTree, bookmarks);

        return { bookmarks, tree: rootTree };
    }

    /* =========================================
       WALK DL
    ========================================= */

    function walkDL(dlNode, currentPath, treeNode, bookmarks) {

        const children = Array.from(dlNode.children);

        for (let i = 0; i < children.length; i++) {

            const node = children[i];

            if (node.tagName?.toUpperCase() !== "DT") continue;

            processDT(node, children, i, currentPath, treeNode, bookmarks);
        }
    }

    /* =========================================
       PROCESS DT
    ========================================= */

    function processDT(dtNode, siblings, index, currentPath, treeNode, bookmarks) {

        const folderTitle = Array.from(dtNode.children).find(
            c => c.tagName?.toUpperCase() === "H3"
        );

        const bookmarkLink = Array.from(dtNode.children).find(
            c => c.tagName?.toUpperCase() === "A"
        );

        /* --- FOLDER --- */
        if (folderTitle) {

            const folderName = sanitizeText(folderTitle.textContent) || "Unnamed Folder";
            const pathParts  = [...currentPath, folderName];
            const fullPath   = pathParts.join("/");
            const folderNode = createFolderNode(folderName, fullPath);

            treeNode.children.push(folderNode);

            let nestedDL = Array.from(dtNode.children).find(
                c => c.tagName?.toUpperCase() === "DL"
            );

            if (!nestedDL) {
                const next = siblings[index + 1];
                if (next && next.tagName?.toUpperCase() === "DL") nestedDL = next;
            }

            if (nestedDL) walkDL(nestedDL, pathParts, folderNode, bookmarks);
            return;
        }

        /* --- BOOKMARK --- */
        if (bookmarkLink) {

            const title  = sanitizeText(bookmarkLink.textContent) || "(Untitled)";
            const url    = (bookmarkLink.getAttribute("href") || "").trim();

            if (!url) return;

            const folder = currentPath.length ? currentPath[currentPath.length - 1] : "Uncategorized";
            const path   = currentPath.length ? currentPath.join("/") : "Uncategorized";

            bookmarks.push(createBookmark(title, url, folder, path, bookmarkLink));
        }
    }

    /* =========================================
       CREATE BOOKMARK
    ========================================= */

    function createBookmark(title, url, folder, path, anchorNode) {

        let addDate = Date.now();
        const rawDate = anchorNode.getAttribute("add_date");

        if (rawDate && Number.isFinite(Number(rawDate))) {
            addDate = Number(rawDate) * 1000;
        }

        return { id: createUUID(), title, url, folder, path, addDate };
    }

    /* =========================================
       CREATE FOLDER NODE
    ========================================= */

    function createFolderNode(name, path) {
        return { id: createUUID(), name, path, count: 0, children: [] };
    }

    /* =========================================
       SANITIZE
    ========================================= */

    function sanitizeText(text) {
        return (text || "").trim().replace(/\s+/g, " ");
    }

    /* =========================================
       DOMAIN
    ========================================= */

    function getDomain(url) {
        try {
            return new URL(url).hostname.replace(/^www\./i, "");
        } catch {
            return "";
        }
    }

    /* =========================================
       NORMALIZE URL
    ========================================= */

    function normalizeURL(url) {
        try {
            const parsed = new URL(url);
            parsed.hash  = "";

            const params = Array.from(parsed.searchParams.entries());
            params.sort((a, b) => a[0].localeCompare(b[0]));

            parsed.search = "";
            params.forEach(([key, value]) => parsed.searchParams.append(key, value));

            let normalized = parsed.toString();
            if (normalized.endsWith("/")) normalized = normalized.slice(0, -1);

            return normalized;
        } catch {
            return (url || "").trim();
        }
    }

    /* =========================================
       REBUILD COUNTS
    ========================================= */

    function rebuildCountsFromBookmarks(tree, bookmarks) {

        const nodeMap = new Map();

        function walk(node) {
            node.count = 0;
            nodeMap.set(node.path, node);
            node.children.forEach(walk);
        }

        walk(tree);

        bookmarks.forEach(bookmark => {

            const parts = bookmark.path.split("/");
            let current = "";

            parts.forEach(part => {
                current = current ? `${current}/${part}` : part;
                const node = nodeMap.get(current);
                if (node) node.count++;
            });
        });

        function aggregate(node) {
            node.children.forEach(aggregate);
            const childCount = node.children.reduce((sum, c) => sum + c.count, 0);
            node.count += childCount;
        }

        aggregate(tree);
    }

    /* =========================================
       DUPLICATE COUNT
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

    /* =========================================
       UNIQUE DOMAINS COUNT
    ========================================= */

    function countUniqueDomains(bookmarks) {
        return new Set(
            bookmarks.map(b => getDomain(b.url)).filter(Boolean)
        ).size;
    }

    /* =========================================
       GET DOMAINS
    ========================================= */

    function getDomains(bookmarks) {

        const map = new Map();

        bookmarks.forEach(b => {
            const domain = getDomain(b.url);
            if (!domain) return;
            map.set(domain, (map.get(domain) || 0) + 1);
        });

        return [...map.entries()]
            .map(([domain, count]) => ({ domain, count }))
            .sort((a, b) => b.count - a.count);
    }

    /* =========================================
       GET DUPLICATE URLs
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
            b.title.toLowerCase().includes(q) ||
            b.url.toLowerCase().includes(q) ||
            b.path.toLowerCase().includes(q)
        );
    }

    /* =========================================
       API
    ========================================= */

    return {
        parse,
        getDomain,
        normalizeURL,
        rebuildCountsFromBookmarks,
        countDuplicates,
        countUniqueDomains,
        getDomains,
        getDuplicateURLs,
        searchBookmarks
    };

})();
