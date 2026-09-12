const { net, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pathToFileURL, fileURLToPath } = require('url');

// 壳页在 photopea.com；主 JS/CSS 常从 vecpea.com CDN 加载
const HOST_RE = /^(?:www\.)?(?:photopea|vecpea)\.com$/i;

function isCacheableHttps(url) {
  try {
    const u = new URL(url);
    return (u.protocol === 'https:' || u.protocol === 'http:') && HOST_RE.test(u.hostname);
  } catch (e) {
    return false;
  }
}

function cacheKey(url) {
  const u = new URL(url);
  u.hash = '';
  u.protocol = 'https:';
  return crypto.createHash('sha1').update(u.href).digest('hex');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function mimeFromUrl(url, fallback) {
  let ext = '';
  try { ext = path.extname(new URL(url).pathname).toLowerCase(); } catch (e) {}
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.wasm': 'application/wasm',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.ico': 'image/x-icon',
    '.zip': 'application/zip',
    '.bin': 'application/octet-stream'
  };
  return map[ext] || fallback || 'application/octet-stream';
}

function isNavigationPath(pathname) {
  const p = pathname || '/';
  if (p === '/' || p === '') return true;
  if (/\.html?$/i.test(p)) return true;
  return false;
}

function offlineHtml() {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>离线</title>
<style>body{margin:0;background:#2d2d2d;color:#eee;font:14px/1.5 "Segoe UI","Microsoft YaHei UI",sans-serif;display:flex;align-items:center;justify-content:center;height:100vh}
main{max-width:420px;padding:24px;text-align:center}h1{font-size:18px;font-weight:600;margin:0 0 10px;color:#18a497}p{margin:0;opacity:.9}</style></head>
<body><main><h1>需要联网完成首次缓存</h1><p>本机还没有 Photopea 编辑器缓存。请连接网络后重新打开，成功加载一次后即可离线使用。</p></main></body></html>`;
}

function httpsUrlFromAssetRequest(requestUrl) {
  const u = new URL(requestUrl);
  // pp-asset://www.photopea.com/code/x.js
  const host = u.hostname;
  const pathAndQuery = (u.pathname || '/') + (u.search || '');
  return 'https://' + host + pathAndQuery;
}

function toPpAssetUrl(httpsUrl) {
  const u = new URL(httpsUrl);
  u.hash = '';
  return 'pp-asset://' + u.host + u.pathname + u.search;
}

function registerPpSchemes() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'pp-asset',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
        bypassCSP: true,
        codeCache: true
      }
    },
    {
      scheme: 'pp-file',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
        bypassCSP: true
      }
    }
  ]);
}

function installPpCache(ses, userDataPath) {
  const root = path.join(userDataPath, 'pp-cache');
  const bodyDir = path.join(root, 'body');
  const metaPath = path.join(root, 'meta.json');
  ensureDir(bodyDir);

  let meta = {};
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch (e) {
    meta = {};
  }

  let metaTimer = null;
  const saveMetaSoon = () => {
    if (metaTimer) return;
    metaTimer = setTimeout(() => {
      metaTimer = null;
      try { fs.writeFileSync(metaPath, JSON.stringify(meta)); } catch (e) {}
    }, 400);
  };

  const bodyPath = (key) => path.join(bodyDir, key);

  const readCached = (url) => {
    const key = cacheKey(url);
    const info = meta[key];
    if (!info) return null;
    const file = bodyPath(key);
    if (!fs.existsSync(file)) return null;
    try {
      const buf = fs.readFileSync(file);
      return {
        status: info.status || 200,
        headers: info.headers || { 'Content-Type': mimeFromUrl(url, info.contentType) },
        body: buf
      };
    } catch (e) {
      return null;
    }
  };

  const writeCached = async (url, response) => {
    if (!response || !response.ok) return;
    const key = cacheKey(url);
    const file = bodyPath(key);
    try {
      const buf = Buffer.from(await response.arrayBuffer());
      if (!buf.length) return;
      const tmp = file + '.' + process.pid + '.tmp';
      fs.writeFileSync(tmp, buf);
      fs.renameSync(tmp, file);
      const ct = response.headers.get('content-type') || mimeFromUrl(url);
      const headers = { 'Content-Type': ct };
      meta[key] = { url, status: 200, contentType: ct, headers, updatedAt: Date.now(), size: buf.length };
      saveMetaSoon();
    } catch (e) {}
  };

  const toResponse = (cached) => new Response(cached.body, {
    status: cached.status,
    headers: Object.assign({ 'Access-Control-Allow-Origin': '*' }, cached.headers)
  });

  const fetchHttps = (url) => net.fetch(url, { bypassCustomProtocolHandlers: true });

  const revalidate = (url) => {
    fetchHttps(url).then(async (res) => {
      if (res && res.ok) await writeCached(url, res);
    }).catch(() => {});
  };

  const warming = new Set();
  const warmUrl = (url) => {
    if (!isCacheableHttps(url)) return;
    let clean;
    try {
      const u = new URL(url);
      u.hash = '';
      u.protocol = 'https:';
      clean = u.href;
    } catch (e) { return; }
    if (warming.has(clean)) return;
    if (readCached(clean)) return; // already have it; revalidate sparsely
    warming.add(clean);
    fetchHttps(clean).then(async (res) => {
      if (res && res.ok) await writeCached(clean, res);
    }).catch(() => {}).finally(() => warming.delete(clean));
  };

  const hasShellCache = () => !!readCached('https://www.photopea.com/');
  const hasCached = (url) => {
    try {
      const u = new URL(url);
      u.hash = '';
      u.protocol = 'https:';
      return !!readCached(u.href);
    } catch (e) {
      return !!readCached(url);
    }
  };

  ses.protocol.handle('pp-asset', async (request) => {
    let httpsUrl;
    try {
      httpsUrl = httpsUrlFromAssetRequest(request.url);
    } catch (e) {
      return new Response('bad url', { status: 400 });
    }
    if (!isCacheableHttps(httpsUrl)) {
      return new Response('forbidden host', { status: 403 });
    }

    const method = (request.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      return fetchHttps(httpsUrl);
    }

    const cached = readCached(httpsUrl);
    const nav = isNavigationPath(new URL(httpsUrl).pathname);

    if (nav) {
      try {
        const res = await fetchHttps(httpsUrl);
        if (res && res.ok) {
          writeCached(httpsUrl, res.clone()).catch(() => {});
          const headers = new Headers(res.headers);
          headers.set('Access-Control-Allow-Origin', '*');
          return new Response(res.body, { status: res.status, headers });
        }
        if (cached) return toResponse(cached);
        return res;
      } catch (e) {
        if (cached) return toResponse(cached);
        return new Response(offlineHtml(), {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
        });
      }
    }

    if (cached) {
      revalidate(httpsUrl);
      return toResponse(cached);
    }

    try {
      const res = await fetchHttps(httpsUrl);
      if (res && res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const ct = res.headers.get('content-type') || mimeFromUrl(httpsUrl);
        const key = cacheKey(httpsUrl);
        const file = bodyPath(key);
        try {
          const tmp = file + '.' + process.pid + '.tmp';
          fs.writeFileSync(tmp, buf);
          fs.renameSync(tmp, file);
          meta[key] = {
            url: httpsUrl,
            status: 200,
            contentType: ct,
            headers: { 'Content-Type': ct },
            updatedAt: Date.now(),
            size: buf.length
          };
          saveMetaSoon();
        } catch (e) {}
        return new Response(buf, {
          status: 200,
          headers: { 'Content-Type': ct, 'Access-Control-Allow-Origin': '*' }
        });
      }
      return res;
    } catch (e) {
      return new Response('', {
        status: 503,
        headers: { 'Content-Type': mimeFromUrl(httpsUrl), 'Cache-Control': 'no-store' }
      });
    }
  });

  // 预热首页 HTML，便于离线回落
  const warmShell = () => {
    warmUrl('https://www.photopea.com/');
  };
  setTimeout(warmShell, 1500);

  return {
    root,
    hasShellCache,
    hasCached,
    warmUrl,
    toPpAssetUrl,
    offlineShellUrl: (hashCfg) => 'pp-asset://www.photopea.com/' + (hashCfg ? '#' + hashCfg : '')
  };
}

function installPpFileProtocol(ses, isAllowedPath) {
  ses.protocol.handle('pp-file', async (request) => {
    let filePath = '';
    try {
      filePath = fromPpFileUrl(request.url);
    } catch (e) {
      return new Response('bad url', { status: 400 });
    }
    if (!filePath || typeof isAllowedPath !== 'function' || !isAllowedPath(filePath)) {
      return new Response('forbidden', { status: 403 });
    }
    try {
      if (!fs.existsSync(filePath)) return new Response('not found', { status: 404 });
      return net.fetch(pathToFileURL(filePath).href, { bypassCustomProtocolHandlers: true });
    } catch (e) {
      return new Response('read error', { status: 500 });
    }
  });
}

/** 用 query 承载绝对路径，避免 Chromium 把盘符吃进 hostname（pp-file://c/Users/...） */
function toPpFileUrl(absPath) {
  const resolved = path.resolve(absPath);
  return 'pp-file://local/?p=' + encodeURIComponent(resolved);
}

function fromPpFileUrl(requestUrl) {
  const u = new URL(String(requestUrl || ''));
  const q = u.searchParams.get('p');
  if (q) return path.resolve(q);

  // 兼容旧形式 / 异常重写
  if (/^[A-Za-z]$/.test(u.hostname || '')) {
    return path.resolve(u.hostname + ':' + decodeURIComponent(u.pathname || ''));
  }
  if (/^[A-Za-z]:$/i.test(u.hostname || '')) {
    return path.resolve(u.hostname + decodeURIComponent(u.pathname || ''));
  }
  let p = decodeURIComponent(u.pathname || '');
  if (/^\/[A-Za-z]:[/\\]/.test(p)) p = p.slice(1);
  if (p) return path.resolve(p);
  return fileURLToPath(String(requestUrl).replace(/^pp-file:/i, 'file:'));
}

module.exports = {
  registerPpSchemes,
  installPpCache,
  installPpFileProtocol,
  toPpFileUrl,
  toPpAssetUrl,
  isCacheableHttps
};
