'use strict';

/**
 * 从 CHANGELOG.md 提取指定版本的发版说明（供 release.js / GitHub Actions 使用）。
 * 用法: node scripts/changelog-notes.js 1.0.0
 *       node scripts/changelog-notes.js v1.0.0
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const CHANGELOG = path.join(root, 'CHANGELOG.md');

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

function notesFor(section) {
  const title = section.date
    ? `PhotopeaClient ${section.version} (${section.date})`
    : `PhotopeaClient ${section.version}`;
  const body = section.body || '_（无额外说明）_';
  return `${title}\n\n${body}\n\n---\n下载下方 zip，解压后运行 \`PhotopeaClient\\PhotopeaClient.exe\`（勿只拷贝 exe）。\n最新入口：https://github.com/IQzhan/PhotopeaClient/releases/latest\n`;
}

function main() {
  const ver = String(process.argv[2] || '').replace(/^v/i, '').trim();
  if (!ver) {
    console.error('用法: node scripts/changelog-notes.js <version>');
    process.exit(1);
  }
  const md = fs.readFileSync(CHANGELOG, 'utf8');
  const sec = parseChangelog(md).find((s) => s.version === ver);
  if (!sec) {
    console.error(`CHANGELOG.md 中没有 ## [${ver}]`);
    process.exit(1);
  }
  process.stdout.write(notesFor(sec));
}

main();
