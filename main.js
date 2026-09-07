const { app, BrowserWindow, ipcMain, Menu, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { GROUPS, DEFAULT_EXTS, isSupportedExt } = require('./formats');

const PHOTOPEA_CFG = encodeURIComponent(JSON.stringify({
  environment: { intro: false }
}));
const PHOTOPEA = `https://www.photopea.com/#${PHOTOPEA_CFG}`;
const AD_RE = /googlesyndication|doubleclick|adservice\.google|pagead2|googleadservices|amazon-adsystem|adnxs\.com|360yield|prebid|marphezis|omnitagjs|pmbmonetize|smilewanted|sparteo|advolve|tappx|pubmatic|rubiconproject|criteo|taboola|adsrvr|bidswitch|id5-sync|fundingchoices|adsystem/i;

let win;
let settingsWin;
const pendingFiles = [];

function appExe() {
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
}

function assocCandidates() {
  const names = [];
  if (app.isPackaged) names.push(path.join(path.dirname(appExe()), 'associations.json'));
  names.push(path.join(app.getPath('userData'), 'associations.json'));
  return names;
}

function loadExts() {
  for (const file of assocCandidates()) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(data.exts)) return data.exts.map((e) => e.toLowerCase()).filter(isSupportedExt);
    } catch (e) {}
  }
  return DEFAULT_EXTS.slice();
}

function saveExts(exts) {
  const clean = [...new Set(exts.map((e) => e.toLowerCase()).filter(isSupportedExt))];
  const payload = JSON.stringify({ exts: clean }, null, 2);
  for (const file of assocCandidates()) {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, payload);
      return clean;
    } catch (e) {}
  }
  throw new Error('无法保存文件关联配置');
}

function progId(ext) {
  return `PhotopeaClient.${ext}`;
}

function reg(args) {
  return new Promise((resolve) => {
    execFile('reg', args, { windowsHide: true }, () => resolve());
  });
}

async function registerAppPaths() {
  const exe = path.resolve(appExe());
  const key = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\PhotopeaClient.exe';
  await reg(['add', key, '/ve', '/d', exe, '/f']);
  await reg(['add', key, '/v', 'Path', '/d', path.dirname(exe), '/f']);
}

async function bindExt(ext) {
  const exe = path.resolve(appExe());
  const id = progId(ext);
  const command = `"${exe}" "%1"`;
  const exeName = path.basename(exe);
  const fileExts = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.${ext}`;
  await reg(['add', `HKCU\\Software\\Classes\\.${ext}`, '/ve', '/d', id, '/f']);
  await reg(['add', `HKCU\\Software\\Classes\\.${ext}\\OpenWithProgids`, '/v', id, '/t', 'REG_NONE', '/d', '', '/f']);
  await reg(['add', `HKCU\\Software\\Classes\\${id}`, '/ve', '/d', `Photopea ${ext.toUpperCase()}`, '/f']);
  await reg(['add', `HKCU\\Software\\Classes\\${id}\\DefaultIcon`, '/ve', '/d', `${exe},0`, '/f']);
  await reg(['add', `HKCU\\Software\\Classes\\${id}\\shell`, '/ve', '/d', 'open', '/f']);
  await reg(['add', `HKCU\\Software\\Classes\\${id}\\shell\\open`, '/ve', '/d', '用 PhotopeaClient 打开', '/f']);
  await reg(['add', `HKCU\\Software\\Classes\\${id}\\shell\\open\\command`, '/ve', '/d', command, '/f']);
  await reg(['add', `HKCU\\Software\\Classes\\Applications\\${exeName}`, '/v', 'FriendlyAppName', '/d', 'PhotopeaClient', '/f']);
  await reg(['add', `HKCU\\Software\\Classes\\Applications\\${exeName}\\shell\\open\\command`, '/ve', '/d', command, '/f']);
  await reg(['add', `HKCU\\Software\\Classes\\Applications\\${exeName}\\SupportedTypes`, '/v', `.${ext}`, '/t', 'REG_SZ', '/d', '', '/f']);
  await reg(['add', `${fileExts}\\OpenWithProgids`, '/v', id, '/t', 'REG_NONE', '/d', '', '/f']);
  await reg(['add', `${fileExts}\\OpenWithList`, '/v', 'a', '/d', exeName, '/f']);
  await reg(['add', `${fileExts}\\OpenWithList`, '/v', 'MRUList', '/d', 'a', '/f']);
  await reg(['add', `HKCU\\Software\\PhotopeaClient\\Capabilities\\FileAssociations`, '/v', `.${ext}`, '/d', id, '/f']);
  await reg(['delete', `${fileExts}\\UserChoice`, '/f']);
  await reg(['delete', `${fileExts}\\UserChoiceLatest`, '/f']);
}

async function registerAppCapabilities() {
  const cap = 'HKCU\\Software\\PhotopeaClient\\Capabilities';
  await reg(['add', cap, '/v', 'ApplicationName', '/d', 'PhotopeaClient', '/f']);
  await reg(['add', cap, '/v', 'ApplicationDescription', '/d', 'Photopea 桌面客户端', '/f']);
  await reg(['add', 'HKCU\\Software\\RegisteredApplications', '/v', 'PhotopeaClient', '/d', 'Software\\PhotopeaClient\\Capabilities', '/f']);
}

function notifyExplorer() {
  execFile('powershell', ['-NoProfile', '-Command',
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class N { [DllImport(\"shell32.dll\")] public static extern void SHChangeNotify(int w, uint f, IntPtr a, IntPtr b); }'; [N]::SHChangeNotify(0x8000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)"
  ], { windowsHide: true }, () => {});
}

async function unbindExt(ext) {
  const id = progId(ext);
  const fileExts = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.${ext}`;
  await reg(['delete', `HKCU\\Software\\Classes\\.${ext}`, '/ve', '/f']);
  await reg(['delete', `HKCU\\Software\\Classes\\.${ext}\\OpenWithProgids`, '/v', id, '/f']);
  await reg(['delete', `HKCU\\Software\\Classes\\${id}`, '/f']);
  await reg(['delete', `${fileExts}\\OpenWithProgids`, '/v', id, '/f']);
  await reg(['delete', `${fileExts}\\OpenWithList`, '/v', 'a', '/f']);
  await reg(['delete', `HKCU\\Software\\PhotopeaClient\\Capabilities\\FileAssociations`, '/v', `.${ext}`, '/f']);
}

