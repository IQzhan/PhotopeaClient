#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo
echo "[PhotopeaClient] 一键打包 Windows 可执行程序"
echo

export CSC_IDENTITY_AUTO_DISCOVERY=false
export ELECTRON_MIRROR="${ELECTRON_MIRROR:-https://npmmirror.com/mirrors/electron/}"
export ELECTRON_BUILDER_BINARIES_MIRROR="${ELECTRON_BUILDER_BINARIES_MIRROR:-https://npmmirror.com/mirrors/electron-builder-binaries/}"

command -v node >/dev/null || { echo "未找到 Node.js。打包机需要 Node，生成的 exe 分发时不需要。"; exit 1; }

npm install
npx electron-builder --win dir --x64

rm -f dist/PhotopeaClient-win-x64.zip
powershell.exe -NoProfile -Command "Compress-Archive -Path 'dist\\win-unpacked\\*' -DestinationPath 'dist\\PhotopeaClient-win-x64.zip' -Force"

echo
echo "完成。"
echo "  可执行目录: dist/win-unpacked/PhotopeaClient.exe"
echo "  分发压缩包: dist/PhotopeaClient-win-x64.zip"
echo "把整个 win-unpacked 文件夹（或 zip）交给他人即可，无需安装 Node / 开发环境。"
