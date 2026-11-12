const { app, BrowserWindow, globalShortcut, ipcMain, Menu, Tray, nativeImage, shell, clipboard, dialog, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const SEED = require('./seed');
const resources = require('./resources');
// Startup breadcrumbs appear in cue-launch.log when run-windows.cmd is used.
function startupLog(message, error) {
  const details = error ? `: ${error.stack || error.message || String(error)}` : '';
  console.log(`[Cue startup] ${message}${details}`);
}
function startupFailure(reason, error) {
  startupLog(reason, error);
  try { dialog.showErrorBox('Cue could not start', `${reason}\n\n${error?.message || ''}\n\nSee cue-launch.log beside run-windows.cmd for details.`); }
  catch { /* If Electron itself is failing, the console log remains available. */ }
  app.isQuitting = true;
  app.exit(1);
}
process.on('uncaughtException', error => startupFailure('Unexpected application error', error));
process.on('unhandledRejection', error => startupFailure('Unexpected startup failure', error));
let win, tray, inDialog = false;
const DEFAULT_PREFERENCES = Object.freeze({ keepOpenAfterLaunch: true });
if (process.platform === 'win32') app.setAppUserModelId('com.cue.devlauncher');
let registeredShortcut = 'Ctrl+Shift+Space';
const DB_FILE = () => path.join(app.getPath('userData'), 'cue-data.json');
const now = () => new Date().toISOString();
const normalizeUrl = resources.normalizeUrl;
const cloneSeed = () => SEED.map(x => ({...x, createdAt: now()}));
function storeRead() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE(), 'utf8'));
    if (parsed && Array.isArray(parsed.items)) return parsed;
    throw new Error('Cue data file is invalid. Restore a backup rather than overwriting your saved links.');
  } catch (e) { if (e.code !== 'ENOENT') throw e; /* first launch */ }
  const fresh = {version: 1, items: cloneSeed()};
  storeWrite(fresh);
  return fresh;
}
function storeWrite(data) {
  fs.mkdirSync(path.dirname(DB_FILE()), {recursive:true});
  const temporary = `${DB_FILE()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(data, null, 2), 'utf8');
  try { fs.renameSync(temporary, DB_FILE()); }
  catch { fs.copyFileSync(temporary, DB_FILE()); fs.unlinkSync(temporary); }
}
function getPreferences() {
  return {...DEFAULT_PREFERENCES, ...(storeRead().preferences || {})};
}
function updatePreferences(input) {
  const store = storeRead();
  const old = {...DEFAULT_PREFERENCES, ...(store.preferences || {})};
  store.preferences = {...old, keepOpenAfterLaunch: Boolean(input.keepOpenAfterLaunch)};
  storeWrite(store);
  updateTrayMenu();
  if (win && !win.isDestroyed()) win.webContents.send('app:preferences-changed', store.preferences);
  return store.preferences;
}
function cleanItem(input, old) {
  if (!input || typeof input !== 'object') throw new Error('Invalid resource.');
  const safe = (value, limit) => String(value ?? '').trim().slice(0, limit);
  const url = normalizeUrl(input.url);
  const title = safe(input.title, 100) || new URL(url).hostname.replace(/^www\./, '');
  const purpose = safe(input.purpose, 240);
  return {
    id: old?.id || crypto.randomUUID(), title, url, purpose,
    keywords: safe(input.keywords, 280), pack: resources.categories(storeRead()).find(x => x.toLowerCase() === String(input.pack || 'Other').toLowerCase()) || 'Other',
    pinned: Boolean(input.pinned), openCount: old?.openCount || 0,
    lastUsed: old?.lastUsed || null, createdAt: old?.createdAt || now()
  };
}
function createWindow() {
  win = new BrowserWindow({
    width: 1220, height: 900, minWidth: 800, minHeight: 600,
    show: false, frame: false, resizable: true, minimizable: true,
    skipTaskbar: false, // Users can always restore Cue from the Windows taskbar.
    title: 'Cue', backgroundColor: '#fbf6f2', roundedCorners: true,
    icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'cue.ico' : 'cue-256.png'),
    webPreferences: {preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true}
  });
  win.webContents.once('did-finish-load', () => startupLog('UI loaded'));
  win.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (isMainFrame) startupFailure(`Unable to load the Cue window (${code}): ${description}`);
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    startupFailure(`Cue UI process exited (${details.reason})`);
  });
  win.on('show', () => startupLog('Main window shown'));
  win.loadFile(path.join(__dirname, 'index.html')).catch(error => startupFailure('Could not load Cue interface', error));
  win.on('close', event => {
    if (!app.isQuitting) { event.preventDefault(); hideToTray(); }
  });
  // No blur-to-hide: clicking a browser opened by Cue must not make Cue vanish.
  if (process.argv.includes('--dev')) win.webContents.openDevTools({mode:'detach'});
}
function hideToTray() {
  if (!win) return;
  win.hide();
}
function showWindow({quickAdd = false, text = ''} = {}) {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) {
    const {workArea} = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const [width, height] = win.getSize();
    win.setPosition(
      Math.round(workArea.x + (workArea.width-width)/2),
      Math.round(workArea.y + Math.max(0,(workArea.height-height)/3))
    );
  }
  win.show();
  win.focus();
  if (quickAdd) win.webContents.send('app:quick-add', text);
}
function toggleFromShortcut() {
  if (win?.isVisible() && win.isFocused() && !win.isMinimized()) hideToTray();
  else showWindow();
}
function updateTrayMenu() {
  if (!tray) return;
  const prefs = getPreferences();
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'Show Cue', click:()=>showWindow()},
    {label:'Add link from clipboard', click:()=>showWindow({quickAdd:true,text:clipboard.readText()})},
    {type:'separator'},
    {label:'Keep Cue open when launching tools', type:'checkbox', checked:prefs.keepOpenAfterLaunch,
      click:(item)=>updatePreferences({keepOpenAfterLaunch:item.checked})},
    {type:'separator'},
    {label:'Quit Cue completely', click:()=>{ app.isQuitting=true; app.quit(); }}
  ]));
}
function createTray() {
  const iconPath = path.join(__dirname, 'assets', process.platform === 'win32' ? 'cue.ico' : 'cue-tray.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  if (trayIcon.isEmpty()) throw new Error('Cue tray icon could not be loaded.');
  tray = new Tray(trayIcon);
  tray.setToolTip('Cue is running — click to open. Right-click for options.');
  updateTrayMenu();
  tray.on('click', () => showWindow());
  tray.on('double-click', () => showWindow());
}
function registerHotkey() {
  if (globalShortcut.register('Control+Shift+Space', toggleFromShortcut)) return;
  registeredShortcut = 'Ctrl+Alt+Space';
  if (!globalShortcut.register('Control+Alt+Space', toggleFromShortcut)) {
    registeredShortcut = 'Tray only';
    win.webContents.once('did-finish-load', () => win.webContents.send('app:warning', 'The keyboard shortcuts are unavailable. Use the taskbar or tray icon to open Cue.'));
  }
}
app.whenReady().then(() => {
  startupLog('Electron ready');
  if (!app.requestSingleInstanceLock()) { startupLog('Another instance of Cue is already running; requesting it to show its window'); app.quit(); return; }
  app.on('second-instance',()=>{ if(win) { if(!win.isVisible()) showWindow(); else win.focus(); } });
  try { storeRead(); } catch (error) {
    dialog.showErrorBox('Cue data could not be opened', `${error.message}\n\nYour existing data was not overwritten. Back up cue-data.json in your app data folder before troubleshooting.`);
    app.isQuitting = true; app.quit(); return;
  }
  startupLog('Opening local data succeeded');
  createWindow(); startupLog('Browser window created');
  createTray(); startupLog('Tray icon created');
  registerHotkey(); startupLog(`Global shortcut: ${registeredShortcut}`);
  showWindow();
  ipcMain.handle('categories:list', () => resources.categories(storeRead()));
  ipcMain.handle('categories:save', (_event, {name, previous}) => {
    const store = resources.saveCategory(storeRead(), name, previous);
    storeWrite(store);
    return {categories:resources.categories(store), items:store.items};
  });
  ipcMain.handle('items:list', ()=>storeRead().items);
  ipcMain.handle('items:upsert', (_e, item) => {
    const store=storeRead();
    const old=item.id ? store.items.find(x=>x.id===item.id) : undefined;
    const cleaned=cleanItem(item, old);
    if (store.items.some(x => x.id !== old?.id && normalizeUrl(x.url) === cleaned.url)) throw Error('This URL is already saved.');
    if (old) store.items[store.items.findIndex(x=>x.id===old.id)] = cleaned;
    else store.items.unshift(cleaned);
    storeWrite(store);
    return store.items;
  });
  ipcMain.handle('items:remove',(_e,id)=>{
    const store=storeRead(); store.items=store.items.filter(x=>x.id!==id); storeWrite(store); return store.items;
  });
  ipcMain.handle('items:launch',async (_e,id)=>{
    const store=storeRead(), item=store.items.find(x=>x.id===id);
    if (!item) throw new Error('Link not found.');
    await shell.openExternal(normalizeUrl(item.url));
    item.openCount=(item.openCount||0)+1; item.lastUsed=now(); storeWrite(store);
    if (!getPreferences().keepOpenAfterLaunch) hideToTray();
    return store.items;
  });
  ipcMain.handle('items:launch-pack',async (_e,pack)=>{
    const store=storeRead(), items=store.items.filter(x=>x.pack===pack).slice(0,8);
    if (!items.length) return store.items;
    for (const item of items) { await shell.openExternal(normalizeUrl(item.url)); item.openCount=(item.openCount||0)+1; item.lastUsed=now(); }
    storeWrite(store); if (!getPreferences().keepOpenAfterLaunch) hideToTray(); return store.items;
  });
  ipcMain.handle('app:clipboard',()=>clipboard.readText());
  ipcMain.handle('app:shortcut',()=>registeredShortcut);
  ipcMain.handle('app:preferences:get', ()=>getPreferences());
  ipcMain.handle('app:preferences:set', (_e, input)=>updatePreferences(input));
  ipcMain.handle('app:export',async()=>{
    inDialog=true;
    try {
      const res=await dialog.showSaveDialog(win,{title:'Export Cue links',defaultPath:'cue-backup.json',filters:[{name:'JSON',extensions:['json']} ]});
      if (res.canceled || !res.filePath) return {cancelled:true};
      fs.writeFileSync(res.filePath, JSON.stringify(storeRead(),null,2)); return {ok:true};
    } finally { inDialog=false; }
  });
  ipcMain.handle('app:import',async()=>{
    inDialog=true;
    try {
      const res=await dialog.showOpenDialog(win,{title:'Import Cue links',properties:['openFile'],filters:[{name:'JSON',extensions:['json']} ]});
      if (res.canceled || !res.filePaths?.length) return {cancelled:true};
      const input=JSON.parse(fs.readFileSync(res.filePaths[0],'utf8'));
      if (!Array.isArray(input.items) || input.items.length>2000) throw new Error('Invalid Cue backup.');
      const store=storeRead(), urls=new Set(store.items.map(x=>normalizeUrl(x.url))), imported=[];
      store.categories = resources.categories({categories:[...resources.categories(store), ...(Array.isArray(input.categories)?input.categories:[])], items:input.items});
      for (const candidate of input.items) {
        try {const item=cleanItem({...candidate,id:null},null); item.pack=store.categories.find(x=>x.toLowerCase()===String(candidate.pack||'Other').toLowerCase())||'Other'; if(!urls.has(item.url)){urls.add(item.url);imported.push(item);}} catch {}
      }
      store.items.unshift(...imported); storeWrite(store);
      return {ok:true, count:imported.length, items:store.items};
    } finally { inDialog=false; }
  });
  ipcMain.on('app:hide',()=>hideToTray());
  ipcMain.on('app:minimize',()=>win?.minimize());
}).catch(error => startupFailure('Could not complete Electron startup', error));
app.on('will-quit',()=>globalShortcut.unregisterAll());
app.on('window-all-closed',()=>{ /* tray app keeps running */ });
