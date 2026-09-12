const { contextBridge, ipcRenderer, webFrame, webUtils } = require('electron');

function showLoading(msg) {
  const el = document.getElementById('pp-shell-loading');
  const text = document.getElementById('pp-shell-loading-text');
  if (!el) return;
  if (text) {
    text.textContent = msg || ipcRenderer.sendSync('i18n-bundle').strings.opening || 'Opening…';
    text.dataset.ppDefault = '0';
  }
  el.classList.add('show');
}

function hideLoading() {
  const el = document.getElementById('pp-shell-loading');
  if (el) el.classList.remove('show');
}

function isSupportedLocalPath(p) {
  if (!p || typeof p !== 'string') return false;
  const base = p.split(/[/\\]/).pop() || '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return false;
  return !!ipcRenderer.sendSync('is-supported-ext', base.slice(dot + 1).toLowerCase());
}

contextBridge.exposeInMainWorld('ppShell', {
  takeFile: () => ipcRenderer.invoke('take-file'),
  hasPending: () => ipcRenderer.invoke('has-pending'),
  pendingNames: () => ipcRenderer.invoke('pending-names'),
  enqueuePaths: (paths) => ipcRenderer.invoke('enqueue-paths', paths),
  pathForFile: (file) => {
    try { return webUtils.getPathForFile(file) || ''; } catch (e) { return ''; }
  },
  isSupportedLocalPath,
  reportLang: (code) => ipcRenderer.send('ui-lang', code),
  i18n: (code) => ipcRenderer.sendSync('i18n-bundle', code),
  t: (key, code) => {
    const b = ipcRenderer.sendSync('i18n-bundle', code);
    return (b && b.strings && b.strings[key]) || key;
  },
  showLoading,
  hideLoading,
  maximize: () => ipcRenderer.send('win-max')
});

