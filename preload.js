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
  maximize: () => ipcRenderer.send('win-max'),
  floatSpace: (rect) => ipcRenderer.send('pp-float-space', rect)
});

const css = `
html,body{overflow:hidden!important}
html.pp-float-open,html.pp-float-open body{overflow:visible!important}
iframe[src*="googlesyndication"],iframe[src*="doubleclick"],iframe[src*="adservice"],iframe[src*="pagead"],ins.adsbygoogle,[id*="google_ads"]{display:none!important}
#pp-shell-root{position:fixed;inset:0;pointer-events:none;z-index:5000}
html.pp-float-open #pp-shell-root{z-index:2900}
#pp-shell-right,#pp-shell-drag,#pp-shell-controls{position:absolute;top:0;height:29px;box-sizing:border-box}
#pp-shell-right{right:176px;width:268px;background:#474747;pointer-events:auto;-webkit-app-region:drag}
#pp-shell-drag{right:444px;width:100px;background:transparent;pointer-events:auto;-webkit-app-region:drag}
html.pp-float-open #pp-shell-right,html.pp-float-open #pp-shell-drag{display:none!important}
#pp-shell-controls{right:0;display:flex;pointer-events:auto;-webkit-app-region:no-drag;background:#474747}
#pp-shell-controls button{width:44px;height:29px;border:0;padding:0;background:transparent;color:#e6e6e6;cursor:pointer;display:flex;align-items:center;justify-content:center}
#pp-shell-controls button:hover{background:rgba(255,255,255,.14)}
#pp-shell-controls button#pp-shell-settings{color:#18a497}
#pp-shell-controls button#pp-shell-settings:hover{background:rgba(24,164,151,.28);color:#2ee0cf}
#pp-shell-controls button#pp-shell-close:hover{background:#e81123;color:#fff}
#pp-shell-controls svg{width:10px;height:10px;display:block}
#pp-shell-controls #pp-shell-settings svg{width:14px;height:14px}
#pp-shell-loading{position:absolute;left:0;right:0;top:29px;bottom:0;display:none;align-items:center;justify-content:center;flex-direction:column;gap:14px;background:rgba(35,35,35,.82);color:#eee;font:13px/1.45 "Segoe UI","Microsoft YaHei UI",sans-serif;pointer-events:auto;-webkit-app-region:no-drag;z-index:1}
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
    <div id="pp-shell-right" title=""></div>
    <div id="pp-shell-drag" title="拖动窗口"></div>
    <div id="pp-shell-controls">
      <button id="pp-shell-settings" title="文件关联设置" aria-label="设置">
        <svg viewBox="0 0 14 14"><path fill="currentColor" d="M5.6 0h2.8l.35 1.65c.53.16 1.03.42 1.47.77l1.58-.66 1.98 1.98-.66 1.58c.35.44.61.94.77 1.47L14 5.6v2.8l-1.65.35c-.16.53-.42 1.03-.77 1.47l.66 1.58-1.98 1.98-1.58-.66c-.44.35-.94.61-1.47.77L8.4 14H5.6l-.35-1.65c-.53-.16-1.03-.42-1.47-.77l-1.58.66L.22 10.26l.66-1.58A4.9 4.9 0 01.72 7.2L0 8.4V5.6l1.65-.35c.16-.53.42-1.03.77-1.47L1.76 2.2 3.74.22l1.58.66c.44-.35.94-.61 1.47-.77zm1.4 4.55a2.45 2.45 0 100 4.9 2.45 2.45 0 000-4.9z"/></svg>
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
    '关于', 'About', '反馈错误', 'Report Bug', '学习', 'Learn', 'Blog', 'API',
    'Reddit', 'Twitter', 'Facebook', 'YouTube'
  ]);
  const SOCIAL_RE = /reddit|twitter|facebook|fb\\.com|x\\.com|t\\.co|youtube|youtu\\.be/i;
  const AD_TEST = /googlesyndication|doubleclick|adservice|pagead|adnxs|360yield|prebid|marphezis/;
  const leafText = (el) => (el.childElementCount ? '' : (el.textContent || '')).replace(/\\s+/g, ' ').trim();

  const hideEl = (el) => {
    if (!(el instanceof HTMLElement) || el.closest('#pp-shell-root')) return;
    const r = el.getBoundingClientRect();
    if (r.top > 42 || r.height > 42) return;
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.style.setProperty('width', '0', 'important');
    el.style.setProperty('min-width', '0', 'important');
    el.style.setProperty('margin', '0', 'important');
    el.style.setProperty('padding', '0', 'important');
    el.style.setProperty('opacity', '0', 'important');
  };

  const paintAccount = (el) => {
    if (!(el instanceof HTMLElement) || el.dataset.ppAcc === '1') return;
    el.dataset.ppAcc = '1';
    el.style.setProperty('background', '#5a5a5a', 'important');
    el.style.setProperty('background-color', '#5a5a5a', 'important');
    el.style.setProperty('background-image', 'none', 'important');
    el.style.setProperty('color', '#e8e8e8', 'important');
    el.style.setProperty('border', '0', 'important');
    el.style.setProperty('box-shadow', 'none', 'important');
    el.style.setProperty('outline', 'none', 'important');
  };

  const isSearchIcon = (el) => {
    const meta = ((el.getAttribute('title') || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.innerHTML || '')).toLowerCase();
    return /search|搜索|magnif|loupe|\\\\bm0[,\\s].*circle|\\\\ba\\s+circle/.test(meta);
  };

  const hideFullscreenNearAccount = () => {
    const vw = realWidth();
    let accountRight = 0;
    const nodes = document.body ? document.body.querySelectorAll('a,button,div,span,canvas,svg') : [];
    for (const el of nodes) {
      if (el.closest('#pp-shell-root')) continue;
      if (leafText(el) === '账户' || leafText(el) === 'Account') {
        accountRight = Math.max(accountRight, el.getBoundingClientRect().right);
      }
    }
    if (!accountRight) accountRight = vw * 0.35;
    for (const el of nodes) {
      if (el.closest('#pp-shell-root')) continue;
      const r = el.getBoundingClientRect();
      if (r.top > 34 || r.height < 12 || r.height > 30 || r.width < 12 || r.width > 30) continue;
      if (r.left < accountRight - 4) continue;
      if (r.right > vw - 170) continue;
      if (leafText(el)) continue;
      if (isSearchIcon(el)) continue;
      const title = ((el.getAttribute('title') || '') + ' ' + (el.getAttribute('aria-label') || '')).toLowerCase();
      if (/search|搜索/.test(title)) continue;
      const ratio = r.width / Math.max(r.height, 1);
      if (ratio < 0.7 || ratio > 1.4) continue;
      hideEl(el);
      if (el.parentElement && el.parentElement.getBoundingClientRect().width < 40) hideEl(el.parentElement);
    }
  };

  const hideSocialAndAbout = () => {
    const nodes = document.body ? document.body.querySelectorAll('a,button,div,span,img,svg') : [];
    for (const el of nodes) {
      if (el.closest('#pp-shell-root')) continue;
      const t = leafText(el);
      if (hideLabels.has(t)) hideEl(el);
      const href = el.getAttribute && (el.getAttribute('href') || el.getAttribute('src') || '') || '';
      const title = ((el.getAttribute && el.getAttribute('title')) || '') + ' ' + ((el.getAttribute && el.getAttribute('aria-label')) || '');
      if (SOCIAL_RE.test(href) || SOCIAL_RE.test(title)) {
        hideEl(el);
        if (el.parentElement) hideEl(el.parentElement);
      }
      if (/photopea\\.com\\/(learn|api|tuts|blog)/i.test(href)) hideEl(el);
    }
  };

  // 真正的内置浮层弹窗（Plugins 资源库、新建/导出等），排除停靠面板
  const isFloatDialog = (el) => {
    if (!(el instanceof HTMLElement) || el.closest('#pp-shell-root')) return false;
    const r = el.getBoundingClientRect();
    const vw = realWidth();
    const vh = window.innerHeight || 800;
    if (r.width < 280 || r.height < 160) return false;
    if (r.width > vw * 0.96 && r.height > vh * 0.9 && r.top < 8) return false;
    const docked =
      (r.left < 10 && r.width < vw * 0.4 && r.height > vh * 0.5) ||
      (r.right > vw - 10 && r.width < vw * 0.4 && r.height > vh * 0.5);
    if (docked) return false;
    const text = el.textContent || '';
    if (/Add Plugins/i.test(text) && /(AUTHORS|CATEGORIES)/i.test(text)) return true;
    if (/Plugins/i.test(text) && /(模板|动作|图案|图形|LUTs|AUTHORS|CATEGORIES)/.test(text) && /(Hot|New|Top|Install|安装)/i.test(text)) return true;
    if (/(新建项目|New Project|导出为|Export As|首选项|Preferences|打开自|Open From)/i.test(text) && r.width >= 320 && r.height >= 180) return true;
    const cx = r.left + r.width / 2;
    const centered = cx > vw * 0.22 && cx < vw * 0.78;
    const floating = r.top >= 20 && r.top < vh * 0.28 && r.width >= Math.min(360, vw * 0.4) && r.height >= Math.min(200, vh * 0.32);
    return centered && floating;
  };

  const findFloatDialog = () => {
    if (!document.body) return null;
    let best = null;
    let bestArea = 0;
    for (const el of document.body.querySelectorAll('div')) {
      if (!isFloatDialog(el)) continue;
      const r = el.getBoundingClientRect();
      const area = r.width * r.height;
      if (area > bestArea) { best = el; bestArea = area; }
    }
    return best;
  };

  const freeFloatAncestors = (panel) => {
    let p = panel;
    while (p && p !== document.documentElement) {
      if (p instanceof HTMLElement) {
        const cs = getComputedStyle(p);
        if (cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.overflowY === 'hidden') {
          p.style.setProperty('overflow', 'visible', 'important');
          p.style.setProperty('overflow-x', 'visible', 'important');
          p.style.setProperty('overflow-y', 'visible', 'important');
        }
        if (cs.clipPath && cs.clipPath !== 'none') p.style.setProperty('clip-path', 'none', 'important');
        if (cs.clip && cs.clip !== 'auto') p.style.setProperty('clip', 'auto', 'important');
      }
      p = p.parentElement;
    }
  };

  const elevateFloat = (panel) => {
    if (!panel) return;
    freeFloatAncestors(panel);
    panel.style.setProperty('z-index', '8000', 'important');
    panel.style.setProperty('pointer-events', 'auto', 'important');
    panel.style.setProperty('visibility', 'visible', 'important');
    panel.style.setProperty('opacity', '1', 'important');
    // 不要强制改 position/尺寸，避免 Plugins 内容区空白
  };

  let lastFloatKey = '';
  const syncFloatDialog = () => {
    const panel = findFloatDialog();
    const open = !!panel;
    document.documentElement.classList.toggle('pp-float-open', open);
    if (panel) elevateFloat(panel);

    if (!window.ppShell || !window.ppShell.floatSpace) return;
    if (!open) {
      if (lastFloatKey) {
        lastFloatKey = '';
        window.ppShell.floatSpace({ active: false });
      }
      return;
    }
    const r = panel.getBoundingClientRect();
    const key = [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)].join(',');
    if (key === lastFloatKey) return;
    lastFloatKey = key;
    window.ppShell.floatSpace({
      active: true,
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom
    });
  };

  const sweepChrome = () => {
    hideSocialAndAbout();
    hideFullscreenNearAccount();
    const nodes = document.body ? document.body.querySelectorAll('a,button,div,span') : [];
    for (const el of nodes) {
      if (el.closest('#pp-shell-root')) continue;
      const t = leafText(el);
      if (t === '账户' || t === 'Account') paintAccount(el);
    }
    for (const iframe of document.querySelectorAll('iframe')) {
      if (AD_TEST.test(iframe.src || '')) iframe.remove();
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

  const tick = () => { sweepChrome(); hideAdCol(); syncFloatDialog(); };
  tick();
  setInterval(tick, 400);
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
