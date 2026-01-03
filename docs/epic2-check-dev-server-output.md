# Epic2: 開発サーバーの起動確認手順

## 問題

「✓ Starting...」のまま「✓ Ready」にならない。

## 確認手順

### Step 1: すべてのNodeプロセスを停止

1. ターミナルで以下のコマンドを実行：
   ```powershell
   Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force
   ```

### Step 2: .nextフォルダを削除（既に削除済みの場合はスキップ）

```powershell
Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue
```

### Step 3: 開発サーバーを通常モードで起動

```powershell
npm run dev
```

### Step 4: エラーメッセージを確認

- ターミナルに表示されるエラーメッセージを確認
- 特にTypeScriptのコンパイルエラーやビルドエラーがないか確認

### Step 5: エラーが表示される場合

エラーメッセージの内容に応じて対処してください。よくあるエラー：

1. **TypeScriptエラー**
   - ファイル名や行番号を確認
   - エラーメッセージに従って修正

2. **依存関係エラー**
   - `npm install`を実行

3. **環境変数エラー**
   - `.env.local`ファイルが正しく設定されているか確認