const css = `
html,body{overflow:hidden!important}
iframe[src*="googlesyndication"],iframe[src*="doubleclick"],iframe[src*="adservice"],iframe[src*="pagead"],ins.adsbygoogle,[id*="google_ads"]{display:none!important}
/* 壳层控件保持较低层级，编辑器内部弹窗可盖住拖拽区与窗口按钮 */
#pp-shell-root{position:fixed;inset:0;pointer-events:none;z-index:30}
#pp-shell-root.pp-shell-under-modal{z-index:0}
#pp-shell-root.pp-shell-under-modal #pp-shell-drag,
#pp-shell-root.pp-shell-under-modal #pp-shell-controls{visibility:hidden;pointer-events:none}
#pp-shell-drag,#pp-shell-controls{position:absolute;top:0;height:29px;box-sizing:border-box}
#pp-shell-drag{right:176px;width:88px;background:transparent;pointer-events:auto;-webkit-app-region:drag}
#pp-shell-controls{right:0;display:flex;pointer-events:auto;-webkit-app-region:no-drag;background:transparent;padding-right:2px}
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

function applyChromeI18n(code) {
  const b = ipcRenderer.sendSync('i18n-bundle', code);
  const s = (b && b.strings) || {};
  const set = (id, title) => {
    const el = document.getElementById(id);
    if (el && title) el.title = title;
  };
  set('pp-shell-drag', s.drag);
  set('pp-shell-settings', s.settings);
  set('pp-shell-min', s.min);
  set('pp-shell-max', s.max);
  set('pp-shell-close', s.close);
  const loading = document.getElementById('pp-shell-loading-text');
  if (loading && (!loading.textContent || loading.dataset.ppDefault === '1')) {
    loading.textContent = s.opening || 'Opening…';
    loading.dataset.ppDefault = '1';
  }
}

function injectChrome() {
  if (!document.documentElement) return;

  let style = document.getElementById('pp-shell-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'pp-shell-style';
    document.documentElement.append(style);
  }
  style.textContent = css;

  // 旧版不透明遮罩，若还在则删掉
  const obsolete = document.getElementById('pp-shell-right');
  if (obsolete) obsolete.remove();

  if (document.getElementById('pp-shell-root')) {
    applyChromeI18n();
    return;
  }

  const root = document.createElement('div');
  root.id = 'pp-shell-root';
  root.innerHTML = `
    <div id="pp-shell-drag" title="Drag window"></div>
    <div id="pp-shell-controls">
      <button id="pp-shell-settings" title="Settings" aria-label="settings">
        <svg viewBox="0 0 14 14"><path fill="currentColor" d="M5.6 0h2.8l.35 1.65c.53.16 1.03.42 1.47.77l1.58-.66 1.98 1.98-.66 1.58c.35.44.61.94.77 1.47L14 5.6v2.8l-1.65.35c-.16.53-.42 1.03-.77 1.47l.66 1.58-1.98 1.98-1.58-.66c-.44.35-.94.61-1.47.77L8.4 14H5.6l-.35-1.65c-.53-.16-1.03-.42-1.47-.77l-1.58.66L.22 10.26l.66-1.58A4.9 4.9 0 01.72 7.2L0 8.4V5.6l1.65-.35c.16-.53.42-1.03.77-1.47L1.76 2.2 3.74.22l1.58.66c.44-.35.94-.61 1.47-.77zm1.4 4.55a2.45 2.45 0 100 4.9 2.45 2.45 0 000-4.9z"/></svg>
      </button>
      <button id="pp-shell-min" title="Minimize" aria-label="minimize">
        <svg viewBox="0 0 10 10"><path fill="currentColor" d="M0 5h10v1H0z"/></svg>
      </button>
      <button id="pp-shell-max" title="Maximize" aria-label="maximize">
        <svg id="pp-shell-max-icon" viewBox="0 0 10 10"><path fill="none" stroke="currentColor" stroke-width="1.2" d="M1.2 1.2h7.6v7.6H1.2z"/></svg>
      </button>
      <button id="pp-shell-close" title="Close" aria-label="close">
        <svg viewBox="0 0 10 10"><path fill="currentColor" d="M1 0l4 4 4-4 1 1-4 4 4 4-1 1-4-4-4 4-1-1 4-4-4-4z"/></svg>
      </button>
    </div>
    <div id="pp-shell-loading" aria-live="polite">
      <div id="pp-shell-spinner"></div>
      <div id="pp-shell-loading-text" data-pp-default="1">Opening…</div>
    </div>`;

  document.documentElement.append(root);
  document.getElementById('pp-shell-settings').onclick = () => ipcRenderer.send('win-settings');
  document.getElementById('pp-shell-min').onclick = () => ipcRenderer.send('win-min');
  document.getElementById('pp-shell-max').onclick = () => ipcRenderer.send('win-max');
  document.getElementById('pp-shell-close').onclick = () => ipcRenderer.send('win-close');
  applyChromeI18n();
}

const PAGE_PATCH = `(() => {
  if (window.__ppShellInterval) return;
  window.__ppShellInterval = 1;

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
  const AD_TEST = /googlesyndication|doubleclick|adservice|pagead|adnxs|360yield|prebid|marphezis/;
  const leafText = (el) => (el.childElementCount ? '' : (el.textContent || '')).replace(/\\s+/g, ' ').trim();
  const btnText = (el) => ((el && el.textContent) || '').replace(/\\s+/g, ' ').trim();

  // 真正从 DOM 删除，而不是用壳层色块挡住
  const drop = (el) => {
    if (!(el instanceof Element) || el.closest('#pp-shell-root')) return;
    try { el.remove(); } catch (e) {}
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

  const scrubNativeChrome = () => {
    if (!document.body) return;

    // 网页 Fullscreen 四角按钮：title="Fullscreen"
    for (const el of [...document.querySelectorAll('button[title], button')]) {
      if (el.closest('#pp-shell-root')) continue;
      const title = ((el.getAttribute('title') || '') + ' ' + (el.getAttribute('aria-label') || '')).toLowerCase();
      if (title.includes('fullscreen') || title.includes('全屏')) drop(el);
    }

    // 右上角 float:right 整块（关于 / 反馈 / 学习 / Blog / API / 社交）
    for (const div of [...document.querySelectorAll('div')]) {
      if (div.closest('#pp-shell-root')) continue;
      const style = (div.getAttribute('style') || '').toLowerCase();
      if (!style.includes('float') || !style.includes('right')) continue;
      if (!/float\\s*:\\s*right/.test(style)) continue;
      const r = div.getBoundingClientRect();
      if (r.top > 48 || r.height > 64) continue;
      const text = div.textContent || '';
      if (/(关于|About|反馈错误|Report Bug|学习|Learn|Blog|API)/.test(text)) drop(div);
    }

    // 散落的同名按钮兜底
    for (const el of document.querySelectorAll('button, a, span')) {
      if (el.closest('#pp-shell-root')) continue;
      const r = el.getBoundingClientRect();
      if (r.top > 40 || r.height > 36) continue;
      const t = leafText(el) || (el.childElementCount <= 1 ? btnText(el) : '');
      if (hideLabels.has(t)) drop(el);
    }

    // 账户改色（保留）
    for (const el of document.querySelectorAll('button, a, span, div')) {
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

  // 内部浮层弹窗高于壳层按钮/拖拽区：检测后暂时让壳层退到下层并隐藏控件
  const hasEditorModal = () => {
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 800;
    for (const el of document.querySelectorAll('body div')) {
      if (!(el instanceof HTMLElement) || el.closest('#pp-shell-root')) continue;
      const st = window.getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden') continue;
      if (st.position !== 'fixed' && st.position !== 'absolute') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 260 || r.height < 160) continue;
      if (r.top <= 2 && r.height > vh * 0.8 && r.width > vw * 0.8) continue; // 全屏层忽略
      const cx = (r.left + r.right) / 2;
      const centered = Math.abs(cx - vw / 2) < vw * 0.28 && r.top > 18 && r.top < vh * 0.4;
      const coversChrome = r.right > vw - 200 && r.top < 64 && r.height > 120;
      if (centered || coversChrome) return true;
    }
    return false;
  };

  const syncShellLayer = () => {
    const root = document.getElementById('pp-shell-root');
    if (!root) return;
    root.classList.toggle('pp-shell-under-modal', hasEditorModal());
  };

  let lastLang = '';
  const readPpLang = () => {
    try {
      if (window.ci && typeof window.ci.PB === 'function') {
        const c = window.ci.PB();
        if (c) return c;
      }
    } catch (e) {}
    try {
      if (window.locStor && window.locStor.getItem) {
        const raw = window.locStor.getItem('0_stateLocal');
        if (raw) {
          const st = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (st && st.globals && st.globals.lang) return st.globals.lang;
        }
      }
    } catch (e) {}
    try {
      const ppp = JSON.parse(localStorage.getItem('_ppp') || '{}');
      const raw = ppp['0_stateLocal'];
      if (raw) {
        const st = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (st && st.globals && st.globals.lang) return st.globals.lang;
      }
    } catch (e) {}
    return '';
  };
  const syncLang = () => {
    const code = readPpLang();
    if (!code || code === lastLang) return;
    lastLang = code;
    if (window.ppShell && window.ppShell.reportLang) window.ppShell.reportLang(code);
  };

  const tick = () => {
    try {
      scrubNativeChrome();
      hideAdCol();
      syncShellLayer();
      syncLang();
    } catch (e) {}
  };
  setInterval(tick, 400);
  tick();
})();`;

const OPEN_RUNTIME = `(() => {
  if (window.__ppOpenRuntime) return;
  window.__ppOpenRuntime = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 文件名/页签比对：NFC + 去 BOM/零宽字符 + 空白折叠 + ASCII 大小写折叠
  // 避免 Windows/Chromium 对同一中文名出现“看起来一样但不相等”
  const canon = (s) => String(s || '')
    .normalize('NFC')
    .replace(/\\uFEFF/g, '')
    .replace(/[\\u200B-\\u200D\\u2060]/g, '')
    .replace(/\\u00A0/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim()
    .replace(/[A-Z]/g, (c) => c.toLowerCase());

  const stemOf = (name) => canon(name).replace(/\\.[^.]+$/, '');

  const nameMatches = (label, name) => {
    const a = canon(label);
    const b = canon(name);
    if (!a || !b) return false;
    if (a === b) return true;
    const sa = stemOf(a);
    const sb = stemOf(b);
    if (!sa || !sb) return false;
    return sa === sb || a === sb || sa === b;
  };

  const findFileInput = () => {
    const all = [...document.querySelectorAll('input[type=file]')];
    return all.find((el) => el.multiple && el.getAttribute('accept') == null) || all.find((el) => el.multiple) || all[0] || null;
  };

  const editorChrome = () => !!(
    document.querySelector('body > div.flexrow.app') ||
    document.querySelector('div.flexrow.app') ||
    document.querySelector('.flexrow.app')
  );

  // 顶栏文档页签：文件名出现即视为已打开（不依赖 window.app）
  const hasDocTabNamed = (name) => {
    const want = canon(name);
    const wantStem = stemOf(name);
    if (!want) return false;
    for (const el of document.querySelectorAll('span, div, button, label')) {
      if (el.closest('#pp-shell-root')) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom < 16 || r.top > 110 || r.height > 48 || r.width < 20) continue;
      const t = canon(el.textContent || '');
      if (!t || t.length > 120) continue;
      if (!/\\.[a-z0-9]{2,5}$/i.test(t)) continue;
      if (nameMatches(t, want) || t === wantStem) return true;
    }
    return false;
  };

  const docCount = () => {
    try {
      if (!window.app || !app.documents) return 0;
      return app.documents.length | 0;
    } catch (e) { return 0; }
  };

  const canvasCount = () => {
    try { return document.querySelectorAll('canvas').length | 0; } catch (e) { return 0; }
  };

  const waitReady = (timeoutMs) => new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const input = findFileInput();
      if (input && (window.app || editorChrome())) return resolve(input);
      if (Date.now() - start >= timeoutMs) {
        return reject(new Error(input ? '编辑器尚未完全就绪' : '编辑器未就绪（可能离线且无缓存）'));
      }
      setTimeout(tick, 50);
    };
    tick();
  });

  const waitOpened = (name, prev, timeoutMs) => new Promise((resolve) => {
    const start = Date.now();
    let namedSince = 0;
    const tick = () => {
      try {
        const docs = docCount();
        const canvases = canvasCount();
        const named = hasDocTabNamed(name);
        let activeOk = false;
        try {
          if (window.app && app.activeDocument) {
            activeOk = nameMatches(app.activeDocument.name, name);
          }
        } catch (e) {}

        if (docs > prev.docs || activeOk) return resolve(true);

        if (named) {
          if (!namedSince) namedSince = Date.now();
          // 页签已在：用户截图即此状态，立刻结束遮罩
          if (canvases > 0 || Date.now() - namedSince >= 120) return resolve(true);
        }

        // 画布已有且页签文本命中文件名主干（无扩展名的截断页签）
        if (canvases > 0 && Date.now() - start > 300) {
          const stem = stemOf(name);
          if (stem && canon(document.body.innerText || '').indexOf(stem) !== -1 && hasDocTabNamed(name)) {
            return resolve(true);
          }
        }
      } catch (e) {}

      if (Date.now() - start >= timeoutMs) return resolve(false);
      setTimeout(tick, 40);
    };
    tick();
  });

  const asFile = async (payload) => {
    if (payload && payload.url) {
      const res = await fetch(payload.url);
      if (!res.ok) throw new Error('读取本地文件失败 (' + res.status + ')');
      const blob = await res.blob();
      return new File([blob], payload.name, { type: 'application/octet-stream', lastModified: Date.now() });
    }
    const raw = payload && payload.data;
    const bytes = raw instanceof Uint8Array ? raw
      : raw instanceof ArrayBuffer ? new Uint8Array(raw)
      : Array.isArray(raw) ? Uint8Array.from(raw)
      : new Uint8Array(raw || []);
    return new File([bytes], payload.name, { type: 'application/octet-stream', lastModified: Date.now() });
  };

  const applyName = (name) => {
    if (!window.app || !app.activeDocument || !name) return false;
    const doc = app.activeDocument;
    const cur = String(doc.name || '');
    if (nameMatches(cur, name)) return true;
    try { doc.name = name; return true; } catch (e) {
      try { doc.name = stemOf(name); return true; } catch (e2) { return false; }
    }
  };

  // path → 文档页签名；关闭页签后删除，允许再次打开
  const openByPath = new Map();
  let syntheticOpen = false;

  const pathKey = (p) => String(p || '')
    .normalize('NFC')
    .replace(/\\\\/g, '/')
    .replace(/^([A-Za-z]):/, (_, d) => d.toLowerCase() + ':')
    .replace(/\\/+/g, '/')
    .replace(/\\/$/, '');

  const findDocTabEl = (name) => {
    for (const el of document.querySelectorAll('span, div, button, label')) {
      if (el.closest('#pp-shell-root')) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom < 16 || r.top > 110 || r.height > 48 || r.width < 20) continue;
      const t = canon(el.textContent || '');
      if (!t || t.length > 120 || !/\\.[a-z0-9]{2,5}$/i.test(t)) continue;
      if (nameMatches(t, name)) return el;
    }
    return null;
  };

  const focusDocTab = (name) => {
    const el = findDocTabEl(name);
    if (!el) return false;
    const clickable = el.closest('button, [role="tab"], div') || el;
    try { clickable.click(); } catch (e) { try { el.click(); } catch (e2) {} }
    return true;
  };

  const pruneBindings = () => {
    for (const [key, name] of [...openByPath.entries()]) {
      if (!hasDocTabNamed(name)) openByPath.delete(key);
    }
  };
  setInterval(pruneBindings, 700);

  const pathsFromFileList = (list) => {
    const out = [];
    if (!list || !list.length || !window.ppShell || !window.ppShell.pathForFile) return out;
    for (const f of list) {
      try {
        const p = window.ppShell.pathForFile(f);
        if (!p) continue;
        if (window.ppShell.isSupportedLocalPath && !window.ppShell.isSupportedLocalPath(p)) continue;
        out.push(p);
      } catch (e) {}
    }
    return out;
  };

  // 拖拽 / 编辑器内打开：能拿到本地路径的，统一走 enqueue → openOne
  document.addEventListener('dragover', (e) => {
    if (e.dataTransfer && e.dataTransfer.types && [...e.dataTransfer.types].includes('Files')) {
      e.preventDefault();
    }
  }, true);

  document.addEventListener('drop', (e) => {
    if (syntheticOpen) return;
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    const paths = pathsFromFileList(files);
    if (!paths.length) return; // 无本地路径或不支持格式 → 交给 Photopea
    e.preventDefault();
    e.stopImmediatePropagation();
    window.ppShell.enqueuePaths(paths);
  }, true);

  const hookFileInput = () => {
    const input = findFileInput();
    if (!input || input.dataset.ppPathHook === '1') return;
    input.dataset.ppPathHook = '1';
    input.addEventListener('change', (e) => {
      if (syntheticOpen) return;
      const paths = pathsFromFileList(input.files);
      if (!paths.length) return; // 无路径（内部新建等）或不支持 → 交给 Photopea
      e.preventDefault();
      e.stopImmediatePropagation();
      try { input.value = ''; } catch (err) {}
      window.ppShell.enqueuePaths(paths);
    }, true);
  };
  setInterval(hookFileInput, 800);
  hookFileInput();

  window.__ppShellDebug = {
    bindingCount: () => openByPath.size,
    hasBinding: (p) => openByPath.has(pathKey(p)),
    bindings: () => [...openByPath.entries()]
  };

  const tx = (key) => {
    try {
      if (window.ppShell && window.ppShell.t) return window.ppShell.t(key);
    } catch (e) {}
    return key;
  };

  const openOne = async (payload) => {
    pruneBindings();
    if (payload && payload.path) {
      const key = pathKey(payload.path);
      const bound = openByPath.get(key);
      if (bound && hasDocTabNamed(bound)) {
        focusDocTab(bound);
        return;
      }
    }

    window.ppShell.showLoading(tx('opening').replace(/…$/, '') + ' ' + payload.name + '\\n' + tx('reading'));
    const native = await asFile(payload);
    const dt = new DataTransfer();
    dt.items.add(native);
    const drop = () => {
      const ev = { bubbles: true, cancelable: true, dataTransfer: dt };
      syntheticOpen = true;
      try {
        document.dispatchEvent(new DragEvent('dragover', ev));
        document.dispatchEvent(new DragEvent('drop', ev));
      } finally { syntheticOpen = false; }
    };
    const prev = {
      docs: docCount(),
      canvas: canvasCount()
    };
    window.ppShell.showLoading(tx('opening').replace(/…$/, '') + ' ' + payload.name + '\\n' + tx('parsing'));
    const input = findFileInput();
    if (input) {
      try {
        syntheticOpen = true;
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) { drop(); }
      finally { syntheticOpen = false; }
    } else drop();

    const ok = await waitOpened(payload.name, prev, 60000);
    if (!ok) {
      if (hasDocTabNamed(payload.name) && canvasCount() > 0) {
        if (payload.path) openByPath.set(pathKey(payload.path), payload.name);
        return;
      }
      throw new Error(tx('openFail') + ': ' + payload.name);
    }
    if (window.app) applyName(payload.name);
    if (payload.path) openByPath.set(pathKey(payload.path), payload.name);
  };

  window.__ppDrainFiles = async function () {
    if (window.__ppShellOpening) return;
    window.__ppShellOpening = true;
    let lastError = '';
    try {
      const names = await window.ppShell.pendingNames();
      if (names && names.length) {
        window.ppShell.showLoading(tx('loadingEditor') + '\\n' + tx('soonOpen') + ' ' + names[0]);
      }
      await waitReady(90000);
      while (true) {
        const queued = await window.ppShell.pendingNames();
        if (!queued || !queued.length) break;
        let payload;
        try {
          payload = await window.ppShell.takeFile();
        } catch (e) {
          lastError = (e && e.message) || String(e);
          break;
        }
        if (!payload) break;
        try {
          await openOne(payload);
        } catch (e) {
          lastError = (e && e.message) || String(e);
          break;
        }
      }
      if (lastError) {
        window.ppShell.showLoading(tx('openFail') + '\\n' + lastError);
        await sleep(2800);
      }
    } catch (e) {
      window.ppShell.showLoading(tx('openFail') + '\\n' + ((e && e.message) || String(e)));
      await sleep(2800);
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

ipcRenderer.on('lang-changed', (_e, pack) => {
  applyChromeI18n(pack && pack.lang);
});

ipcRenderer.on('file-queued', (_e, names) => {
  const opening = ipcRenderer.sendSync('i18n-bundle').strings.opening || 'Opening…';
  showLoading(names && names[0] ? (opening.replace(/…$/, '') + ' ' + names[0]) : opening);
  waitAndOpen();
});
ipcRenderer.on('win-max-state', (_e, max) => {
  const icon = document.getElementById('pp-shell-max-icon');
  if (!icon) return;
  icon.innerHTML = max
    ? '<path fill="none" stroke="currentColor" stroke-width="1.1" d="M2.2 3.2h5.6v5.6H2.2zM3.2 2.2h5.6v5.6"/>'
    : '<path fill="none" stroke="currentColor" stroke-width="1.2" d="M1.2 1.2h7.6v7.6H1.2z"/>';
  const maxBtn = document.getElementById('pp-shell-max');
  if (maxBtn) {
    const b = ipcRenderer.sendSync('i18n-bundle');
    maxBtn.title = (b && b.strings && (max ? b.strings.restore : b.strings.max)) || maxBtn.title;
  }
});

const boot = () => {
  injectChrome();
  setInterval(injectChrome, 800);
  ipcRenderer.invoke('pending-names').then((names) => {
    const b = ipcRenderer.sendSync('i18n-bundle');
    const s = (b && b.strings) || {};
    if (names && names.length) {
      showLoading((s.loadingEditor || 'Loading editor…') + '\n' + (s.soonOpen || '') + ' ' + names[0]);
    }
    waitAndOpen();
  }).catch(() => waitAndOpen());
};

webFrame.executeJavaScript(PAGE_PATCH);
if (document.documentElement) boot();
else document.addEventListener('DOMContentLoaded', boot);
