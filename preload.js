const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('ppShell', {
  takeFile: () => ipcRenderer.invoke('take-file'),
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

  let introTries = 0;
  const skipMarketing = () => {
    if (window.app && app.documents && app.documents.length > 0) return;
    introTries += 1;
    if (introTries === 2) {
      try { window.postMessage('app.documents.add(1920, 1080, 72, "Untitled");', '*'); } catch (e) {}
      try { if (window.app) app.documents.add(1920, 1080, 72, 'Untitled'); } catch (e) {}
    }
    if (introTries === 5) {
      const btn = [...document.querySelectorAll('div,button,span,a')].find((el) =>
        /^(新建项目|New Project)$/.test((el.textContent || '').trim())
      );
      if (btn) btn.click();
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

  const tick = () => { sweepChrome(); skipMarketing(); hideAdCol(); };
  tick();
  setInterval(tick, 800);
})();`;

function waitAndOpen() {
  webFrame.executeJavaScript(PAGE_PATCH);
  webFrame.executeJavaScript(`
    new Promise((resolve) => {
      if (window.app) return resolve(true);
      const done = () => resolve(true);
      const onMsg = (e) => { if (e.data === 'done') { cleanup(); done(); } };
      const t = setInterval(() => { if (window.app) { cleanup(); done(); } }, 100);
      const timeout = setTimeout(() => { cleanup(); done(); }, 20000);
      function cleanup() {
        clearInterval(t);
        clearTimeout(timeout);
        window.removeEventListener('message', onMsg);
      }
      window.addEventListener('message', onMsg);
    })
  `).then(() => webFrame.executeJavaScript(`
    (async () => {
      if (window.__ppShellOpening) return;
      window.__ppShellOpening = true;
      try {
        while (true) {
          const file = await window.ppShell.takeFile();
          if (!file) break;
          const bytes = Uint8Array.from(atob(file.b64), c => c.charCodeAt(0));
          if (window.app && typeof app.open === 'function') {
            app.open('data:application/octet-stream;base64,' + file.b64);
          } else {
            window.postMessage(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '*');
          }
        }
        if (window.app && (!app.documents || app.documents.length === 0)) {
          try { app.documents.add(1920, 1080, 72, 'Untitled'); }
          catch (e) { try { app.documents.add(1920, 1080); } catch (e2) {} }
        }
      } finally {
        window.__ppShellOpening = false;
      }
    })();
  `));
}

ipcRenderer.on('file-queued', waitAndOpen);
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
  waitAndOpen();
};

webFrame.executeJavaScript(PAGE_PATCH);
if (document.documentElement) boot();
else document.addEventListener('DOMContentLoaded', boot);
