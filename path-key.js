'use strict';

const path = require('path');

/** Windows 下同一路径的稳定键：resolve + NFC + 反斜杠统一 + 盘符小写 */
function pathKey(p) {
  return path.resolve(String(p || ''))
    .normalize('NFC')
    .replace(/\\/g, '/')
    .replace(/^([A-Za-z]):/, (_, d) => d.toLowerCase() + ':')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '');
}

/** 页签/文件名比对：NFC + 去 BOM/零宽 + 空白折叠 + ASCII 大小写折叠 */
function canonName(s) {
  return String(s || '')
    .normalize('NFC')
    .replace(/\uFEFF/g, '')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[A-Z]/g, (c) => c.toLowerCase());
}

function stemOf(name) {
  return canonName(name).replace(/\.[^.]+$/, '');
}

function nameMatches(label, name) {
  const a = canonName(label);
  const b = canonName(name);
  if (!a || !b) return false;
  if (a === b) return true;
  const sa = stemOf(a);
  const sb = stemOf(b);
  if (!sa || !sb) return false;
  return sa === sb || a === sb || sa === b;
}

module.exports = { pathKey, canonName, stemOf, nameMatches };
