const { contextBridge, ipcRenderer, webFrame } = require('electron');

function showLoading(msg) {
  const el = document.getElementById('pp-shell-loading');
  const text = document.getElementById('pp-shell-loading-text');
  if (!el) return;
  if (text) text.textContent = msg || '正在打开…';
  el.classList.add('show');
}

function hideLoading() {
  const el = document.getElementById('pp-shell-loading');
  if (el) el.classList.remove('show');
}

contextBridge.exposeInMainWorld('ppShell', {
  takeFile: () => ipcRenderer.invoke('take-file'),
  hasPending: () => ipcRenderer.invoke('has-pending'),
  pendingNames: () => ipcRenderer.invoke('pending-names'),
  showLoading,
  hideLoading,
  maximize: () => ipcRenderer.send('win-max')
});

const css = `
html,body{overflow:hidden!important}
iframe[src*="googlesyndication"],iframe[src*="doubleclick"],iframe[src*="adservice"],iframe[src*="pagead"],ins.adsbygoogle,[id*="google_ads"]{display:none!important}
#pp-shell-root{position:fixed;inset:0;pointer-events:none;z-index:2147483647}
#pp-shell-account,#pp-shell-right,#pp-shell-drag,#pp-shell-controls{position:absolute;top:0;height:29px;box-sizing:border-box}
#pp-shell-account{left:398px;width:150px;background:#474747;pointer-events:auto;-webkit-app-region:drag}
#pp-shell-drag{left:548px;right:430px;background:transparent;pointer-events:auto;-webkit-app-region:drag}
#pp-shell-right{right:178px;width:252px;background:#474747;pointer-events:auto;-webkit-app-region:drag}
#pp-shell-controls{right:0;display:flex;pointer-events:auto;-webkit-app-region:no-drag;background:#474747}
#pp-shell-controls button{width:44px;height:29px;border:0;padding:0;background:transparent;color:#e6e6e6;cursor:pointer;display:flex;align-items:center;justify-content:center}
#pp-shell-controls button:hover{background:rgba(255,255,255,.14)}
#pp-shell-controls button#pp-shell-close:hover{background:#e81123;color:#fff}
#pp-shell-controls svg{width:10px;height:10px;display:block}
#pp-shell-loading{position:absolute;left:0;right:0;top:29px;bottom:0;display:none;align-items:center;justify-content:center;flex-direction:column;gap:14px;background:rgba(35,35,35,.82);color:#eee;font:13px/1.45 "Segoe UI","Microsoft YaHei UI",sans-serif;pointer-events:auto;-webkit-app-region:no-drag}
#pp-shell-loading.show{display:flex}
#pp-shell-spinner{width:28px;height:28px;border:3px solid rgba(255,255,255,.18);border-top-color:#18a497;border-radius:50%;animation:pp-spin .8s linear infinite}
#pp-shell-loading-text{max-width:70%;text-align:center;word-break:break-all;white-space:pre-line}
@keyframes pp-spin{to{transform:rotate(360deg)}}
`;

function injectChrome() {
  if (document.getElementById('pp-shell-root') || !document.documentElement) return;

  const style = document.createElement('style');
  style.id = 'pp-shell-style';
  style.textContent = css;

  const root = document.createElement('div');
  root.id = 'pp-shell-root';
  root.innerHTML = `
    <div id="pp-shell-account" title=""></div>
    <div id="pp-shell-drag"></div>
    <div id="pp-shell-right"></div>
    <div id="pp-shell-controls">
      <button id="pp-shell-settings" title="文件关联" aria-label="设置">
        <svg viewBox="0 0 12 12"><path fill="currentColor" d="M4.8 0h2.4l.3 1.4a4.4 4.4 0 011.3.8L10.3 1.6l1.7 1.7-1.6 1.5c.2.4.3.9.3 1.3 0 .5-.1.9-.3 1.3l1.6 1.5-1.7 1.7-1.5-1.6a4.4 4.4 0 01-1.3.8L7.2 12H4.8l-.3-1.4a4.4 4.4 0 01-1.3-.8L1.7 11.4.02 9.7l1.6-1.5A4.2 4.2 0 011.3 6.9 4.2 4.2 0 011.62 5.6L.02 4.1 1.7 2.4l1.5 1.6a4.4 4.4 0 011.3-.8zm1.2 4.1A1.9 1.9 0 106 7.9a1.9 1.9 0 000-3.8z"/></svg>
      </button>
      <button id="pp-shell-min" title="最小化" aria-label="最小化">
        <svg viewBox="0 0 10 10"><path fill="currentColor" d="M0 5h10v1H0z"/></svg>
      </button>
      <button id="pp-shell-max" title="最大化" aria-label="最大化">
        <svg id="pp-shell-max-icon" viewBox="0 0 10 10"><path fill="none" stroke="currentColor" stroke-width="1.2" d="M1.2 1.2h7.6v7.6H1.2z"/></svg>
      </button>
      <button id="pp-shell-close" title="关闭" aria-label="关闭">
        <svg viewBox="0 0 10 10"><path fill="currentColor" d="M1 0l4 4 4-4 1 1-4 4 4 4-1 1-4-4-4 4-1-1 4-4-4-4z"/></svg>
      </button>
    </div>
    <div id="pp-shell-loading" aria-live="polite">
      <div id="pp-shell-spinner"></div>
      <div id="pp-shell-loading-text">正在打开…</div>
    </div>`;

  document.documentElement.append(style, root);
  document.getElementById('pp-shell-settings').onclick = () => ipcRenderer.send('win-settings');
  document.getElementById('pp-shell-min').onclick = () => ipcRenderer.send('win-min');
  document.getElementById('pp-shell-max').onclick = () => ipcRenderer.send('win-max');
  document.getElementById('pp-shell-close').onclick = () => ipcRenderer.send('win-close');
}

