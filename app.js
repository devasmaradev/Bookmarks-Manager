/*
=========================================
app.js
Bookmark Manager
=========================================
*/

let bookmarks        = [];
let folderTree       = null;
let selectedBookmark = null;
let activeFolder     = "ALL";
let currentView      = "bookmarks";

let _toastTimer   = null;
let _detailsOpen  = false;

/* =========================================
   BOOTSTRAP
========================================= */

document.addEventListener("DOMContentLoaded", init);

async function init() {
    try {
        showLoading(true);
        await StorageManager.init();
        bindEvents();
        await loadSavedData();
        await loadTheme();
    } catch (error) {
        console.error(error);
        showToast("Failed to start application", "error");
    } finally {
        showLoading(false);
    }
}

/* =========================================
   EVENTS
========================================= */

function bindEvents() {

    /* file import */
    document.getElementById("bookmarkFile")
        .addEventListener("change", importBookmarks);

    /* search */
    const searchInput = document.getElementById("searchInput");
    const searchClear = document.getElementById("searchClear");

    searchInput.addEventListener("input", () => {
        const val = searchInput.value;
        searchClear.hidden = !val;
        currentView = "bookmarks";
        renderBookmarks();
    });

    searchClear.addEventListener("click", () => {
        searchInput.value = "";
        searchClear.hidden = true;
        currentView = "bookmarks";
        renderBookmarks();
        searchInput.focus();
    });

    /* toolbar buttons */
    document.getElementById("btnExportJson")
        .addEventListener("click", exportJSON);

    document.getElementById("btnClearData")
        .addEventListener("click", clearData);

    document.getElementById("btnTheme")
        .addEventListener("click", toggleTheme);

    /* stat cards */
    document.getElementById("domainsCard")
        .addEventListener("click", showDomains);

    document.getElementById("domainsCard")
        .addEventListener("keydown", e => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showDomains(); }
        });

    document.getElementById("duplicatesCard")
        .addEventListener("click", showDuplicates);

    document.getElementById("duplicatesCard")
        .addEventListener("keydown", e => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showDuplicates(); }
        });

    /* back button */
    document.getElementById("btnBackToBookmarks")
        .addEventListener("click", backToBookmarks);

    /* expand / collapse */
    document.getElementById("expandAllBtn")
        .addEventListener("click", () => FolderTree.expandAll());

    document.getElementById("collapseAllBtn")
        .addEventListener("click", () => FolderTree.collapseAll());

    /* mobile sidebar */
    document.getElementById("mobileMenuBtn")
        .addEventListener("click", toggleMobileSidebar);

    document.getElementById("mobileOverlay")
        .addEventListener("click", closeMobileSidebar);

    /* close details panel (mobile) */
    document.getElementById("closePanelBtn")
        .addEventListener("click", closeDetailsPanel);

    /* folder tree */
    FolderTree.init(
        document.getElementById("folderTree"),
        path => {
            activeFolder = path;
            currentView  = "bookmarks";
            updateViewBadge("Bookmarks");
            document.getElementById("btnBackToBookmarks").hidden = true;
            renderBookmarks();
            closeMobileSidebar();
        }
    );

    /* keyboard shortcuts */
    document.addEventListener("keydown", handleKeyboard);
}

/* =========================================
   KEYBOARD
========================================= */

function handleKeyboard(e) {

    if (e.key === "Escape") {
        closeMobileSidebar();
        closeDetailsPanel();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        document.getElementById("searchInput").focus();
    }
}

/* =========================================
   MOBILE SIDEBAR
========================================= */

function toggleMobileSidebar() {

    const sidebar  = document.getElementById("sidebar");
    const overlay  = document.getElementById("mobileOverlay");
    const btn      = document.getElementById("mobileMenuBtn");
    const isOpen   = sidebar.classList.contains("open");

    if (isOpen) {
        closeMobileSidebar();
    } else {
        sidebar.classList.add("open");
        overlay.classList.add("visible");
        btn.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";
    }
}

function closeMobileSidebar() {

    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("mobileOverlay");
    const btn     = document.getElementById("mobileMenuBtn");

    sidebar.classList.remove("open");
    overlay.classList.remove("visible");
    btn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
}

/* =========================================
   DETAILS PANEL (mobile)
========================================= */

