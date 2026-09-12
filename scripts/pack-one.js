'use strict';

/**
 * 只产出一份最新完整包到 release/PhotopeaClient/。
 * 用法: node scripts/pack-one.js  |  npm run pack  |  pack.bat
 *
 * 规范见 REQUIREMENTS.md §8 与 .cursor/rules/packaging.mdc
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
process.chdir(root);

const TMP = path.join(root, '.tmp');
const STAGING_OUT = path.join(TMP, 'staging'); // electron-builder directories.output
const STAGED = path.join(STAGING_OUT, 'win-unpacked');
const TRASH = path.join(TMP, 'trash');
const OUT_DIR = path.join(root, 'release', 'PhotopeaClient');
const ZIP = path.join(root, 'release', 'PhotopeaClient-win-x64.zip');

const REQUIRED = [
  'PhotopeaClient.exe',
  'ffmpeg.dll',
  'icudtl.dat',
  'resources.pak',
  'snapshot_blob.bin',
  'v8_context_snapshot.bin',
  path.join('resources', 'app.asar'),
  path.join('locales', 'en-US.pak')
];

const LEGACY_ROOT_JUNK = [
  'dist',
  'dist-fresh',
  'dist-staging',
  'dist-build',
  'release-app',
  'release_new',
  'out'
];

function exists(p) {
  try { return fs.existsSync(p); } catch (e) { return false; }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function rm(p) {
  if (!exists(p)) return true;
  try {
    fs.rmSync(p, { recursive: true, force: true });
    return !exists(p);
  } catch (e) {
    return false;
  }
}

/** 占用时改名挪进 .tmp/trash，避免卡死或留下残缺包 */
function quarantine(p, tag) {
  if (!exists(p)) return true;
  if (rm(p)) return true;
  ensureDir(TRASH);
  const dest = path.join(TRASH, `${tag}_${Date.now()}`);
  try {
    fs.renameSync(p, dest);
    console.warn('[pack] 占用，已隔离到 .tmp/trash:', path.basename(p));
    return true;
  } catch (e) {
    const r = spawnSync('cmd', ['/c', 'move', '/Y', path.resolve(p), path.resolve(dest)], {
      encoding: 'utf8',
      shell: false
    });
    if (exists(dest) || !exists(p)) {
      console.warn('[pack] 占用，已用 move 隔离到 .tmp/trash:', path.basename(p));
      return true;
    }
    console.error('[pack] 无法隔离占用路径:', p, (e && e.message) || (r.stderr || ''));
    return false;
  }
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, env: process.env });
  if (r.status) process.exit(r.status || 1);
}

function killAppOnly() {
  // 禁止 taskkill electron.exe（会误杀 Cursor）
  spawnSync('taskkill', ['/F', '/IM', 'PhotopeaClient.exe'], { stdio: 'ignore', shell: true });
  try {
    const marker = path.resolve(root).replace(/'/g, "''");
    const ps =
      "Get-CimInstance Win32_Process | Where-Object {" +
      " $_.Name -eq 'PhotopeaClient.exe' -or (" +
      " $_.ExecutablePath -and $_.ExecutablePath -like '*PhotopeaClient*' -and $_.ExecutablePath -like '*" +
      marker +
      "*'" +
      " ) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
    spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'ignore', shell: false });
  } catch (e) {}
}

function assertComplete(dir) {
  const missing = REQUIRED.filter((f) => !exists(path.join(dir, f)));
  if (missing.length) {
    console.error('打包不完整，缺少:', missing.join(', '));
    process.exit(1);
  }
  const dlls = fs.readdirSync(dir).filter((n) => n.toLowerCase().endsWith('.dll'));
  if (dlls.length < 8) {
    console.error('打包不完整，dll 过少:', dlls.length);
    process.exit(1);
  }
}

function sweepLegacyJunk() {
  for (const name of fs.readdirSync(root)) {
    const full = path.join(root, name);
    if (LEGACY_ROOT_JUNK.includes(name) || /^dist-build-/.test(name) || /^_trash_/.test(name)) {
      quarantine(full, name.replace(/[^\w.-]+/g, '_'));
    }
  }
  // 旧 release/win-unpacked 残缺路径
  quarantine(path.join(root, 'release', 'win-unpacked'), 'win-unpacked');
  quarantine(path.join(root, 'release', 'PhotopeaClient-ready'), 'ready');
  quarantine(path.join(root, 'release', 'PhotopeaClient.next'), 'next');
}

function publish(staged) {
  ensureDir(path.join(root, 'release'));
  const destTmp = path.join(TMP, 'PhotopeaClient.next');
  quarantine(destTmp, 'next');
  rm(destTmp);
  fs.cpSync(staged, destTmp, { recursive: true, force: true });
  assertComplete(destTmp);

  if (exists(OUT_DIR) && !quarantine(OUT_DIR, 'PhotopeaClient')) {
    const fallback = path.join(TMP, 'PhotopeaClient-ready');
    quarantine(fallback, 'ready');
    rm(fallback);
    fs.renameSync(destTmp, fallback);
    assertComplete(fallback);
    console.error('[pack] release/PhotopeaClient 被占用，完整包已写到:');
    console.error('  ' + fallback);
    process.exit(1);
  }
  fs.renameSync(destTmp, OUT_DIR);
  assertComplete(OUT_DIR);
}

console.log('[PhotopeaClient] 打包 → release/PhotopeaClient/（中间产物在 .tmp/）');
killAppOnly();
ensureDir(TMP);
ensureDir(TRASH);
sweepLegacyJunk();
quarantine(STAGING_OUT, 'staging');

process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
process.env.ELECTRON_MIRROR = process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/';
process.env.ELECTRON_BUILDER_BINARIES_MIRROR =
  process.env.ELECTRON_BUILDER_BINARIES_MIRROR ||
  'https://npmmirror.com/mirrors/electron-builder-binaries/';

run('npx', [
  'electron-builder',
  '--win',
  'dir',
  '--x64',
  `-c.directories.output=${path.relative(root, STAGING_OUT).replace(/\\/g, '/')}`
]);

if (!exists(path.join(STAGED, 'PhotopeaClient.exe'))) {
  console.error('打包产物缺失:', path.join(STAGED, 'PhotopeaClient.exe'));
  process.exit(1);
}
assertComplete(STAGED);
publish(STAGED);
quarantine(STAGING_OUT, 'staging-done');

rm(ZIP);
run('powershell', [
  '-NoProfile',
  '-Command',
  "Compress-Archive -Path 'release\\PhotopeaClient\\*' -DestinationPath 'release\\PhotopeaClient-win-x64.zip' -Force"
]);

assertComplete(OUT_DIR);
console.log('完成:');
console.log('  可执行目录: release\\PhotopeaClient\\PhotopeaClient.exe');
console.log('  分发压缩包: release\\PhotopeaClient-win-x64.zip');
console.log('  临时目录:   .tmp\\  （可随时删除）');