async function applyAssociations(exts) {
  if (process.platform !== 'win32') {
    saveExts(exts);
    return;
  }
  const next = new Set(exts.map((e) => e.toLowerCase()).filter(isSupportedExt));
  const prev = new Set(loadExts());
  await registerAppCapabilities();
  await registerAppPaths();
  for (const ext of prev) {
    if (!next.has(ext)) await unbindExt(ext);
  }
  for (const ext of next) await bindExt(ext);
  saveExts([...next]);
  notifyExplorer();
}

function isBoundFile(arg, exts) {
  if (typeof arg !== 'string' || arg.startsWith('-')) return false;
  const resolved = path.resolve(arg.replace(/^"(.*)"$/, '$1'));
  if (resolved.toLowerCase() === path.resolve(appExe()).toLowerCase()) return false;
  const ext = path.extname(resolved).slice(1).toLowerCase();
  return exts.includes(ext) && fs.existsSync(resolved);
}

function collectFiles(argv, exts) {
  return argv.slice(1).filter((a) => isBoundFile(a, exts)).map((a) => path.resolve(a.replace(/^"(.*)"$/, '$1')));
}

function attachAdBlock(ses) {
  ses.webRequest.onBeforeRequest((details, callback) => {
    if (/photopea\.com/i.test(details.url)) return callback({});
    if (AD_RE.test(details.url)) return callback({ cancel: true });
    callback({});
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 560,
    frame: false,
    thickFrame: true,
    resizable: true,
    maximizable: true,
    fullscreenable: false,
    backgroundColor: '#2d2d2d',
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; });
  win.on('maximize', () => win.webContents.send('win-max-state', true));
  win.on('unmaximize', () => win.webContents.send('win-max-state', false));
  win.on('enter-html-full-screen', () => {
    win.webContents.executeJavaScript('document.exitFullscreen&&document.exitFullscreen()');
    if (!win.isMaximized()) win.maximize();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url) && !url.startsWith('https://www.photopea.com')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
      event.preventDefault();
    }
  });

  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(`
      (function () {
        var extra = 320;
        var real = function () {
          if (window.visualViewport && window.visualViewport.width) return Math.round(window.visualViewport.width);
          if (document.documentElement && document.documentElement.clientWidth) return document.documentElement.clientWidth;
          return 1280;
        };
        var get = function () { return real() + extra; };
        get.__pp = true;
        try {
          Object.defineProperty(window, 'innerWidth', { configurable: true, enumerable: true, get: get });
        } catch (e) {}
        window.dispatchEvent(new Event('resize'));
      })();
    `);
  });

  win.loadURL(PHOTOPEA);
}

function openSettings() {
  if (settingsWin) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 560,
    height: 640,
    minWidth: 480,
    minHeight: 420,
    parent: win || undefined,
    modal: !!win,
    frame: false,
    resizable: true,
    backgroundColor: '#2d2d2d',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'settings-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  settingsWin.loadFile(path.join(__dirname, 'settings.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
}

function queueFiles(files, notify) {
  for (const file of files) pendingFiles.push(path.resolve(file));
  if (notify && win && pendingFiles.length) {
    win.webContents.send('file-queued', pendingFiles.map((f) => path.basename(f)));
  }
}

ipcMain.handle('take-file', async () => {
  const filePath = pendingFiles.shift();
  if (!filePath) return null;
  const data = await fs.promises.readFile(filePath);
  return { name: path.basename(filePath), data };
});

ipcMain.handle('has-pending', () => pendingFiles.length > 0);
ipcMain.handle('pending-names', () => pendingFiles.map((f) => path.basename(f)));

ipcMain.handle('assoc-state', () => ({
  groups: GROUPS,
  selected: loadExts()
}));

ipcMain.handle('assoc-save', async (_e, exts) => {
  await applyAssociations(exts);
  return loadExts();
});

ipcMain.on('assoc-close', () => settingsWin?.close());
ipcMain.on('win-min', () => win?.minimize());
ipcMain.on('win-max', () => {
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});
ipcMain.on('win-close', () => win?.close());
ipcMain.on('win-settings', () => openSettings());

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    queueFiles(collectFiles(argv, loadExts()), true);
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    app.setAppUserModelId('com.photopea.client');
    attachAdBlock(session.defaultSession);
    const exts = loadExts();
    await applyAssociations(exts);
    queueFiles(collectFiles(process.argv, exts), false);
    createWindow();
  });
}

app.on('window-all-closed', () => app.quit());
