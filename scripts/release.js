'use strict';

/**
 * 从 CHANGELOG.md 提取尚未在 GitHub 发布的版本说明，并创建 Release。
 *
 * 用法:
 *   node scripts/release.js              # 发布 package.json 当前版本（须已有 CHANGELOG 小节且未发布）
 *   node scripts/release.js --pack       # 先打包再发布
 *   node scripts/release.js --all        # 按版本号从旧到新，发布所有「未上架」的 CHANGELOG 版本
 *   node scripts/release.js --version 1.0.1
 *
 * 不会自动改版本号。升版本请由 Agent 在「更新版本然后推 release」流程里改 package.json + CHANGELOG。
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const CHANGELOG = path.join(root, 'CHANGELOG.md');
const ZIP = path.join(root, 'release', 'PhotopeaClient-win-x64.zip');
const pkg = require(path.join(root, 'package.json'));

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    shell: true,
    stdio: opts.stdio || 'pipe',
    env: process.env
  });
  if (r.status) {
    const err = (r.stderr || r.stdout || '').trim();
    throw new Error(err || `${cmd} ${args.join(' ')} failed (${r.status})`);
  }
  return (r.stdout || '').trim();
}

function parseArgs(argv) {
  const out = { pack: false, all: false, version: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pack') out.pack = true;
    else if (a === '--all') out.all = true;
    else if (a === '--version') out.version = String(argv[++i] || '').replace(/^v/i, '');
  }
  return out;
}

/** @returns {{ version: string, date: string, body: string }[]} */
function parseChangelog(md) {
  const lines = md.split(/\r?\n/);
  const sections = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^##\s+\[([^\]]+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?\s*$/);
    if (m) {
      if (cur) sections.push(cur);
      cur = { version: m[1].trim(), date: (m[2] || '').trim(), bodyLines: [] };
      continue;
    }
    if (cur) cur.bodyLines.push(line);
  }
  if (cur) sections.push(cur);
  return sections.map((s) => ({
    version: s.version,
    date: s.date,
    body: s.bodyLines.join('\n').replace(/\n+$/g, '').replace(/^\n+/, '').trim()
  }));
}

function listPublishedVersions() {
  const set = new Set();
  try {
    const json = run('gh', ['release', 'list', '--limit', '100', '--json', 'tagName']);
    const arr = JSON.parse(json || '[]');
    for (const r of arr) {
      const tag = String(r.tagName || '').replace(/^v/i, '');
      if (tag) set.add(tag);
    }
  } catch (e) {
    // 网络失败时退回本地 tag
    try {
      const tags = run('git', ['tag', '-l', 'v*']);
      for (const t of tags.split(/\r?\n/)) {
        const v = t.replace(/^v/i, '').trim();
        if (v) set.add(v);
      }
    } catch (e2) {}
  }
  return set;
}

function cmpVer(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

function notesFor(section) {
  const title = section.date
    ? `PhotopeaClient ${section.version} (${section.date})`
    : `PhotopeaClient ${section.version}`;
  const body = section.body || '_（无额外说明）_';
  return `${title}\n\n${body}\n\n---\n下载下方 zip，解压后运行 \`PhotopeaClient\\PhotopeaClient.exe\`（勿只拷贝 exe）。\n最新入口：https://github.com/IQzhan/PhotopeaClient/releases/latest\n`;
}

function ensureZip(doPack) {
  if (doPack || !fs.existsSync(ZIP)) {
    console.log('[release] 打包…');
    run('node', ['scripts/pack-one.js'], { stdio: 'inherit' });
  }
  if (!fs.existsSync(ZIP)) throw new Error('缺少 release/PhotopeaClient-win-x64.zip，请先 npm run pack');
}

function publishOne(section) {
  const tag = `v${section.version}`;
  const notesFile = path.join(root, '.tmp', `release-notes-${section.version}.md`);
  fs.mkdirSync(path.dirname(notesFile), { recursive: true });
  fs.writeFileSync(notesFile, notesFor(section), 'utf8');

  // 确保远程有 tag（有则忽略）
  try {
    run('git', ['rev-parse', tag]);
  } catch (e) {
    run('git', ['tag', tag]);
    try { run('git', ['push', 'origin', tag]); } catch (e2) {
      console.warn('[release] push tag 失败，尝试继续创建 Release:', e2.message);
    }
  }

  console.log(`[release] 创建 GitHub Release ${tag} …`);
  run('gh', [
    'release', 'create', tag,
    ZIP,
    '--title', `v${section.version}`,
    '--notes-file', notesFile
  ], { stdio: 'inherit' });
  console.log(`[release] 完成: https://github.com/IQzhan/PhotopeaClient/releases/tag/${tag}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(CHANGELOG)) throw new Error('缺少 CHANGELOG.md');
  const sections = parseChangelog(fs.readFileSync(CHANGELOG, 'utf8'))
    .filter((s) => s.version.toLowerCase() !== 'unreleased');
  const published = listPublishedVersions();

  let todo = [];
  if (args.all) {
    todo = sections
      .filter((s) => !published.has(s.version))
      .sort((a, b) => cmpVer(a.version, b.version));
  } else {
    const ver = args.version || String(pkg.version || '').trim();
    if (!ver) throw new Error('无法确定版本号');
    if (published.has(ver)) {
      console.log(`[release] v${ver} 已发布，跳过。`);
      return;
    }
    const sec = sections.find((s) => s.version === ver);
    if (!sec) throw new Error(`CHANGELOG.md 中没有 ## [${ver}] 小节，请先写版本记录再发。`);
    todo = [sec];
  }

  if (!todo.length) {
    console.log('[release] 没有未发布的 CHANGELOG 版本。');
    return;
  }

  ensureZip(args.pack);
  for (const sec of todo) publishOne(sec);
}

try {
  main();
} catch (e) {
  console.error('[release]', e.message || e);
  process.exit(1);
}