function openDetailsPanel(bookmark) {

    const panel   = document.getElementById("detailsPanel");
    const overlay = document.getElementById("mobileOverlay");

    showBookmarkDetails(bookmark);

    const isMobile = window.innerWidth <= 1200;

    if (isMobile) {
        panel.classList.add("mobile-open");
        overlay.classList.add("visible");
        _detailsOpen = true;
        document.body.style.overflow = "hidden";
    }
}

function closeDetailsPanel() {

    const panel   = document.getElementById("detailsPanel");
    const overlay = document.getElementById("mobileOverlay");

    panel.classList.remove("mobile-open");
    overlay.classList.remove("visible");
    _detailsOpen = false;
    document.body.style.overflow = "";
}

/* =========================================
   LOADING
========================================= */

function showLoading(visible) {
    document.getElementById("loadingOverlay").hidden = !visible;
}

/* =========================================
   TOAST
========================================= */

function showToast(message, type = "info") {

    const toast = document.getElementById("toast");

    clearTimeout(_toastTimer);

    toast.textContent = message;
    toast.className   = `toast show ${type}`;

    _toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2800);
}

/* =========================================
   IMPORT
========================================= */

async function importBookmarks(event) {

    const file = event.target.files?.[0];
    if (!file) return;

    try {
        showLoading(true);

        const text   = await file.text();
        const result = BookmarkParser.parse(text);

        bookmarks        = result.bookmarks;
        folderTree       = result.tree;
        selectedBookmark = null;
        activeFolder     = "ALL";

        await StorageManager.saveBookmarks(bookmarks);
        await StorageManager.setMeta("folderTree", folderTree);

        updateStats();

        FolderTree.setActivePath("ALL");
        FolderTree.render(folderTree);

        currentView = "bookmarks";
        document.getElementById("btnBackToBookmarks").hidden = true;
        updateViewBadge("Bookmarks");
        renderBookmarks();

        showToast(`Imported ${bookmarks.length} bookmarks`);

    } catch (error) {
        console.error(error);
        showToast("Failed to import bookmarks", "error");
    } finally {
        showLoading(false);
        event.target.value = "";
    }
}

/* =========================================
   LOAD SAVED DATA
========================================= */

async function loadSavedData() {

    bookmarks  = await StorageManager.loadBookmarks();
    folderTree = await StorageManager.getMeta("folderTree");

    if (!folderTree) {
        folderTree = {
            id:       crypto?.randomUUID?.() ?? Date.now().toString(36),
            name:     "ROOT",
            path:     "",
            count:    0,
            children: []
        };
    }

    updateStats();
    FolderTree.render(folderTree);
    renderBookmarks();
}

/* =========================================
   STATS
========================================= */

function updateStats() {

    document.getElementById("statBookmarks").textContent =
        bookmarks.length.toLocaleString();

    const folders = new Set(bookmarks.map(b => b.path));

    document.getElementById("statFolders").textContent =
        folders.size.toLocaleString();

    document.getElementById("statDomains").textContent =
        BookmarkParser.countUniqueDomains(bookmarks).toLocaleString();

    document.getElementById("statDuplicates").textContent =
        BookmarkParser.countDuplicates(bookmarks).toLocaleString();
}

/* =========================================
   RENDER BOOKMARKS
========================================= */

function renderBookmarks() {

    const keyword  = document.getElementById("searchInput").value;
    const filtered = BookmarkParser
        .searchBookmarks(bookmarks, keyword)
        .filter(b =>
            activeFolder === "ALL" ||
            b.path === activeFolder ||
            b.path.startsWith(activeFolder + "/")
        );

    const folderName = activeFolder === "ALL" ? "All Bookmarks" : activeFolder;

    document.getElementById("currentFolderName").textContent = folderName;
    document.getElementById("bookmarkCount").textContent =
        `${filtered.length.toLocaleString()} item${filtered.length !== 1 ? "s" : ""}`;

    renderBookmarkList(filtered);
}

/* =========================================
   BACK TO BOOKMARKS
========================================= */

function backToBookmarks() {

    currentView  = "bookmarks";
    activeFolder = "ALL";

    document.getElementById("btnBackToBookmarks").hidden = true;
    updateViewBadge("Bookmarks");

    FolderTree.setActivePath("ALL");
    renderBookmarks();
}

/* =========================================
   VIEW BADGE
========================================= */

