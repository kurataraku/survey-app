@echo off
echo 既存のプロセスを終了中...
taskkill /F /PID 26388 2>nul
timeout /t 2 /nobreak >nul
echo .nextフォルダを完全に削除中...
if exist .next (
    rmdir /s /q .next 2>nul
    if exist .next (
        echo 警告: .nextフォルダの一部が削除できませんでした。手動で削除してください。
    )
)
echo 開発サーバーを起動中...
npm run dev






