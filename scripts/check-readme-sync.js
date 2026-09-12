'use strict';

/**
 * 校验 README.md 中英章节结构同步。
 * 规则：两侧必须包含同一组「二级标题」锚点键（去掉语言后缀后配对）。
 */
const fs = require('fs');
const path = require('path');

const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');

function sectionAfter(anchorId) {
  const needle = `<a id="${anchorId}"></a>`;
  const i = readme.indexOf(needle);
  if (i < 0) throw new Error('missing anchor: ' + anchorId);
  return readme.slice(i);
}

function h2Keys(md) {
  const keys = [];
  for (const line of md.split(/\r?\n/)) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (!m) continue;
    // 遇到下一个一级标题则停止（另一语言块）
    keys.push(m[1].trim());
  }
  return keys;
}

function takeUntilNextH1(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let seenH1 = 0;
  for (const line of lines) {
    if (/^#\s+/.test(line)) {
      seenH1++;
      if (seenH1 > 1) break;
    }
    out.push(line);
  }
  return out.join('\n');
}

/** 把中英标题映射到同一逻辑键 */
function logicalKey(title) {
  const map = [
    [/它能做什么|What it does/i, 'features'],
    [/原理|How it works/i, 'how'],
    [/代码结构|Code layout/i, 'layout'],
    [/打包|Packaging/i, 'pack'],
    [/使用方法|Usage/i, 'usage'],
    [/明确不做|Out of scope/i, 'oos'],
    [/许可|License/i, 'license']
  ];
  for (const [re, key] of map) {
    if (re.test(title)) return key;
  }
  return 'other:' + title;
}

const zhBlock = takeUntilNextH1(sectionAfter('photopeaclient-中文'));
const enBlock = takeUntilNextH1(sectionAfter('photopeaclient-english'));

const zhKeys = h2Keys(zhBlock).map(logicalKey);
const enKeys = h2Keys(enBlock).map(logicalKey);

if (!readme.includes('[中文](#photopeaclient-中文)') || !readme.includes('[English](#photopeaclient-english)')) {
  console.error('README missing top language jump links');
  process.exit(1);
}
if (!zhBlock.includes('[切换到 English]') && !zhBlock.includes('(#photopeaclient-english)')) {
  console.error('Chinese section missing link to English');
  process.exit(1);
}
if (!enBlock.includes('[Switch to 中文]') && !enBlock.includes('(#photopeaclient-中文)')) {
  console.error('English section missing link to Chinese');
  process.exit(1);
}

const zhSet = new Set(zhKeys);
const enSet = new Set(enKeys);
const onlyZh = [...zhSet].filter((k) => !enSet.has(k));
const onlyEn = [...enSet].filter((k) => !zhSet.has(k));

if (onlyZh.length || onlyEn.length) {
  console.error('README section mismatch');
  if (onlyZh.length) console.error(' only in ZH:', onlyZh.join(', '));
  if (onlyEn.length) console.error(' only in EN:', onlyEn.join(', '));
  process.exit(1);
}

// 两侧正文都不能过短（防止某一侧空壳）
if (zhBlock.length < 800 || enBlock.length < 800) {
  console.error('README language section too short (likely missing translation)');
  process.exit(1);
}

console.log('README sync OK:', zhKeys.join(', '));
