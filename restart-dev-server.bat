@echo off
echo 既存のプロセスを終了中...
taskkill /F /PID 26116 2>nul
echo .nextフォルダを削除中...
if exist .next rmdir /s /q .next
echo 開発サーバーを起動中...
npm run dev






