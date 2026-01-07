# Epic2: ロックファイルの強制削除手順

## 問題

「Unable to acquire lock」エラーが継続的に発生する。

## 解決手順

### Step 1: すべてのNodeプロセスを停止

```powershell
# 特定のプロセスを停止（プロセスIDを確認してから）
Stop-Process -Id <プロセスID> -Force

# または、すべてのNodeプロセスを停止
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force
```

### Step 2: 数秒待つ

プロセスが完全に終了するまで数秒待ちます。

### Step 3: .nextフォルダを削除

```powershell
Remove-Item -Path ".next" -Recurse -Force
```

### Step 4: 削除が成功したか確認

```powershell
if (Test-Path ".next") {
    Write-Host ".nextフォルダがまだ存在しています"
} else {
    Write-Host ".nextフォルダは削除されています"
}
```

### Step 5: 開発サーバーを起動

```powershell
npm run dev
```

## 手動で削除する場合

PowerShellコマンドで削除できない場合、エクスプローラーで手動削除：

1. エクスプローラーでプロジェクトフォルダを開く
2. `.next`フォルダを探す（隠しフォルダの場合、表示設定を変更）
3. `.next`フォルダを右クリック → 削除
4. 削除できない場合、管理者権限で削除を試す














