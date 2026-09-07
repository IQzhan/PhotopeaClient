# PhotopeaClient

把 [Photopea](https://www.photopea.com/)（在线版 PS 风格编辑器）做成一个**可双击运行的 Windows 桌面程序**：没有浏览器边框，看起来就像本地软件；需要时还能把 `.psd` 等格式绑定到本程序，双击文件直接打开。

> 这是 Photopea **官方网页的外壳**，不是离线克隆。打开时仍然访问线上站点，所以编辑器永远是最新版。  
> 对方电脑**不需要安装 Node.js**，只要拿到打包好的文件夹就能用。

---

## 它能做什么

- **无边框窗口**：没有系统标题栏 / 地址栏；拖动、最小化、最大化、关闭都在右上角。
- **始终在线最新**：加载 `https://www.photopea.com/`，不把网站资源打进安装包。
- **尽量干净的编辑区**：隐藏右侧广告栏相关空白、账户按钮、网页全屏图标，以及顶栏「关于 / 反馈 / Blog」等链接。
- **跳过营销首页**：尽量直接进编辑器（不自动新建 Untitled）。
- **双击打开本地文件**：默认绑定 `.psd`；设置里可勾选 Photopea 支持的更多格式。
- **单实例**：程序已开时再双击文件，会在现有窗口里打开，不会再蹦出一个进程。
- **一键打包**：生成可拷贝分发的文件夹（exe + 依赖）。

---

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
   本仓库只负责窗口、文件关联、去广告遮罩等；真正的绘画/图层能力都来自 Photopea 网站。

2. **文件关联写在当前用户注册表**  
   启动或保存设置时，会按**当前 exe 的绝对路径**写入 Windows 关联。你把文件夹挪了位置，再运行一次程序即可刷新绑定。

3. **打开本地文件尽量跟站内「打开」一样快**  
   不再把整个文件塞进超长的 base64 地址；而是做成真正的 `File`，交给页面隐藏的文件选择框处理，这样标题是原文件名，速度也更接近你在编辑器里点「打开」。

4. **需要联网**  
   第一次打开、以及平时用编辑器，都要能访问 `photopea.com`。本项目**不做**整站离线镜像。

---

## 代码结构

| 文件 | 作用 |
|------|------|
| `main.js` | Electron 主进程：建窗口、读文件、写注册表关联、拦截广告域名 |
| `preload.js` | 注入顶栏拖动区 / 遮挡块 / 窗口按钮；把本地文件送进 Photopea |
| `formats.js` | Photopea 支持打开的后缀列表（设置页用） |
| `settings.html` / `settings-preload.js` | 「文件格式绑定」设置窗口 |
| `associations.default.json` | 默认只绑定 `psd`；打包时拷到产物旁的 `associations.json` |
| `icon.png` | 程序图标（官方风格） |
| `pack.bat` / `pack.sh` | 一键打包脚本 |
| `REQUIREMENTS.md` | 更细的需求说明（给开发对照用） |

开发时本地跑：

```bash
npm install
npm start
```

---

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
| `dist\win-unpacked\` | **完整可运行目录**（发给别人就发这个文件夹） |
| `dist\win-unpacked\PhotopeaClient.exe` | 主程序 |
| `dist\win-unpacked\associations.json` | 默认关联配置（和 exe 放一起） |
| `dist\PhotopeaClient-win-x64.zip` | `pack.bat` 额外打的压缩包（方便传） |

> 不要只发一个 `PhotopeaClient.exe`。旁边的 dll、`resources` 等必须一起带走，否则别人打不开。

若打包时下载 Electron 超时，脚本里已默认使用国内镜像；也可自行设置：

```bat
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
set CSC_IDENTITY_AUTO_DISCOVERY=false
```

---

## 使用方法

### 自己用（开发或已打包）

1. 运行 `PhotopeaClient.exe`（或 `npm start`）。
2. 等页面加载完即可编辑。
3. 点右上角**齿轮**：勾选要绑定的格式 → 保存。
4. 之后在资源管理器里双击对应文件，应会用本程序打开。

### 发给其他人

1. 把整个 `win-unpacked` 文件夹（或 zip 解压后的整包）拷过去。
2. 对方**先运行一次** `PhotopeaClient.exe`（会按当前路径写入关联；默认含 `.psd`）。
3. 需要更多格式时，在设置里勾选并保存。
4. 若本机 PSD 已被 Photoshop / GIMP 等设成「始终用某某打开」，可能还要在「打开方式」或 Windows「默认应用」里选一次本程序。

### 常见说明

- **必须能上网**，否则编辑器页面加载不了。
- 文件夹路径变更后，再开一次程序，关联会改写到新路径。
- 这不是官方出品；Photopea 商标与网站内容归原作者所有。本项目仅提供开源桌面壳。

---

## 明确不做

- 不把 Photopea 网站镜像成离线包
- 不篡改编辑器核心功能
- 不用网页 Fullscreen 冒充「最大化」（最大化走系统窗口，不盖任务栏）

更完整的需求列表见 [`REQUIREMENTS.md`](./REQUIREMENTS.md)。

---

## 许可

MIT（见仓库许可声明）。Photopea 本身的版权与条款以其官方网站为准。
