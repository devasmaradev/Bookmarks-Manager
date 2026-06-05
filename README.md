# Bookmark Manager

A modern, privacy-focused bookmark management application built with vanilla JavaScript.

Bookmark Manager allows users to import browser bookmarks, organize them through a folder tree structure, search instantly, identify duplicate URLs, analyze domains, and export changes back to a browser-compatible HTML bookmark file.

All data is stored locally in the browser using IndexedDB, ensuring that bookmarks never leave the user's device.

---

## Features

### Bookmark Import

* Import browser bookmarks from standard Netscape Bookmark HTML files
* Supports bookmarks exported from:

  * Google Chrome
  * Microsoft Edge
  * Mozilla Firefox
  * Brave
  * Opera
  * Other compatible browsers

### Folder Management

* Interactive folder tree navigation
* Expand and collapse folders
* Expand all / Collapse all controls
* Bookmark counts for every folder
* Nested folder support

### Bookmark Operations

* Add bookmarks manually
* Edit existing bookmarks
* Delete bookmarks
* View detailed bookmark information
* Open bookmark URLs directly
* Copy bookmark URLs

### Search & Filtering

* Real-time bookmark search
* Folder-based filtering
* Fast client-side search experience

### Analytics

* Total bookmark count
* Total folder count
* Unique domain count
* Duplicate URL detection
* Domain grouping and analysis

### Export

* Export bookmarks back to HTML format
* Browser-compatible bookmark export
* Unsaved changes detection
* Export reminder banner

### User Experience

* Responsive design
* Mobile-friendly layout
* Dark mode / Light mode
* English and Indonesian language support
* Keyboard shortcuts
* Toast notifications
* Accessible UI components

### Privacy First

* No server required
* No external database
* No user tracking
* No cloud synchronization
* All bookmark data remains on the user's device

---

## Technology Stack

### Frontend

* HTML5
* CSS3
* Vanilla JavaScript (ES6+)

### Storage

* IndexedDB

### Architecture

The application is split into modular components:

| Module       | Responsibility                         |
| ------------ | -------------------------------------- |
| `app.js`     | Main application controller            |
| `parser.js`  | Bookmark HTML parser and utilities     |
| `storage.js` | IndexedDB data layer                   |
| `tree.js`    | Folder tree rendering and interactions |
| `i18n.js`    | Localization and language management   |
| `style.css`  | Design system and UI styling           |
| `index.html` | Application structure                  |

---

## Project Structure

```text
project/
│
├── index.html
├── style.css
│
├── app.js
├── parser.js
├── storage.js
├── tree.js
├── i18n.js
│
└── assets/
```

---

## How It Works

### Import Flow

```text
Bookmarks HTML File
          │
          ▼
     parser.js
          │
          ▼
  Bookmark Objects
          │
          ▼
     IndexedDB
          │
          ▼
 Folder Tree + UI
```

### Data Storage

Bookmarks and application metadata are stored locally using IndexedDB.

Stored metadata includes:

* Theme preference
* Language preference
* Folder tree structure
* Active folder selection
* Unsaved changes state

---

## Supported Bookmark Format

The application supports the standard Netscape Bookmark format commonly exported by modern browsers.

Example:

```html
<DT>
  <A HREF="https://example.com">
    Example Website
  </A>
</DT>
```

---

## Keyboard Shortcuts

| Shortcut   | Action                               |
| ---------- | ------------------------------------ |
| `Ctrl + F` | Focus search input                   |
| `Esc`      | Close active dialog, modal, or panel |

---

## Browser Compatibility

Recommended browsers:

* Google Chrome
* Microsoft Edge
* Mozilla Firefox
* Brave
* Opera

Modern browsers with support for:

* IndexedDB
* ES6 Modules
* DOMParser
* Local Storage APIs

---

## Performance

Designed for large bookmark collections.

Features include:

* Debounced search
* Efficient folder tree rendering
* IndexedDB persistence
* Client-side processing
* No backend dependency

---

## Security

The application only accepts:

* `http://`
* `https://`

bookmark URLs.

Unsupported or unsafe protocols are automatically ignored during import.

---

## Localization

Currently supported languages:

* English
* Indonesian

The language preference is automatically saved and restored between sessions.

---

## Getting Started

### Option 1 — Open Directly

Simply open:

```text
index.html
```

in a modern browser.

### Option 2 — Local Server

```bash
npx serve
```

or

```bash
python -m http.server
```

Then open:

```text
http://localhost:3000
```

or

```text
http://localhost:8000
```

---

## Future Improvements

Potential enhancements:

* Bookmark tags
* Advanced filtering
* Drag & drop folder management
* Automatic favicon fetching
* Bookmark health checking
* Import from JSON
* Backup and restore functionality
* PWA support
* Cloud synchronization

---

## License

This project is provided for educational and personal use.

You may modify and distribute it according to your preferred license.
