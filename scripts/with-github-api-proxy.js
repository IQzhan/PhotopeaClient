'use strict';

/**
 * 仅让「当前这一条命令」经代理访问 GitHub API，不改系统/浏览器代理。
 *
 * 代理地址来源（优先）：
 *   1) 环境变量 GITHUB_API_PROXY
 *   2) .tmp/github-api-proxy.url（一行，如 http://1.2.3.4:8080）
 *
 * 用法:
 *   node scripts/with-github-api-proxy.js gh release list
 *   node scripts/with-github-api-proxy.js gh api rate_limit
 *
 * 注意: 公共免费代理极不稳定，且公司可能禁止；优先用自有/合规代理。
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const file = path.join(root, '.tmp', 'github-api-proxy.url');

function loadProxy() {
  const fromEnv = String(process.env.GITHUB_API_PROXY || '').trim();
  if (fromEnv) return fromEnv;
  if (fs.existsSync(file)) {
    const u = fs.readFileSync(file, 'utf8').split(/\r?\n/)[0].trim();
    if (u) return u;
  }
  return '';
}

const argv = process.argv.slice(2);
if (!argv.length) {
  console.error('用法: node scripts/with-github-api-proxy.js <命令> [参数...]');
  process.exit(2);
}

const proxy = loadProxy();
if (!proxy) {
  console.error('[proxy] 未配置。请设置 GITHUB_API_PROXY 或写入 .tmp/github-api-proxy.url');
  process.exit(1);
}

const env = {
  ...process.env,
  HTTPS_PROXY: proxy,
  HTTP_PROXY: proxy,
  // 避免把其它本机服务误走代理；GitHub API/上传仍走 HTTPS_PROXY
  NO_PROXY: 'localhost,127.0.0.1,::1'
};

console.log(`[proxy] 仅本命令使用: ${proxy}`);
const r = spawnSync(argv[0], argv.slice(1), {
  cwd: root,
  env,
  shell: true,
  stdio: 'inherit'
});
process.exit(r.status == null ? 1 : r.status);
