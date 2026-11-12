# Cue Developer

Cue is a local-first desktop launcher for developer tools and websites. Save links with a description of what you use them for, then search by task, name, keyword, or category to open the right tool in your default browser.

The current baseline is version **0.3.0**, with a warm, cream-colored editorial interface. It was initially generated with ChatGPT and is being developed further to fit a personal workflow.

## Features

- Save, edit, delete, and pin tools.
- Search names, purposes, keywords, domains, and categories.
- Create and rename categories; existing links follow category renames. Design, Assets, and Build are starting defaults, while Other holds resources without a category.
- Save with only a URL: the domain fills the editable resource name. Purpose, search keywords, and category are optional.
- Browse pinned and recently used tools, or open up to eight tools from a pack.
- Automatically show website favicons in cards, recent links, and search, with initials when icons are unavailable.
- Switch between light and neutral charcoal dark themes using the sun/moon button. Dark mode keeps Cue's warm clay accent. Your choice is remembered on the device; until you choose, the theme follows your system.
- Import and export JSON backups; imports merge links by URL.
- Keep Cue open after launching a website, or hide it using a saved preference.
- Access Cue from the taskbar, system tray, or global shortcut.
- Start with nine editable example tools, including Dribbble, Lucide, Squoosh, and MDN Web Docs.

## Run locally

Install Node.js LTS and npm, then run:

```sh
git clone https://github.com/heyzain/cue-developer.git
cd cue-developer
npm ci
npm start
```

For developer tools alongside the app:

```sh
npm run dev
```

On Windows, you can also double-click `run-windows.cmd`. It installs dependencies and downloads the Electron runtime if missing, then starts Cue with a terminal attached. Startup output is saved to `cue-launch.log`. Closing the terminal can stop the app.

## Keyboard and window controls

| Shortcut or control | Action |
| --- | --- |
| Ctrl + Shift + Space | Show Cue, or hide it when focused |
| Ctrl + Alt + Space | Fallback if the primary global shortcut is unavailable |
| Ctrl + K or / | Focus search |
| Ctrl + N | Open Save Tool, using a valid clipboard URL when available |
| Up / Down, then Enter | Select and open a search result |
| Esc | Close the modal, clear search, or hide Cue |
| Minimize | Minimize to the taskbar |
| Tray or Close button | Hide to the system tray |

To exit, right-click the tray icon and select **Quit Cue completely**. If both global shortcuts are unavailable, use the taskbar or tray.

## Data and backups

Desktop data is stored in `cue-data.json` inside Electron's `app.getPath('userData')` directory, outside this repository. On Windows this is normally under `%APPDATA%`; the exact folder depends on the application identity and how Cue is launched.

Updating the source folder keeps saved tools when the app identity and user-data path stay the same. Export important links before changing either. Import merges resources and categories without replacing existing URLs; it does not restore exported preferences. Empty custom categories are included in backups.

Opening `index.html` directly provides a browser preview using separate `localStorage`. It does not share desktop data or provide desktop window controls, global shortcuts, or tray integration. Everyday storage requires no account or cloud service; opening tools uses your browser and internet connection.

Website icons load from Google's favicon service using only the website hostname, without the saved URL's path, query, or fragment. Private IP addresses and local hostnames use initials. Images use the browser's normal HTTP cache; offline or failed requests keep the initials fallback. No icon data is added to your backups.

## Build for Windows

```sh
# Portable executable
npm run dist:portable

# NSIS installer
npm run dist:win
```

Build output goes to `release/`. `build-windows.cmd` installs dependencies and builds the portable executable. The current build configuration targets Windows; macOS and Linux packaging has not been configured or verified. Builds are unsigned.

## Project structure

| Path | Purpose |
| --- | --- |
| `main.js` | Electron window, tray, shortcuts, local storage, and IPC handlers |
| `preload.js` | Restricted bridge between the renderer and Electron |
| `index.html` | App shell, forms, and inline SVG symbols |
| `renderer.js` | Interface behavior, search, and browser-preview storage |
| `styles.css` | App styling and responsive layout |
| `seed.js` | Default example tools |
| `resources.js` | Shared URL and category rules for desktop and browser |
| `assets/` | Icons and decorative images from the generated design concept |
| `scripts/launch.cjs` | Windows startup and diagnostic logging |

## Replacing interface icons

Replace SVG files in `assets/icons/` using the same filenames, then reload Cue. No code edits are needed. Existing files provide a complete starting set; `folder.svg` is the custom Figma export. Export with a transparent background and a consistent 24 × 24 viewBox. Icons use SVG alpha masks: the interface supplies the color for light/dark themes and hover states, while SVG opacity preserves duotone shading. Solid multicolor fills become one interface color; express the secondary tone using opacity. Website favicons and the Cue logo are separate assets. For a packaged installation, replace icons in the source and rebuild.

## Development checks

Run `npm test` for category migration, rename, validation, and URL normalization checks. Run `npm run test:ui` for an isolated Electron renderer smoke test (uses temporary data, never your saved links). The UI test requires a working local Electron runtime and Windows sandbox permissions.

Check JavaScript syntax before committing:

```sh
node --check main.js
node --check preload.js
node --check renderer.js
node --check seed.js
node --check scripts/launch.cjs
```

For desktop changes, manually verify startup, saving and searching links, import/export, browser launches, minimize, tray reopening, and global shortcuts. Login startup is not implemented.
