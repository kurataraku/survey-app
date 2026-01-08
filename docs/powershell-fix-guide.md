# PowerShell実行ポリシーエラーの解決方法

## 問題

PowerShellで以下のエラーが表示される場合:
```
このシステムではスクリプトの実行が無効になっているため、ファイル C:\Program Files\nodejs\npm.ps1 を
読み込むことができません。
```

これはPowerShellのセキュリティ設定によるものです。

---

## 解決方法（3つの選択肢）

### 方法1: コマンドプロンプト（cmd.exe）を使用する（最も簡単・推奨）

1. **VS Codeの新しいターミナルを開く**:
   - VS Code上部のメニュー: `ターミナル` → `新しいターミナル`
   - または、**Ctrl + Shift + `**（バッククォート）

2. **ターミナルの種類を変更する**:
   - ターミナルウィンドウ右上の `+` の横にある `▼` をクリック
   - `コマンド プロンプト` または `Command Prompt` を選択

3. **プロジェクトフォルダに移動**:
   ```cmd
   cd C:\Users\taka-\OneDrive\デスクトップ\project\survey-app
   ```

4. **開発サーバーを起動**:
   ```cmd
   npm run dev
   ```

**この方法なら実行ポリシーの問題は発生しません。**

---

### 方法2: PowerShellの実行ポリシーを一時的に変更する

現在のPowerShellウィンドウで、以下のコマンドを実行:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```

その後、再度 `npm run dev` を実行してください。

**注意**: この変更は現在のPowerShellセッションのみに適用されます。ウィンドウを閉じると元に戻ります。

---

### 方法3: 実行ポリシーをバイパスしてnpmを実行する

PowerShellで以下のように実行:

```powershell
powershell -ExecutionPolicy Bypass -Command "npm run dev"
```

または、npxを直接使用:

```powershell
npx next dev
```

---

## 推奨される方法

**方法1（コマンドプロンプトを使用）** が最も簡単で安全です。VS Codeのターミナルをコマンドプロンプトに切り替えて実行してください。

















