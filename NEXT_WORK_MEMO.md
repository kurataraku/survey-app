# 明日の作業メモ：トップ画面文言変更テスト

## 現在の状態

### ブランチ
- **現在のブランチ**: `feature/test-preview-env`
- **状態**: すべてコミット・プッシュ済み（作業ツリーはクリーン）
- **最新コミット**: `cd9627d test: preview environment test`

### これまでの作業
1. ✅ GitHub × Cursor UI改善体制構築の設定ファイル追加完了
2. ✅ `dev`ブランチ作成・プッシュ完了
3. ✅ PRテンプレート、Issueテンプレート、CODEOWNERS作成完了
4. ✅ README.mdに開発フロー追加完了
5. ✅ テスト用ブランチ `feature/test-preview-env` 作成・プッシュ完了

### Vercel設定確認
- ✅ Pull Request Comments: Enabled
- ✅ deployment_status Events: Enabled
- ✅ 環境変数設定済み（Supabase関連はAll Environments）

## 明日の作業：トップ画面文言変更テスト

### 作業ファイル
- **対象ファイル**: `app/page.tsx`
- **現在のブランチ**: `feature/test-preview-env`

### トップページの主要な文言（変更候補）

1. **ヒーローセクション**（309-311行目付近）
   - "リアルな口コミで"
   - "通信制高校を選ぼう"

2. **検索ボタン**（319行目付近）
   - "通信制高校を探す"

3. **口コミ投稿ボタン**（403行目付近）
   - "学校の口コミをする"

4. **セクションタイトル**
   - "注目の学校（口コミ数順）"（411行目付近）
   - "多くの口コミが寄せられている学校"（417行目付近）
   - "注目の口コミ"（451行目付近）
   - "多くのいいねが寄せられている口コミ"（452行目付近）
   - "通信制高校に関する役立つ情報"（501行目付近）

### 作業手順

1. **現在のブランチで作業開始**
   ```bash
   git checkout feature/test-preview-env
   git pull origin feature/test-preview-env
   ```

2. **トップページの文言を変更**
   - `app/page.tsx` を編集
   - テスト用に文言を変更（例：「リアルな口コミで」→「実際の体験談で」など）

3. **ローカルで確認**
   ```bash
   npm run dev
   ```
   - http://localhost:3000 で変更内容を確認

4. **コミット・プッシュ**
   ```bash
   git add app/page.tsx
   git commit -m "test(ui): トップページの文言変更テスト"
   git push
   ```

5. **GitHubでPRを作成**（まだ作成していない場合）
   - base: `dev` ← compare: `feature/test-preview-env`
   - PRテンプレートに従って記入
   - Before/Afterのスクショを添付

6. **Vercelプレビュー環境の確認**
   - PR作成後、Vercelが自動的にプレビュー環境をビルド
   - PRコメントに表示されるプレビューURLにアクセス
   - 変更内容が正しく反映されているか確認

### 確認ポイント

- ✅ 文言変更が正しく反映されているか
- ✅ PC表示で問題ないか
- ✅ スマホ表示で問題ないか
- ✅ Console errorがないか
- ✅ 機能に影響がないか（検索、口コミ投稿など）

### 注意事項

- ✅ **許可される変更**: 文言・テキストの変更
- ❌ **禁止される変更**: 機能の追加・変更、バックエンド・サーバー側の変更

## 参考情報

- **リポジトリ**: https://github.com/kurataraku/survey-app
- **PR作成URL**: https://github.com/kurataraku/survey-app/pull/new/feature/test-preview-env
- **開発フロー**: `README.md` の「開発フロー」セクションを参照
