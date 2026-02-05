# S-IDE Mobile

S-IDEのモバイル版クライアントアプリ。React Native + Expoで構築されています。

## 機能

- サーバーに接続してターミナル一覧を表示
- WebSocketによるリアルタイムターミナル出力
- ダークモードUI

## セットアップ

### 開発環境

```bash
# 依存関係をインストール
pnpm install

# Expo CLIをグローバルにインストール
npm install -g expo-cli eas-cli

# 開発サーバーを起動
pnpm start

# iOSシミュレーターで起動
pnpm ios

# Androidエミュレーターで起動
pnpm android
```

### EAS Buildのセットアップ

1. Expoアカウントを作成: https://expo.dev

2. ログイン:
```bash
eas login
```

3. プロジェクトを設定:
```bash
eas project:init
```

4. `app.json`の`projectId`を設定されたIDに更新

5. ビルド:
```bash
# iOSビルド
pnpm run build:mobile:ios

# Androidビルド
pnpm run build:mobile:android

# 両プラットフォーム
pnpm run build:mobile
```

### GitHub Actionsでのリリース

GitHub Actionsを使用して自動ビルドを行います:

1. `EXPO_TOKEN`シークレットをGitHubに追加:
   - Expoアカウントページからトークンを取得: https://expo.dev/accounts/[your-username]/settings/access-tokens
   - GitHubリポジトリのSettings → Secrets and variables → Actions に`EXPO_TOKEN`として追加

2. タグをプッシュすると自動ビルド:
```bash
git tag v1.0.0
git push origin v1.0.0
```

3. 手動でビルドを実行:
   - GitHubのActionsタブ → Mobile Release → Run workflow

## 利用方法

1. アプリを起動
2. 設定ボタン（⚙）をタップ
3. サーバーURLを入力（例: `http://192.168.1.1:8787`）
4. 「Connect」をタップ
5. ターミナル一覧が表示されるので、選択して接続

## トラブルシューティング

### 接続できない

- サーバーが起動しているか確認
- ファイアウォール設定を確認
- 同じネットワークに接続しているか確認
- URLが正しいか確認（`http://`を含める）

### iOSビルドが失敗する

- Apple Developerアカウントが必要
- `eas.json`の`submit.production.ios`セクションを設定

### Androidビルドが失敗する

- Google Service Accountが必要
- `eas.json`の`submit.production.android`セクションを設定

## ライセンス

MIT