const PAGE_PATCH = `(() => {
  if (window.__ppShellPatched) return;
  window.__ppShellPatched = true;

  const EXTRA = 320;
  const realWidth = () => {
    if (window.visualViewport && window.visualViewport.width > 0) return Math.round(window.visualViewport.width);
    if (document.documentElement && document.documentElement.clientWidth > 0) return document.documentElement.clientWidth;
    return window.outerWidth || 1280;
  };
  const spoof = () => realWidth() + EXTRA;
  spoof.__pp = true;
  try {
    Object.defineProperty(window, 'innerWidth', { configurable: true, enumerable: true, get: spoof });
  } catch (e) {}

  const relayout = () => {
    try {
      const d = Object.getOwnPropertyDescriptor(window, 'innerWidth');
      if (!d || !d.get || !d.get.__pp) {
        Object.defineProperty(window, 'innerWidth', { configurable: true, enumerable: true, get: spoof });
      }
      window.dispatchEvent(new Event('resize'));
    } catch (e) {}
  };
  [0, 50, 200, 600, 1500, 4000].forEach((t) => setTimeout(relayout, t));
  window.addEventListener('load', relayout, { once: true });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', relayout);

  const blockFs = function () {
    if (window.ppShell && window.ppShell.maximize) window.ppShell.maximize();
    return Promise.resolve();
  };
  Element.prototype.requestFullscreen = blockFs;
  HTMLElement.prototype.webkitRequestFullScreen = blockFs;
  HTMLElement.prototype.webkitRequestFullscreen = blockFs;
  Document.prototype.exitFullscreen = function () { return Promise.resolve(); };

  const hideLabels = new Set([
    '账户', 'Account', '关于', 'About', '反馈错误', 'Report Bug', '学习', 'Learn', 'Blog', 'API',
    'Reddit', 'Twitter', 'Facebook', 'YouTube'
  ]);
  const AD_TEST = /googlesyndication|doubleclick|adservice|pagead|adnxs|360yield|prebid|marphezis/;
  const hideEl = (el) => {
    if (!(el instanceof HTMLElement) || el.closest('#pp-shell-root')) return;
    const r = el.getBoundingClientRect();
    if (r.top > 40 || r.height > 40 || r.width > 220) return;
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
  };
  const sweepChrome = () => {
    const nodes = document.body ? document.body.querySelectorAll('a,button,div,span') : [];
    for (const el of nodes) {
      const t = (el.childElementCount ? '' : (el.textContent || '')).replace(/\\s+/g, ' ').trim();
      if (hideLabels.has(t)) hideEl(el);
      const href = (el.getAttribute && el.getAttribute('href')) || '';
      if (/reddit|twitter|facebook|x\\.com|youtube|photopea\\.com\\/(learn|api|tuts)/i.test(href)) hideEl(el);
    }
    for (const iframe of document.querySelectorAll('iframe')) {
      const src = iframe.src || '';
      if (AD_TEST.test(src)) iframe.remove();
    }
  };

  const hideAdCol = () => {
    const col = document.querySelector('body > div.flexrow.app > div:nth-child(2)');
    if (col) {
      col.style.setProperty('display', 'none', 'important');
      col.style.setProperty('width', '0', 'important');
      col.style.setProperty('max-width', '0', 'important');
      col.style.setProperty('overflow', 'hidden', 'important');
    }
    const main = document.querySelector('body > div.flexrow.app > div:nth-child(1)');
    if (main) {
      main.style.setProperty('width', '100%', 'important');
      main.style.setProperty('max-width', '100%', 'important');
      main.style.setProperty('flex', '1 1 auto', 'important');
    }
  };

  const tick = () => { sweepChrome(); hideAdCol(); };
  tick();
  setInterval(tick, 800);
})();`;

