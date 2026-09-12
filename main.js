const { app, BrowserWindow, ipcMain, Menu, shell, session, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { GROUPS, DEFAULT_EXTS, isSupportedExt } = require('./formats');
const {
  registerPpSchemes,
  installPpCache,
  installPpFileProtocol,
  toPpFileUrl,
  toPpAssetUrl,
  isCacheableHttps
} = require('./pp-cache');

const PHOTOPEA_CFG = encodeURIComponent(JSON.stringify({
  environment: { intro: false }
}));
const PHOTOPEA = `https://www.photopea.com/#${PHOTOPEA_CFG}`;
const AD_RE = /googlesyndication|doubleclick|adservice\.google|pagead2|googleadservices|amazon-adsystem|adnxs\.com|360yield|prebid|marphezis|omnitagjs|pmbmonetize|smilewanted|sparteo|advolve|tappx|pubmatic|rubiconproject|criteo|taboola|adsrvr|bidswitch|id5-sync|fundingchoices|adsystem/i;

let win;
let settingsWin;
let ppCacheApi = null;
const pendingFiles = [];
const allowedFiles = new Set();

registerPpSchemes();

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

function fingerprintPath() {
  return path.join(app.getPath('userData'), 'assoc-fingerprint.json');
}

function associationFingerprint(exts) {
  return JSON.stringify({
    exe: path.resolve(appExe()).toLowerCase(),
    exts: [...new Set(exts.map((e) => e.toLowerCase()))].sort()
  });
}

function readFingerprint() {
  try {
    return fs.readFileSync(fingerprintPath(), 'utf8').trim();
  } catch (e) {
    return '';
  }
}

function writeFingerprint(exts) {
  try {
    fs.mkdirSync(path.dirname(fingerprintPath()), { recursive: true });
    fs.writeFileSync(fingerprintPath(), associationFingerprint(exts));
  } catch (e) {}
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
  await Promise.all([
    reg(['add', `HKCU\\Software\\Classes\\.${ext}`, '/ve', '/d', id, '/f']),
    reg(['add', `HKCU\\Software\\Classes\\.${ext}\\OpenWithProgids`, '/v', id, '/t', 'REG_NONE', '/d', '', '/f']),
    reg(['add', `HKCU\\Software\\Classes\\${id}`, '/ve', '/d', `Photopea ${ext.toUpperCase()}`, '/f']),
    reg(['add', `HKCU\\Software\\Classes\\${id}\\DefaultIcon`, '/ve', '/d', `${exe},0`, '/f']),
    reg(['add', `HKCU\\Software\\Classes\\${id}\\shell`, '/ve', '/d', 'open', '/f']),
    reg(['add', `HKCU\\Software\\Classes\\${id}\\shell\\open`, '/ve', '/d', '用 PhotopeaClient 打开', '/f']),
    reg(['add', `HKCU\\Software\\Classes\\${id}\\shell\\open\\command`, '/ve', '/d', command, '/f']),
    reg(['add', `HKCU\\Software\\Classes\\Applications\\${exeName}`, '/v', 'FriendlyAppName', '/d', 'PhotopeaClient', '/f']),
    reg(['add', `HKCU\\Software\\Classes\\Applications\\${exeName}\\shell\\open\\command`, '/ve', '/d', command, '/f']),
    reg(['add', `HKCU\\Software\\Classes\\Applications\\${exeName}\\SupportedTypes`, '/v', `.${ext}`, '/t', 'REG_SZ', '/d', '', '/f']),
    reg(['add', `${fileExts}\\OpenWithProgids`, '/v', id, '/t', 'REG_NONE', '/d', '', '/f']),
    reg(['add', `${fileExts}\\OpenWithList`, '/v', 'a', '/d', exeName, '/f']),
    reg(['add', `${fileExts}\\OpenWithList`, '/v', 'MRUList', '/d', 'a', '/f']),
    reg(['add', `HKCU\\Software\\PhotopeaClient\\Capabilities\\FileAssociations`, '/v', `.${ext}`, '/d', id, '/f']),
    reg(['delete', `${fileExts}\\UserChoice`, '/f']),
    reg(['delete', `${fileExts}\\UserChoiceLatest`, '/f'])
  ]);
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
  await Promise.all([
    reg(['delete', `HKCU\\Software\\Classes\\.${ext}`, '/ve', '/f']),
    reg(['delete', `HKCU\\Software\\Classes\\.${ext}\\OpenWithProgids`, '/v', id, '/f']),
    reg(['delete', `HKCU\\Software\\Classes\\${id}`, '/f']),
    reg(['delete', `${fileExts}\\OpenWithProgids`, '/v', id, '/f']),
    reg(['delete', `${fileExts}\\OpenWithList`, '/v', 'a', '/f']),
    reg(['delete', `HKCU\\Software\\PhotopeaClient\\Capabilities\\FileAssociations`, '/v', `.${ext}`, '/f'])
  ]);
}

async function applyAssociations(exts, { force = false } = {}) {
  const clean = [...new Set(exts.map((e) => e.toLowerCase()).filter(isSupportedExt))];
  if (process.platform !== 'win32') {
    saveExts(clean);
    writeFingerprint(clean);
    return clean;
  }
  if (!force && readFingerprint() === associationFingerprint(clean)) {
    return clean;
  }
  const prev = new Set(loadExts());
  const next = new Set(clean);
  await registerAppCapabilities();
  await registerAppPaths();
  const jobs = [];
  for (const ext of prev) {
    if (!next.has(ext)) jobs.push(unbindExt(ext));
  }
  for (const ext of next) jobs.push(bindExt(ext));
  await Promise.all(jobs);
  saveExts(clean);
  writeFingerprint(clean);
  notifyExplorer();
  return clean;
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

function attachNetworkHooks(ses) {
  ses.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url || '';
    if (url.startsWith('pp-asset:') || url.startsWith('pp-file:')) {
      return callback({});
    }
    // 广告拦截（不伤及 photopea / vecpea）
    if (!/(?:photopea|vecpea)\.com/i.test(url) && AD_RE.test(url)) {
      return callback({ cancel: true });
    }
    const method = (details.method || 'GET').toUpperCase();
    if (method === 'GET' && details.resourceType !== 'mainFrame' && isCacheableHttps(url)) {
      // 在线：不改写请求（避免破坏脚本执行），仅后台预热磁盘缓存
      // 离线：有缓存则重定向到 pp-asset
      if (ppCacheApi) ppCacheApi.warmUrl(url);
      if (!net.isOnline() && ppCacheApi && ppCacheApi.hasCached(url)) {
        try {
          return callback({ redirectURL: toPpAssetUrl(url) });
        } catch (e) {
          return callback({});
        }
      }
    }
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

  win.webContents.on('did-fail-load', (_e, _code, _desc, _url, isMainFrame) => {
    if (!isMainFrame || !ppCacheApi || !ppCacheApi.hasShellCache()) return;
    const offlineUrl = ppCacheApi.offlineShellUrl(PHOTOPEA_CFG);
    if (win.webContents.getURL().startsWith('pp-asset:')) return;
    win.loadURL(offlineUrl);
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
    height: 680,
    minWidth: 480,
    minHeight: 480,
    parent: win || undefined,
    modal: !!win,
    frame: false,
    resizable: true,
    useContentSize: true,
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
  settingsWin.once('ready-to-show', () => {
    try { settingsWin.setContentSize(560, 680); } catch (e) {}
  });
  settingsWin.on('closed', () => { settingsWin = null; });
}

function queueFiles(files, notify) {
  for (const file of files) {
    const resolved = path.resolve(file);
    pendingFiles.push(resolved);
    allowedFiles.add(resolved.toLowerCase());
  }
  if (notify && win && pendingFiles.length) {
    win.webContents.send('file-queued', pendingFiles.map((f) => path.basename(f)));
  }
}

ipcMain.handle('take-file', async () => {
  const filePath = pendingFiles.shift();
  if (!filePath) return null;
  if (!fs.existsSync(filePath)) {
    allowedFiles.delete(filePath.toLowerCase());
    throw new Error('文件不存在: ' + path.basename(filePath));
  }
  allowedFiles.add(filePath.toLowerCase());
  return { name: path.basename(filePath), url: toPpFileUrl(filePath) };
});

ipcMain.handle('has-pending', () => pendingFiles.length > 0);
ipcMain.handle('pending-names', () => pendingFiles.map((f) => path.basename(f)));

ipcMain.handle('assoc-state', () => ({
  groups: GROUPS,
  selected: loadExts()
}));

ipcMain.handle('assoc-save', async (_e, exts) => {
  await applyAssociations(exts, { force: true });
  return loadExts();
});

ipcMain.on('assoc-close', () => settingsWin?.close());
ipcMain.on('win-min', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on('win-max', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w) return;
  if (w.isMaximized()) w.unmaximize();
  else w.maximize();
});
ipcMain.on('win-close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
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

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    app.setAppUserModelId('com.photopea.client');
    const ses = session.defaultSession;
    ppCacheApi = installPpCache(ses, app.getPath('userData'));
    installPpFileProtocol(ses, (filePath) => allowedFiles.has(path.resolve(filePath).toLowerCase()));
    attachNetworkHooks(ses);
    const exts = loadExts();
    queueFiles(collectFiles(process.argv, exts), false);
    createWindow();
    // 关联写入不要挡住首屏：路径未变则跳过；否则后台刷新
    setImmediate(() => {
      applyAssociations(exts).catch(() => {});
    });
  });
}

app.on('window-all-closed', () => app.quit());