function updateViewBadge(label) {
    document.getElementById("viewBadge").textContent = label;
}

/* =========================================
   RENDER BOOKMARK LIST
========================================= */

function renderBookmarkList(items) {

    const container = document.getElementById("bookmarkContainer");
    container.innerHTML = "";

    if (!items.length) {
        container.innerHTML = `
            <div class="empty-state large">
                <div class="empty-icon">🔍</div>
                <div class="empty-title">No bookmarks found</div>
                <div class="empty-desc">Try adjusting your search or folder selection</div>
            </div>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();

    items.forEach(bookmark => {
        fragment.appendChild(createBookmarkNode(bookmark));
    });

    container.appendChild(fragment);
}

/* =========================================
   BOOKMARK ITEM
========================================= */

function createBookmarkNode(bookmark) {

    const template = document.getElementById("bookmarkTemplate");
    const node     = template.content.cloneNode(true);
    const root     = node.querySelector(".bookmark-item");
    const favicon  = node.querySelector(".bookmark-favicon");
    const domain   = BookmarkParser.getDomain(bookmark.url);

    if (domain) {
        favicon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
        favicon.onerror = () => {
            favicon.src = "";
            favicon.style.display = "none";
        };
    } else {
        favicon.style.display = "none";
    }

    node.querySelector(".bookmark-title").textContent  = bookmark.title;
    node.querySelector(".bookmark-url").textContent    = bookmark.url;
    node.querySelector(".bookmark-domain").textContent = domain || "";
    node.querySelector(".bookmark-folder").textContent = bookmark.path || "";

    if (!domain) node.querySelector(".bookmark-domain").style.display = "none";
    if (!bookmark.path) node.querySelector(".bookmark-folder").style.display = "none";

    /* open button */
    const openBtn = node.querySelector(".bookmark-open-btn");
    openBtn.addEventListener("click", e => {
        e.stopPropagation();
        if (isSafeURL(bookmark.url)) {
            window.open(bookmark.url, "_blank", "noopener,noreferrer");
        }
    });

    /* select item */
    root.addEventListener("click", () => {

        document.querySelectorAll(".bookmark-item.active")
            .forEach(el => el.classList.remove("active"));

        root.classList.add("active");
        openDetailsPanel(bookmark);
    });

    root.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            root.click();
        }
    });

    return node;
}

/* =========================================
   ESCAPE / SAFE URL
========================================= */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function isSafeURL(url) {
    try {
        const u = new URL(url);
        return ["http:", "https:"].includes(u.protocol);
    } catch {
        return false;
    }
}

/* =========================================
   SHOW BOOKMARK DETAILS
========================================= */

function showBookmarkDetails(bookmark) {

    selectedBookmark = bookmark;

    const panel  = document.getElementById("bookmarkDetails");
    const domain = BookmarkParser.getDomain(bookmark.url);
    const href   = isSafeURL(bookmark.url) ? bookmark.url : "#";
    const addedDate = new Date(bookmark.addDate).toLocaleString(undefined, {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit"
    });

    panel.innerHTML = `
        <div class="detail-group">
            <div class="detail-label">Favicon</div>
            <div class="detail-favicon-row">
                <img class="detail-favicon" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64" alt="" loading="lazy">
                <span style="font-size:13px;color:var(--text-soft)">${escapeHTML(domain)}</span>
            </div>
        </div>

        <div class="detail-group">
            <div class="detail-label">Title</div>
            <div class="detail-value">${escapeHTML(bookmark.title)}</div>
        </div>

        <div class="detail-group">
            <div class="detail-label">URL</div>
            <div class="detail-value">
                <a href="${href}" target="_blank" rel="noopener noreferrer" class="detail-link">
                    ${escapeHTML(bookmark.url)}
                </a>
            </div>
        </div>

        <div class="detail-group">
            <div class="detail-label">Folder Path</div>
            <div class="detail-value">${escapeHTML(bookmark.path || "—")}</div>
        </div>

        <div class="detail-group">
            <div class="detail-label">Date Added</div>
            <div class="detail-value">${addedDate}</div>
        </div>

        <div class="detail-actions">
            <button id="openBookmarkBtn">↗ Open</button>
            <button id="copyBookmarkBtn" class="btn-copy">⎘ Copy URL</button>
        </div>
    `;

    /* fix favicon error in details */
    const detailFavicon = panel.querySelector(".detail-favicon");
    if (detailFavicon) {
        detailFavicon.onerror = () => detailFavicon.style.display = "none";
    }

    panel.querySelector("#openBookmarkBtn").addEventListener("click", () => {
        if (isSafeURL(bookmark.url)) {
            window.open(bookmark.url, "_blank", "noopener,noreferrer");
        }
    });

    panel.querySelector("#copyBookmarkBtn").addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(bookmark.url);
            showToast("URL copied to clipboard");
        } catch {
            showToast("Copy failed", "error");
        }
    });
}

/* =========================================
   SHOW DOMAINS
========================================= */

function showDomains() {

    currentView = "domains";

    const domains = BookmarkParser.getDomains(bookmarks);

    document.getElementById("currentFolderName").textContent = "Unique Domains";
    document.getElementById("bookmarkCount").textContent =
        `${domains.length.toLocaleString()} domain${domains.length !== 1 ? "s" : ""}`;
    document.getElementById("btnBackToBookmarks").hidden = false;

    updateViewBadge("Domains");
    renderDomainList(domains);
}

/* =========================================
   RENDER DOMAIN LIST
========================================= */

function renderDomainList(domains) {

    const container = document.getElementById("bookmarkContainer");
    container.innerHTML = "";

    if (!domains.length) {
        container.innerHTML = `
            <div class="empty-state large">
                <div class="empty-icon">🌐</div>
                <div class="empty-title">No domains found</div>
            </div>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();

    domains.forEach(({ domain, count }) => {

        const template = document.getElementById("domainGroupTemplate");
        const node     = template.content.cloneNode(true);
        const item     = node.querySelector(".domain-item");
        const favImg   = node.querySelector(".domain-favicon");

        favImg.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
        favImg.onerror = () => favImg.style.display = "none";

        node.querySelector(".domain-name").textContent  = domain;
        node.querySelector(".domain-total").textContent =
            `${count.toLocaleString()} bookmark${count !== 1 ? "s" : ""}`;

        item.setAttribute("tabindex", "0");
        item.setAttribute("role", "button");
        item.setAttribute("aria-label", `View bookmarks for ${domain}`);

        item.addEventListener("click", () => filterByDomain(domain));
        item.addEventListener("keydown", e => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); filterByDomain(domain); }
        });

        fragment.appendChild(node);
    });

    container.appendChild(fragment);
}