const OPEN_RUNTIME = `(() => {
  if (window.__ppOpenRuntime) return;
  window.__ppOpenRuntime = true;

  const findFileInput = () => {
    const all = [...document.querySelectorAll('input[type=file]')];
    return all.find((el) => el.multiple && el.getAttribute('accept') == null) || all.find((el) => el.multiple) || all[0] || null;
  };

  const waitInput = () => new Promise((resolve) => {
    const now = findFileInput();
    if (now) return resolve(now);
    const t = setInterval(() => {
      const el = findFileInput();
      if (el) { clearInterval(t); resolve(el); }
    }, 40);
    setTimeout(() => { clearInterval(t); resolve(findFileInput()); }, 60000);
  });

  const asFile = (payload) => {
    const raw = payload && payload.data;
    const bytes = raw instanceof Uint8Array ? raw
      : raw instanceof ArrayBuffer ? new Uint8Array(raw)
      : Array.isArray(raw) ? Uint8Array.from(raw)
      : new Uint8Array(raw || []);
    return new File([bytes], payload.name, { type: 'application/octet-stream', lastModified: Date.now() });
  };

  const applyName = (name) => {
    if (!window.app || !app.activeDocument || !name) return;
    const doc = app.activeDocument;
    const cur = String(doc.name || '');
    if (cur === name || cur === name.replace(/\\.[^.]+$/, '')) return;
    try { doc.name = name; } catch (e) {
      try { doc.name = name.replace(/\\.[^.]+$/, ''); } catch (e2) {}
    }
  };

  const openOne = async (payload) => {
    const native = asFile(payload);
    const dt = new DataTransfer();
    dt.items.add(native);
    const drop = () => {
      const ev = { bubbles: true, cancelable: true, dataTransfer: dt };
      document.dispatchEvent(new DragEvent('dragover', ev));
      document.dispatchEvent(new DragEvent('drop', ev));
    };
    const input = await waitInput();
    if (input) {
      try {
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) { drop(); }
    } else drop();
    [300, 1000, 2500].forEach((ms) => setTimeout(() => applyName(payload.name), ms));
  };

  window.__ppDrainFiles = async function () {
    if (window.__ppShellOpening) return;
    window.__ppShellOpening = true;
    try {
      const names = await window.ppShell.pendingNames();
      if (names && names.length) window.ppShell.showLoading('正在加载编辑器…\\n即将打开 ' + names[0]);
      await waitInput();
      while (true) {
        const queued = await window.ppShell.pendingNames();
        if (!queued || !queued.length) break;
        window.ppShell.showLoading('正在打开 ' + queued[0]);
        const payload = await window.ppShell.takeFile();
        if (!payload) break;
        window.ppShell.showLoading('正在打开 ' + payload.name);
        await openOne(payload);
      }
    } finally {
      window.ppShell.hideLoading();
      window.__ppShellOpening = false;
      const leftover = await window.ppShell.hasPending();
      if (leftover) window.__ppDrainFiles();
    }
  };
})();`;

function waitAndOpen() {
  webFrame.executeJavaScript(PAGE_PATCH);
  webFrame.executeJavaScript(OPEN_RUNTIME).then(() => webFrame.executeJavaScript('window.__ppDrainFiles()'));
}

ipcRenderer.on('file-queued', (_e, names) => {
  showLoading(names && names[0] ? ('正在打开 ' + names[0]) : '正在打开…');
  waitAndOpen();
});
ipcRenderer.on('win-max-state', (_e, max) => {
  const icon = document.getElementById('pp-shell-max-icon');
  if (!icon) return;
  icon.innerHTML = max
    ? '<path fill="none" stroke="currentColor" stroke-width="1.1" d="M2.2 3.2h5.6v5.6H2.2zM3.2 2.2h5.6v5.6"/>'
    : '<path fill="none" stroke="currentColor" stroke-width="1.2" d="M1.2 1.2h7.6v7.6H1.2z"/>';
});

const boot = () => {
  injectChrome();
  setInterval(injectChrome, 800);
  ipcRenderer.invoke('pending-names').then((names) => {
    if (names && names.length) showLoading('正在加载编辑器…\n即将打开 ' + names[0]);
    waitAndOpen();
  }).catch(() => waitAndOpen());
};

webFrame.executeJavaScript(PAGE_PATCH);
if (document.documentElement) boot();
else document.addEventListener('DOMContentLoaded', boot);
