# Changelog

本项目的版本记录。日常改动先记在 `[Unreleased]`；**只有明确要发版时**才升版本号、把条目归入对应版本，并手动推 GitHub Release。

格式：`## [版本] - YYYY-MM-DD`

---

## [Unreleased]

- README：英文在前；更强调 Photopea 官网网址与原站点权益；中英同步
- 本机发版可选经 `GITHUB_API_PROXY` / `.tmp/github-api-proxy.url` 访问 GitHub API（不改系统代理）

## [1.0.0] - 2026-09-14

- 无边框桌面壳：右上角设置 / 最小化 / 最大化 / 关闭与短拖拽区
- 本地文件关联（默认 PSD）与设置窗勾选绑定
- 运行时缓存与 `pp-file` 本地打开；路径与页签去重绑定
- 设置窗 / 壳层文案覆盖 Photopea 全部语言，并随编辑器语言切换
- 内部弹窗层级高于壳层按钮（不挪 DOM、不隐藏按钮）
- 关闭主窗口时逐个走标签未保存确认
- 唯一分发目录 `release/PhotopeaClient/` + zip；临时产物进 `.tmp/`
