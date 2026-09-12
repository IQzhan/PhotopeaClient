'use strict';

/**
 * 只结束本仓库的 PhotopeaClient.exe。
 * 禁止 taskkill electron.exe（Cursor 也是 Electron）。
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');

spawnSync('taskkill', ['/F', '/IM', 'PhotopeaClient.exe'], { stdio: 'ignore', shell: true });

const marker = root.replace(/'/g, "''");
const ps = `
Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq 'PhotopeaClient.exe' -or (
    $_.ExecutablePath -and
    $_.ExecutablePath -like '*PhotopeaClient.exe' -and
    $_.ExecutablePath -like '*${marker}*'
  )
} | ForEach-Object {
  Write-Host ('kill ' + $_.ProcessId + ' ' + $_.ExecutablePath)
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}
`;
spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit', shell: false });
console.log('[kill-app] done (PhotopeaClient only)');
