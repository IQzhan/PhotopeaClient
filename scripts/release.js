'use strict';

/**
 * 发版辅助：校验 CHANGELOG，确保 tag 已推送；可选在本地用 gh 上传（网络不稳时请依赖 Actions）。
 *
 * 推荐发版路径（稳定）：
 *   1) 写好 CHANGELOG 对应版本小节 + package.json version
 *   2) commit + git tag vX.Y.Z + git push origin main --tags
 *   3) .github/workflows/release.yml 在 GitHub 上打包并创建 Release
 *
 * 用法:
 *   node scripts/release.js              # 校验当前 package 版本并确保 tag 已推送
 *   node scripts/release.js --local      # 额外尝试本机 gh 上传 zip（需先 npm run pack）
 *   node scripts/release.js --pack --local
 *   node scripts/release.js --version 1.0.1
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const CHANGELOG = path.join(root, 'CHANGELOG.md');
const ZIP = path.join(root, 'release', 'PhotopeaClient-win-x64.zip');
const PROXY_FILE = path.join(root, '.tmp', 'github-api-proxy.url');
const pkg = require(path.join(root, 'package.json'));

/** 仅给 gh 子进程用：不改系统代理。来源 GITHUB_API_PROXY 或 .tmp/github-api-proxy.url */
function githubApiProxyEnv() {
  const proxy = String(process.env.GITHUB_API_PROXY || '').trim()
    || (fs.existsSync(PROXY_FILE)
      ? fs.readFileSync(PROXY_FILE, 'utf8').split(/\r?\n/)[0].trim()
      : '');
  if (!proxy) return process.env;
  return {
    ...process.env,
    HTTPS_PROXY: proxy,
    HTTP_PROXY: proxy,
    NO_PROXY: 'localhost,127.0.0.1,::1'
  };
}

function run(cmd, args, opts = {}) {
  const env = opts.githubApiProxy ? githubApiProxyEnv() : process.env;
  if (opts.githubApiProxy && env.HTTPS_PROXY && env.HTTPS_PROXY !== process.env.HTTPS_PROXY) {
    console.log(`[release] gh 经 API 代理: ${env.HTTPS_PROXY}`);
  }
  const r = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    shell: true,
    stdio: opts.stdio || 'pipe',
    env
  });
  if (r.status) {
    const err = (r.stderr || r.stdout || '').trim();
    throw new Error(err || `${cmd} ${args.join(' ')} failed (${r.status})`);
  }
  return (r.stdout || '').trim();
}

function parseArgs(argv) {
  const out = { pack: false, local: false, version: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pack') out.pack = true;
    else if (a === '--local') out.local = true;
    else if (a === '--version') out.version = String(argv[++i] || '').replace(/^v/i, '');
  }
  return out;
}

function sectionExists(ver) {
  const md = fs.readFileSync(CHANGELOG, 'utf8');
  return new RegExp(`^##\\s+\\[${ver.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'm').test(md);
}

function ensureTag(ver) {
  const tag = `v${ver}`;
  try {
    run('git', ['rev-parse', tag]);
  } catch (e) {
    run('git', ['tag', tag]);
  }
  try {
    run('git', ['push', 'origin', tag]);
    console.log(`[release] 已推送 tag ${tag} → GitHub Actions 将打包并发布`);
  } catch (e) {
    console.warn('[release] push tag:', e.message || e);
  }
  return tag;
}

function ensureZip(doPack) {
  if (doPack || !fs.existsSync(ZIP)) {
    console.log('[release] 本地打包…');
    run('node', ['scripts/pack-one.js'], { stdio: 'inherit' });
  }
  if (!fs.existsSync(ZIP)) throw new Error('缺少 zip，请先 npm run pack');
}

function tryLocalUpload(ver) {
  const tag = `v${ver}`;
  const notesFile = path.join(root, '.tmp', `release-notes-${ver}.md`);
  fs.mkdirSync(path.dirname(notesFile), { recursive: true });
  run('node', ['scripts/changelog-notes.js', ver], { stdio: 'pipe' });
  const notes = spawnSync('node', ['scripts/changelog-notes.js', ver], {
    cwd: root,
    encoding: 'utf8',
    shell: true
  });
  if (notes.status) throw new Error(notes.stderr || 'changelog-notes failed');
  fs.writeFileSync(notesFile, notes.stdout, 'utf8');

  console.log(`[release] 尝试本机 gh 上传 ${tag} …`);
  let lastErr = null;
  for (let i = 1; i <= 3; i++) {
    try {
      run('gh', [
        'release', 'create', tag,
        ZIP,
        '--title', tag,
        '--notes-file', notesFile
      ], { stdio: 'inherit', githubApiProxy: true });
      console.log(`[release] 本机上传完成: https://github.com/IQzhan/PhotopeaClient/releases/tag/${tag}`);
      return;
    } catch (e) {
      lastErr = e;
      const msg = String(e.message || e);
      if (/already exists/i.test(msg)) {
        try {
          run('gh', ['release', 'upload', tag, ZIP, '--clobber'], {
            stdio: 'inherit',
            githubApiProxy: true
          });
          console.log(`[release] 已更新现有 Release 资源: ${tag}`);
          return;
        } catch (e2) {
          console.log(`[release] Release 已存在: https://github.com/IQzhan/PhotopeaClient/releases/tag/${tag}`);
          return;
        }
      }
      console.warn(`[release] 本机上传第 ${i} 次失败: ${msg}`);
      if (i < 3) spawnSync('ping', ['-n', '5', '127.0.0.1'], { shell: true, stdio: 'ignore' });
    }
  }
  console.warn('[release] 本机上传失败（可忽略）：tag 已推送时由 Actions 发版。', lastErr && lastErr.message);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(CHANGELOG)) throw new Error('缺少 CHANGELOG.md');
  const ver = args.version || String(pkg.version || '').trim();
  if (!ver) throw new Error('无法确定版本号');
  if (!sectionExists(ver)) {
    throw new Error(`CHANGELOG.md 中没有 ## [${ver}] 小节，请先归档版本记录。`);
  }

  const tag = ensureTag(ver);
  console.log(`[release] 版本 ${ver} / ${tag}`);
  console.log('[release] 用户下载: https://github.com/IQzhan/PhotopeaClient/releases/latest');

  if (args.local) {
    ensureZip(args.pack);
    tryLocalUpload(ver);
  } else {
    console.log('[release] 默认走 GitHub Actions（推送 tag 后自动 pack + Release）。');
    console.log('[release] 若要本机上传 zip，请加: npm run release -- --local --pack');
  }
}

try {
  main();
} catch (e) {
  console.error('[release]', e.message || e);
  process.exit(1);
}
