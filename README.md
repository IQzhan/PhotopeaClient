# PhotopeaClient

[English](#photopeaclient-english) · [中文](#photopeaclient-中文)

**Official Photopea website:** [https://www.photopea.com/](https://www.photopea.com/)  
**Photopea 官网：** [https://www.photopea.com/](https://www.photopea.com/)

This project is an **unofficial** open-source desktop shell. It is **not** affiliated with, endorsed by, or part of Photopea. All rights to the Photopea name, website, editor, and content belong to their original owners; please respect [Photopea](https://www.photopea.com/) and its terms.  
本项目为**非官方**开源桌面壳，与 Photopea **无隶属 / 无代言 / 非官方组成部分**。Photopea 名称、网站、编辑器与内容的权益均归原作者所有；请尊重 [Photopea](https://www.photopea.com/) 及其使用条款。

---

<a id="photopeaclient-english"></a>

# PhotopeaClient English

Turn [Photopea](https://www.photopea.com/) (an online Photoshop-style editor) into a **double-clickable Windows desktop app**: no browser chrome, feels like a native tool; optionally associate `.psd` and other formats so files open in this app.

> **Attribution:** This is only a **desktop shell around the official site** [https://www.photopea.com/](https://www.photopea.com/) — not an offline clone, fork, or reimplementation. The editor still loads from that URL, so it stays up to date. Photopea’s trademarks and content remain with their owners.  
> Recipients **do not need Node.js**—only the packed folder.

[Switch to 中文](#photopeaclient-中文)

## What it does

- **Frameless window**: no system title bar / address bar; drag, minimize, maximize, and close live in the top-right.
- **Always the latest editor**: loads `https://www.photopea.com/`; site assets are not bundled into the installer.
- **Runtime cache**: warms editor assets while online; falls back to disk cache offline when possible for local files.
- **Cleaner workspace**: hides ad-column gaps, web fullscreen corners, and top-bar About / Bug / Blog links; keeps the Account entry.
- **Skip marketing intro**: tries to enter the editor directly (does not auto-create Untitled).
- **Open local files**: `.psd` is bound by default; more Photopea formats can be enabled in Settings.
- **One tab per path**: reopening the same local file focuses the existing tab.
- **Single instance**: opening another file while running uses the existing window.
- **Localized settings**: Settings and shell strings follow Photopea’s current language (updates when you switch).
- **One-click pack**: produces a copyable folder (exe + dependencies).

## How it works (plain language)

Think of it as a dedicated browser window for Photopea:

```
You double-click a PSD
   ↓
Windows starts PhotopeaClient.exe and passes the file path
   ↓
Electron opens a frameless window
   ↓
The window loads https://www.photopea.com/
   ↓
The local file is handed to the page (similar to File → Open inside the editor)
   ↓
Photopea parses and shows the image in-page
```

Key points:

1. **Shell is local; editor is online**  
   This repo owns the window, file associations, and chrome cleanup. Drawing / layers come from Photopea itself at [https://www.photopea.com/](https://www.photopea.com/).

2. **Associations are written for the current user**  
   On launch or when you save Settings, Windows associations are written to the **current absolute path of the exe**. Move the folder, run once again, and bindings refresh.

3. **Local open stays close to in-app Open**  
   Files are read via a dedicated protocol by path, turned into a real `File`, and given to the page so the document title keeps the original name.

4. **Network is required**  
   First launch and normal editing need access to `https://www.photopea.com/`. This project does **not** ship a full offline site mirror.

## Code layout

| File | Role |
|------|------|
| `main.js` | Electron main: window, files, registry associations, ad blocking |
| `preload.js` | Injects drag strip / window buttons; feeds local files into Photopea; language & stacking |
| `i18n.js` | Settings / shell strings for every Photopea language |
| `formats.js` | Openable extensions list (Settings UI) |
| `pp-cache.js` | Runtime disk cache and `pp-file` / `pp-asset` protocols |
| `settings.html` / `settings-preload.js` | File-association Settings window |
| `associations.default.json` | Default bind `psd`; copied next to the packed exe as `associations.json` |
| `icon.png` | App icon (official style) |
| `pack.bat` / `pack.sh` | One-click packaging |
| `scripts/check-readme-sync.js` | Ensures Chinese / English README sections stay paired |
| `REQUIREMENTS.md` | Final requirements snapshot for developers |

Local development:

```bash
npm install
npm start
```

Validate docs and i18n coverage:

```bash
npm run check:readme
npm run check:i18n
```

## Packaging

**The build machine needs Node.js**; end users of the packed app do not.

On Windows, the easiest path is double-clicking `pack.bat`.

Or from the repo root:

```bash
npm install
npm run build
```

Outputs:

| Path | Meaning |
|------|------|
| `release\PhotopeaClient\` | **Full runnable folder** (ship this entire folder; dll/pak/locales/resources are required, not junk) |
| `release\PhotopeaClient\PhotopeaClient.exe` | Main executable (must stay with sibling runtime files) |
| `release\PhotopeaClient\associations.json` | Default associations (beside the exe) |
| `release\PhotopeaClient-win-x64.zip` | Extra zip for sharing |
| `.tmp\` | Local scratch (staging / lock quarantine / diagnostics); safe to delete; not a release folder |

> Do not ship only `PhotopeaClient.exe`. DLLs, `resources`, etc. must travel with it.

### Get the latest build (recommended)

Always-latest download:

**https://github.com/IQzhan/PhotopeaClient/releases/latest**

Grab `PhotopeaClient-win-x64.zip`, unzip, run `PhotopeaClient.exe` inside the folder.

See `CHANGELOG.md` for notes. Packing / version bumps do **not** auto-publish; ask when you want a Release (e.g. “bump version and push release”). Pushing a `v*` tag triggers GitHub Actions to pack and publish.

If Electron downloads time out, the pack scripts already prefer a China mirror; you can also set:

```bat
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
set CSC_IDENTITY_AUTO_DISCOVERY=false
```

## Usage

### For yourself (dev or packed)

1. Run `PhotopeaClient.exe` (or `npm start`).
2. Wait for the page to load, then edit.
3. Click the top-right **gear**: check formats → Save.
4. Double-click matching files in Explorer; they should open in this app.

### Sharing with others

1. Copy the whole `release\PhotopeaClient` folder (or the unzipped pack). Do not ship the exe alone.
2. Recipients should **run `PhotopeaClient.exe` once** (writes associations for the current path; includes `.psd` by default).
3. Enable more formats in Settings if needed.
4. If another app already owns PSD “always open with…”, pick this app once in Open with / Default apps.

### Notes

- **Internet is required** for a normal editor load (cached assets may help offline afterward). The editor URL is always [https://www.photopea.com/](https://www.photopea.com/).
- After moving the folder, launch once so associations point at the new path.
- **Not an official Photopea product.** Trademarks and site content belong to their owners. This project is only an open-source desktop shell; please use Photopea in line with its own terms on the official site.

## Out of scope

- No full offline mirror of the Photopea site
- No changes to Photopea’s core editing features
- No fake “fullscreen” via the web Fullscreen API (maximize uses the system window and leaves the taskbar visible)

Full requirements: [`REQUIREMENTS.md`](./REQUIREMENTS.md).

## License

MIT (see the repository license). Photopea’s own copyright and terms are governed by its official site: [https://www.photopea.com/](https://www.photopea.com/).

---

<a id="photopeaclient-中文"></a>

# PhotopeaClient 中文

把 [Photopea](https://www.photopea.com/)（在线版 PS 风格编辑器）做成一个**可双击运行的 Windows 桌面程序**：没有浏览器边框，看起来就像本地软件；需要时还能把 `.psd` 等格式绑定到本程序，双击文件直接打开。

> **权益说明：** 这只是官方网站 [https://www.photopea.com/](https://www.photopea.com/) 的**桌面外壳**，不是离线克隆、不是分支、也不是重写版。打开时仍加载该网址，因此编辑器永远是最新版。Photopea 商标与网站内容归原作者所有。  
> 对方电脑**不需要安装 Node.js**，只要拿到打包好的文件夹就能用。

[切换到 English](#photopeaclient-english)

## 它能做什么

- **无边框窗口**：没有系统标题栏 / 地址栏；拖动、最小化、最大化、关闭都在右上角。
- **始终在线最新**：加载 `https://www.photopea.com/`，不把网站资源打进安装包。
- **运行时缓存**：在线时后台缓存编辑器资源；离线时尽量用本地缓存继续打开本地文件。
- **尽量干净的编辑区**：隐藏右侧广告栏相关空白、网页全屏图标，以及顶栏「关于 / 反馈 / Blog」等链接；保留账户入口。
- **跳过营销首页**：尽量直接进编辑器（不自动新建 Untitled）。
- **双击打开本地文件**：默认绑定 `.psd`；设置里可勾选 Photopea 支持的更多格式。
- **同一路径不重复开签**：已打开的本地文件再次打开会聚焦已有页签。
- **单实例**：程序已开时再双击文件，会在现有窗口里打开。
- **多语言设置**：设置窗与壳层文案跟随 Photopea 当前语言（含切换后即时更新）。
- **一键打包**：生成可拷贝分发的文件夹（exe + 依赖）。

## 原理（通俗版）

可以把它想成「专门给 Photopea 开的专用浏览器窗口」：

```
你双击 PSD
   ↓
Windows 启动 PhotopeaClient.exe，并把文件路径传给它
   ↓
程序用 Electron 打开一个无边框窗口
   ↓
窗口里加载官网 https://www.photopea.com/
   ↓
把本地文件交给页面（走和「编辑器里点打开」类似的路径）
   ↓
Photopea 在页面里解析并显示图像
```

要点：

1. **壳在本地，编辑器在云端**  
   本仓库只负责窗口、文件关联、去广告遮罩等；真正的绘画/图层能力都来自 Photopea 网站 [https://www.photopea.com/](https://www.photopea.com/)。

2. **文件关联写在当前用户注册表**  
   启动或保存设置时，会按**当前 exe 的绝对路径**写入 Windows 关联。你把文件夹挪了位置，再运行一次程序即可刷新绑定。

3. **打开本地文件尽量跟站内「打开」一样快**  
   本地文件经专用协议按路径读取，再做成真正的 `File` 交给页面处理，标题是原文件名。

4. **需要联网**  
   第一次打开、以及平时用编辑器，都要能访问 `https://www.photopea.com/`。本项目**不做**整站离线镜像。

## 代码结构

| 文件 | 作用 |
|------|------|
| `main.js` | Electron 主进程：建窗口、读文件、写注册表关联、拦截广告域名 |
| `preload.js` | 注入顶栏拖动区 / 窗口按钮；把本地文件送进 Photopea；语言与层级协同 |
| `i18n.js` | 设置窗 / 壳层多语言文案（对齐 Photopea 全部语言） |
| `formats.js` | Photopea 支持打开的后缀列表（设置页用） |
| `pp-cache.js` | 运行时磁盘缓存与 `pp-file` / `pp-asset` 协议 |
| `settings.html` / `settings-preload.js` | 「文件格式绑定」设置窗口 |
| `associations.default.json` | 默认只绑定 `psd`；打包时拷到产物旁的 `associations.json` |
| `icon.png` | 程序图标（官方风格） |
| `pack.bat` / `pack.sh` | 一键打包脚本 |
| `scripts/check-readme-sync.js` | 校验 README 中英章节同步 |
| `REQUIREMENTS.md` | 最终需求状态（给开发对照用） |

开发时本地跑：

```bash
npm install
npm start
```

校验文档与多语言完整性：

```bash
npm run check:readme
npm run check:i18n
```

## 打包

**打包机需要 Node.js**；打出来的程序给别人用时不需要。

Windows 最简单：双击仓库里的 `pack.bat`。

或在仓库根目录执行：

```bash
npm install
npm run build
```

产物位置：

| 路径 | 说明 |
|------|------|
| `release\PhotopeaClient\` | **完整可运行目录**（发给别人就发这个文件夹；每次打包只保留这一份。dll/pak 等不是多余文件，缺了 exe 打不开） |
| `release\PhotopeaClient\PhotopeaClient.exe` | 主程序（须与同目录其它文件一起使用） |
| `release\PhotopeaClient\associations.json` | 默认关联配置（和 exe 放一起） |
| `release\PhotopeaClient-win-x64.zip` | 额外打的压缩包（方便传） |
| `.tmp\` | 本地临时区（打包中间产物 / 占用隔离 / 诊断脚本）；可随时删除，勿当发布目录 |

> 不要只发一个 `PhotopeaClient.exe`。旁边的 dll、`resources` 等必须一起带走，否则别人打不开。

### 给别人下载最新版（推荐）

固定入口（始终指向最新 Release）：

**https://github.com/IQzhan/PhotopeaClient/releases/latest**

下载 `PhotopeaClient-win-x64.zip` → 解压 → 运行文件夹里的 `PhotopeaClient.exe`。

版本说明见仓库根目录 `CHANGELOG.md`。打包、改版本号都**不会**自动发版；需要发版时再说一声（例如「更新版本然后推 release」）。推送 `v*` tag 后由 GitHub Actions 自动打包并上传 Release。

若打包时下载 Electron 超时，脚本里已默认使用国内镜像；也可自行设置：

```bat
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
set CSC_IDENTITY_AUTO_DISCOVERY=false
```

## 使用方法

### 自己用（开发或已打包）

1. 运行 `PhotopeaClient.exe`（或 `npm start`）。
2. 等页面加载完即可编辑。
3. 点右上角**齿轮**：勾选要绑定的格式 → 保存。
4. 之后在资源管理器里双击对应文件，应会用本程序打开。

### 发给其他人

1. 把整个 `release\PhotopeaClient` 文件夹（或 zip 解压后的整包）拷过去，不要只拷贝 exe。
2. 对方**先运行一次** `PhotopeaClient.exe`（会按当前路径写入关联；默认含 `.psd`）。
3. 需要更多格式时，在设置里勾选并保存。
4. 若本机 PSD 已被 Photoshop / GIMP 等设成「始终用某某打开」，可能还要在「打开方式」或 Windows「默认应用」里选一次本程序。

### 常见说明

- **必须能上网**，否则编辑器页面加载不了（有缓存后离线可部分使用）。编辑器地址始终是 [https://www.photopea.com/](https://www.photopea.com/)。
- 文件夹路径变更后，再开一次程序，关联会改写到新路径。
- **这不是官方出品。** Photopea 商标与网站内容归原作者所有。本项目仅提供开源桌面壳；请遵守官网条款使用 Photopea。

## 明确不做

- 不把 Photopea 网站镜像成离线包
- 不篡改编辑器核心功能
- 不用网页 Fullscreen 冒充「最大化」（最大化走系统窗口，不盖任务栏）

更完整的需求列表见 [`REQUIREMENTS.md`](./REQUIREMENTS.md)。

## 许可

MIT（见仓库许可声明）。Photopea 本身的版权与条款以其官方网站为准：[https://www.photopea.com/](https://www.photopea.com/)。
