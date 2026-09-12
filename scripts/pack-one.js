'use strict';

/**
 * 只产出一份最新包到 release/，并清理其它打包目录。
 * 用法: node scripts/pack-one.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
process.chdir(root);

function rm(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) {}
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, env: process.env });
  if (r.status) process.exit(r.status || 1);
}

console.log('[PhotopeaClient] 打包（仅保留 release/ 一份）');
try { spawnSync('taskkill', ['/F', '/IM', 'PhotopeaClient.exe'], { stdio: 'ignore', shell: true }); } catch (e) {}

rm(path.join(root, 'release'));
rm(path.join(root, 'dist-staging'));
rm(path.join(root, 'dist-fresh'));
for (const name of fs.readdirSync(root)) {
  if (/^dist-build-/.test(name) || /^_trash_dist/.test(name)) rm(path.join(root, name));
}
// 旧 dist 常被占用：删不掉就改名藏起来，避免和 release 并存造成混乱
const distPath = path.join(root, 'dist');
if (fs.existsSync(distPath)) {
  rm(distPath);
  if (fs.existsSync(distPath)) {
    const trash = path.join(root, '_trash_dist_' + Date.now());
    try { fs.renameSync(distPath, trash); } catch (e) {}
  }
}
process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
process.env.ELECTRON_MIRROR = process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/';
process.env.ELECTRON_BUILDER_BINARIES_MIRROR =
  process.env.ELECTRON_BUILDER_BINARIES_MIRROR ||
  'https://npmmirror.com/mirrors/electron-builder-binaries/';

run('npx', ['electron-builder', '--win', 'dir', '--x64', '-c.directories.output=dist-staging']);

const exe = path.join(root, 'dist-staging', 'win-unpacked', 'PhotopeaClient.exe');
if (!fs.existsSync(exe)) {
  console.error('打包产物缺失:', exe);
  process.exit(1);
}

fs.mkdirSync(path.join(root, 'release'), { recursive: true });
fs.renameSync(path.join(root, 'dist-staging', 'win-unpacked'), path.join(root, 'release', 'win-unpacked'));
rm(path.join(root, 'dist-staging'));

const zip = path.join(root, 'release', 'PhotopeaClient-win-x64.zip');
rm(zip);
run('powershell', [
  '-NoProfile',
  '-Command',
  "Compress-Archive -Path 'release\\win-unpacked\\*' -DestinationPath 'release\\PhotopeaClient-win-x64.zip' -Force"
]);

console.log('完成（仅此一份）:');
console.log('  可执行目录: release\\win-unpacked\\PhotopeaClient.exe');
console.log('  分发压缩包: release\\PhotopeaClient-win-x64.zip');
