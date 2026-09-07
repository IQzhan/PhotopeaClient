@echo off
setlocal
cd /d "%~dp0"

echo.
echo [PhotopeaClient] 一键打包 Windows 可执行程序
echo.

set CSC_IDENTITY_AUTO_DISCOVERY=false
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/

where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js。打包机需要安装 Node.js，生成的 exe 分发给别人时不需要。
  exit /b 1
)

call npm install
if errorlevel 1 exit /b 1

call npx electron-builder --win dir --x64
if errorlevel 1 (
  echo 打包失败。若是下载超时，请换网络后重试。
  exit /b 1
)

if exist "dist\PhotopeaClient-win-x64.zip" del /f /q "dist\PhotopeaClient-win-x64.zip"
powershell -NoProfile -Command "Compress-Archive -Path 'dist\win-unpacked\*' -DestinationPath 'dist\PhotopeaClient-win-x64.zip' -Force"

echo.
echo 完成。
echo   可执行目录: dist\win-unpacked\PhotopeaClient.exe
echo   分发压缩包: dist\PhotopeaClient-win-x64.zip
echo 把整个 win-unpacked 文件夹（或 zip）交给他人即可，无需安装 Node / 开发环境。
echo.
pause
