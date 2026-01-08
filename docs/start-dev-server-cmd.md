# 開発サーバーの起動方法（コマンドプロンプト使用）

## 問題

VS CodeのターミナルがPowerShellになっているため、`npm run dev`を実行できない。

## 解決方法: コマンドプロンプトに切り替える

### Step 1: ターミナルをコマンドプロンプトに切り替える

1. **VS Codeのターミナルウィンドウを確認**
2. **ターミナルウィンドウの右上を見る**
   - `+`ボタンの横にある**`▼`**（下向き矢印）をクリック
3. **「コマンド プロンプト」または「Command Prompt」を選択**
   - メニューから選択すると、新しいターミナルが開きます
   - プロンプトが `C:\Users\...>` の形式になります（`PS`がない）

### Step 2: 正しいディレクトリに移動

コマンドプロンプトが開いたら、以下のコマンドを実行:

```cmd
cd C:\Users\taka-\OneDrive\デスクトップ\project\survey-app
```

### Step 3: 開発サーバーを起動

```cmd
npm run dev
```

### Step 4: 起動の確認

ターミナルに以下のようなメッセージが表示されれば成功です:

```
▲ Next.js 16.1.1
- Local:        http://localhost:3000
- Ready in X.Xs
```

---

## デフォルトのターミナルをコマンドプロンプトに変更（推奨）

今後、VS Codeで新しいターミナルを開いたときに自動的にコマンドプロンプトになるように設定できます：

### 方法1: 設定から変更

1. **VS Codeの設定を開く**: **Ctrl + ,**（カンマ）
2. **検索ボックスに以下を入力**: `terminal.integrated.defaultProfile.windows`
3. **ドロップダウンから「Command Prompt」を選択**

### 方法2: settings.jsonから変更

1. **VS Codeで**: **Ctrl + Shift + P**
2. **「Preferences: Open User Settings (JSON)」を選択**
3. **以下の行を追加**:

```json
{
  "terminal.integrated.defaultProfile.windows": "Command Prompt"
}
```

---

## ターミナルの種類を確認する方法

- **PowerShell**: プロンプトが `PS C:\Users\...>` の形式
- **コマンドプロンプト**: プロンプトが `C:\Users\...>` の形式（`PS`がない）
