/* =========================================
   FILTER BY DOMAIN
========================================= */

function filterByDomain(domain) {

    const filtered = bookmarks.filter(
        b => BookmarkParser.getDomain(b.url) === domain
    );

    document.getElementById("currentFolderName").textContent = domain;
    document.getElementById("bookmarkCount").textContent =
        `${filtered.length.toLocaleString()} item${filtered.length !== 1 ? "s" : ""}`;
    document.getElementById("btnBackToBookmarks").hidden = false;

    updateViewBadge("Domain");
    renderBookmarkList(filtered);
}

/* =========================================
   SHOW DUPLICATES
========================================= */

function showDuplicates() {

    currentView = "duplicates";

    const duplicates = BookmarkParser.getDuplicateURLs(bookmarks);

    document.getElementById("currentFolderName").textContent = "Duplicate URLs";
    document.getElementById("bookmarkCount").textContent =
        `${duplicates.length.toLocaleString()} group${duplicates.length !== 1 ? "s" : ""}`;
    document.getElementById("btnBackToBookmarks").hidden = false;

    updateViewBadge("Duplicates");
    renderDuplicateGroups(duplicates);
}

/* =========================================
   RENDER DUPLICATE GROUPS
   — consistent with Domains UX:
     grouped, expandable, same card style
========================================= */

