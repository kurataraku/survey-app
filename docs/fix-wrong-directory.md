# 間違ったディレクトリにいる問題の解決方法

## 問題

エラーメッセージに以下のようなパスが表示されている:
```
C:\Users\taka-\OneDrive\デスクトップ\project\delta-recruit-static-starter\survey-app\package.json
```

これは間違ったパスです。正しいパスは:
```
C:\Users\taka-\OneDrive\デスクトップ\project\survey-app
```

## 解決方法

### Step 1: 現在のディレクトリを確認

コマンドプロンプトで以下を実行:

```cmd
cd
```

現在のディレクトリが表示されます。

### Step 2: 正しいディレクトリに移動

コマンドプロンプトで以下を実行:

```cmd
cd C:\Users\taka-\OneDrive\デスクトップ\project\survey-app
```

### Step 3: package.jsonが存在するか確認

```cmd
dir package.json
```

`package.json` が表示されれば、正しいディレクトリです。

### Step 4: 開発サーバーを起動

```cmd
npm run dev
```

---

## より簡単な方法: VS Codeから直接開く

1. **VS Codeで`package.json`ファイルを開く**
2. **`package.json`を右クリック**
3. **「ターミナルで開く」または「Open in Terminal」を選択**
   - 自動的に正しいディレクトリでターミナルが開きます
4. **`npm run dev`を実行**






