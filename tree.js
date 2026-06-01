/*
=========================================
tree.js
Bookmark Manager
=========================================
*/

const FolderTree = (() => {

    let container       = null;
    let activePath      = "ALL";
    let onFolderSelected = null;

    const expandedPaths = new Set();

    /* =========================================
       INIT
    ========================================= */

    function init(containerElement, callback) {
        container        = containerElement;
        onFolderSelected = callback;
    }

    /* =========================================
       RENDER
    ========================================= */

    function render(tree) {

        if (!container) return;

        container.innerHTML = "";
        container.appendChild(createAllNode());

        if (
            !tree ||
            !Array.isArray(tree.children) ||
            !tree.children.length
        ) {
            return;
        }

        const fragment = document.createDocumentFragment();

        tree.children.forEach(child => {
            fragment.appendChild(createFolderDOM(child));
        });

        container.appendChild(fragment);
        refreshSelection();
    }

    /* =========================================
       ALL BOOKMARKS NODE
    ========================================= */

    function createAllNode() {

        const row = document.createElement("div");
        row.className = "folder-row";
        row.setAttribute("role", "treeitem");
        row.setAttribute("tabindex", "0");

        if (activePath === "ALL") row.classList.add("active");

        row.innerHTML = `
            <span class="folder-toggle"></span>
            <span class="folder-icon">📚</span>
            <span class="folder-name">All Bookmarks</span>
        `;

        row.addEventListener("click", () => selectFolder("ALL"));
        row.addEventListener("keydown", e => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                selectFolder("ALL");
            }
        });

        return row;
    }

    /* =========================================
       CREATE FOLDER NODE DOM
    ========================================= */

    function createFolderDOM(node) {

        const wrapper = document.createElement("div");
        wrapper.className    = "folder-node";
        wrapper.dataset.path = node.path;
        wrapper.setAttribute("role", "treeitem");

        const isExpanded = expandedPaths.has(node.path);
        wrapper.classList.add(isExpanded ? "expanded" : "collapsed");

        /* --- row --- */
        const row = document.createElement("div");
        row.className    = "folder-row";
        row.dataset.path = node.path;
        row.setAttribute("tabindex", "0");

        if (activePath === node.path) row.classList.add("active");

        /* --- toggle --- */
        const toggle = document.createElement("span");
        toggle.className = "folder-toggle";
        toggle.textContent = node.children?.length ? "▶" : "";

        /* --- icon --- */
        const icon = document.createElement("span");
        icon.className  = "folder-icon";
        icon.textContent = "📁";

        /* --- name --- */
        const name = document.createElement("span");
        name.className  = "folder-name";
        name.textContent = node.name;

        /* --- count --- */
        const count = document.createElement("span");
        count.className  = "folder-count";
        count.textContent = node.count || 0;

        row.append(toggle, icon, name, count);

        /* --- children container --- */
        const children = document.createElement("div");
        children.className = "folder-children";

        if (Array.isArray(node.children)) {
            node.children.forEach(child => {
                children.appendChild(createFolderDOM(child));
            });
        }

        /* --- events --- */
        if (node.children?.length) {

            toggle.addEventListener("click", event => {
                event.stopPropagation();
                toggleFolder(wrapper, node.path);
            });
        }

        row.addEventListener("click", () => selectFolder(node.path));

        row.addEventListener("keydown", e => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                selectFolder(node.path);
            } else if (e.key === "ArrowRight" && node.children?.length) {
                e.preventDefault();
                if (!expandedPaths.has(node.path)) toggleFolder(wrapper, node.path);
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                if (expandedPaths.has(node.path)) toggleFolder(wrapper, node.path);
            }
        });

        wrapper.append(row, children);
        return wrapper;
    }

    /* =========================================
       TOGGLE FOLDER
    ========================================= */

    function toggleFolder(element, path) {

        const expanded = element.classList.contains("expanded");

        element.classList.toggle("expanded",  !expanded);
        element.classList.toggle("collapsed",  expanded);

        if (expanded) {
            expandedPaths.delete(path);
        } else {
            expandedPaths.add(path);
        }
    }

    /* =========================================
       SELECT FOLDER
    ========================================= */

    function selectFolder(path) {

        activePath = path || "ALL";
        refreshSelection();

        if (typeof onFolderSelected === "function") {
            onFolderSelected(activePath);
        }
    }

    /* =========================================
       REFRESH SELECTION
    ========================================= */

    function refreshSelection() {

        if (!container) return;

        container
            .querySelectorAll(".folder-row")
            .forEach(row => row.classList.remove("active"));

        if (activePath === "ALL") {
            const first = container.querySelector(".folder-row");
            if (first) first.classList.add("active");
            return;
        }

        const target = container.querySelector(
            `.folder-row[data-path="${CSS.escape(activePath)}"]`
        );

        if (!target) return;

        target.classList.add("active");
        expandParentFolders(target);
    }

    /* =========================================
       EXPAND PARENTS
    ========================================= */

    function expandParentFolders(row) {

        let node = row.closest(".folder-node");

        while (node) {
            const path = node.dataset.path;
            if (path) expandedPaths.add(path);
            node.classList.remove("collapsed");
            node.classList.add("expanded");
            node = node.parentElement?.closest(".folder-node");
        }
    }

    /* =========================================
       EXPAND ALL
    ========================================= */

    function expandAll() {

        if (!container) return;

        container.querySelectorAll(".folder-node").forEach(node => {
            node.classList.remove("collapsed");
            node.classList.add("expanded");
            if (node.dataset.path) expandedPaths.add(node.dataset.path);
        });
    }

    /* =========================================
       COLLAPSE ALL
    ========================================= */

    function collapseAll() {

        if (!container) return;

        container.querySelectorAll(".folder-node").forEach(node => {
            const path = node.dataset.path;
            if (path === activePath) return;
            node.classList.remove("expanded");
            node.classList.add("collapsed");
            expandedPaths.delete(path);
        });

        refreshSelection();
    }

    /* =========================================
       ACTIVE PATH
    ========================================= */

    function setActivePath(path) {
        activePath = path || "ALL";
        refreshSelection();
    }

    function getActivePath() {
        return activePath;
    }

    /* =========================================
       API
    ========================================= */

    return {
        init,
        render,
        expandAll,
        collapseAll,
        setActivePath,
        getActivePath
    };

})();