function renderDuplicateGroups(groups) {

    const container = document.getElementById("bookmarkContainer");
    container.innerHTML = "";

    if (!groups.length) {
        container.innerHTML = `
            <div class="empty-state large">
                <div class="empty-icon">✅</div>
                <div class="empty-title">No duplicates found</div>
                <div class="empty-desc">All your bookmarks have unique URLs</div>
            </div>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();

    groups.forEach(group => {

        const wrapper = document.createElement("div");
        wrapper.className = "duplicate-group collapsed";

        const domain    = BookmarkParser.getDomain(group.url);
        const firstItem = group.items[0];

        /* --- header --- */
        const header = document.createElement("div");
        header.className = "duplicate-header";
        header.setAttribute("role", "button");
        header.setAttribute("tabindex", "0");
        header.setAttribute("aria-expanded", "false");
        header.setAttribute("aria-label", `${group.count} copies of ${firstItem?.title || group.url}`);

        header.innerHTML = `
            <div class="duplicate-header-left">
                <span class="duplicate-toggle">▶</span>
                <div class="duplicate-header-info">
                    <div class="duplicate-title">${escapeHTML(firstItem?.title || "(Untitled)")}</div>
                    <div class="duplicate-url-preview">${escapeHTML(group.url)}</div>
                </div>
            </div>
            <span class="duplicate-count">${group.count} copies</span>
        `;

        /* --- items container --- */
        const itemsContainer = document.createElement("div");
        itemsContainer.className = "duplicate-items";

        group.items.forEach(item => {

            const row = document.createElement("div");
            row.className = "duplicate-bookmark-row";
            row.setAttribute("tabindex", "0");

            const itemDomain = BookmarkParser.getDomain(item.url);
            const addedDate  = new Date(item.addDate).toLocaleDateString(undefined, {
                year: "numeric", month: "short", day: "numeric"
            });

            row.innerHTML = `
                <img class="duplicate-bookmark-favicon"
                    src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(itemDomain)}&sz=64"
                    alt="" loading="lazy">
                <div class="duplicate-bookmark-info">
                    <div class="duplicate-bookmark-title">${escapeHTML(item.title)}</div>
                    <div class="duplicate-bookmark-path">${escapeHTML(item.path || "—")}</div>
                </div>
                <div class="duplicate-bookmark-date">${addedDate}</div>
            `;

            /* fix favicon error */
            const favImg = row.querySelector(".duplicate-bookmark-favicon");
            if (favImg) favImg.onerror = () => favImg.style.display = "none";

            row.addEventListener("click", e => {
                e.stopPropagation();
                document.querySelectorAll(".duplicate-bookmark-row.active")
                    .forEach(el => el.classList.remove("active"));
                row.classList.add("active");
                openDetailsPanel(item);
            });

            row.addEventListener("keydown", e => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); row.click(); }
            });

            itemsContainer.appendChild(row);
        });

        /* --- toggle expand/collapse --- */
        let expanded = false;

        function toggleExpand() {
            expanded = !expanded;
            wrapper.classList.toggle("expanded",  expanded);
            wrapper.classList.toggle("collapsed", !expanded);
            header.setAttribute("aria-expanded", String(expanded));
        }

        header.addEventListener("click", toggleExpand);
        header.addEventListener("keydown", e => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleExpand(); }
        });

        wrapper.append(header, itemsContainer);
        fragment.appendChild(wrapper);
    });

    container.appendChild(fragment);
}

/* =========================================
   EXPORT JSON
========================================= */

function exportJSON() {

    const payload = {
        exportedAt: new Date().toISOString(),
        bookmarks,
        folderTree
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

    setTimeout(() => URL.revokeObjectURL(url), 1500);
    showToast("Exported successfully");
}

/* =========================================
   CLEAR DATA
========================================= */

async function clearData() {

    if (!confirm("Delete all bookmark data? This cannot be undone.")) return;

    try {
        showLoading(true);
        await StorageManager.clearBookmarks();
        await StorageManager.removeMeta("folderTree");
    } catch (e) {
        console.error(e);
    } finally {
        showLoading(false);
    }

    bookmarks        = [];
    folderTree       = null;
    selectedBookmark = null;
    activeFolder     = "ALL";

    location.reload();
}

/* =========================================
   THEME
========================================= */

function updateThemeButton() {

    const isDark = document.body.classList.contains("dark");

    document.getElementById("themeIcon").textContent  = isDark ? "☀️" : "🌙";
    document.getElementById("themeLabel").textContent = isDark ? "Light" : "Dark";
}

async function loadTheme() {

    const theme = await StorageManager.getMeta("theme");
    if (theme === "dark") document.body.classList.add("dark");
    updateThemeButton();
}

async function toggleTheme() {

    document.body.classList.toggle("dark");

    const theme = document.body.classList.contains("dark") ? "dark" : "light";

    updateThemeButton();
    await StorageManager.setMeta("theme", theme);
}
