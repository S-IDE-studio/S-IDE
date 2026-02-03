# S-IDE 自動更新システム設計

## 概要

Tauri 2.0のUpdaterプラグインを使用し、GitHub Releases経由で署名付きのアプリ更新を配信するシステム。

## 要件

- 更新チェック: アプリ起動時のみ
- 更新通知: モーダル/トーストで通知し、ユーザーに確認
- 更新範囲: すべてのバージョン（パッチ〜メジャー）を自動更新
- セキュリティ: 署名付き更新配信

## アーキテクチャ

```
アプリ起動 → GitHub Releasesで更新チェック → 更新あり → モーダル通知
    → ユーザー確認 → ダウンロード → インストール → 再起動
```

## コンポーネント

### Tauri側

| ファイル | 役割 |
|---------|------|
| `Cargo.toml` | `tauri-plugin-updater` 依存追加 |
| `tauri.conf.json` | Updaterプラグイン設定（公開鍵、エンドポイント） |
| `src/commands.rs` | `check_update`, `download_and_install` コマンド |

### フロントエンド側

| ファイル | 役割 |
|---------|------|
| `components/UpdateNotification.tsx` | 更新通知モーダル |
| `components/UpdateProgress.tsx` | ダウンロード進捗表示 |
| `App.tsx` | 起動時更新チェック統合 |

### CI/CD

| ファイル | 役割 |
|---------|------|
| `.github/workflows/release.yml` | タグプッシュ時の自動ビルド & Release |

## GitHub Releases構造

```
S-IDE-studio/S-IDE/releases/v2.0.1/
├── S-IDE_2.0.1_x64-setup.nsis.exe      (署名付きインストーラー)
├── S-IDE_2.0.1_x64-setup.nsis.zip.sig  (NSIS署名ファイル)
├── S-IDE_2.0.1_x64.msi.zip             (MSI)
├── S-IDE_2.0.1_x64.msi.zip.sig         (MSI署名ファイル)
└── latest.json                         (更新情報メタデータ)
```

## 設定

### tauri.conf.json

```json
{
  "plugins": {
    "updater": {
      "pubkey": "公開鍵（後で生成）",
      "endpoints": [
        "https://github.com/S-IDE-studio/S-IDE/releases/latest/download/latest.json"
      ]
    }
  },
  "bundle": {
    "publisher": "S-IDE studio"
  }
}
```

## GitHub Secrets

| Secret名 | 説明 |
|----------|------|
| `TAURI_PRIVATE_KEY` | 秘密鍵（tauri signer generateで生成） |
| `TAURI_KEY_PASSWORD` | 鍵のパスワード |

## データフロー

**正常フロー:**
```
起動 → check_update → GitHub API → 更新あり → モーダル表示
→ [今すぐ更新] → download_and_install → 進捗表示 → インストール → 再起動
```

## エラーハンドリング

| エラー | 対応 |
|--------|------|
| ネットワークエラー | リトライ1回、失敗でトースト通知 |
| 署名検証エラー | エラーダイアログ |
| ダウンロード失敗 | リトライボタン付き |
| インストール失敗 | 手動ダウンロードリンク表示 |

## リリース手順

```bash
# 1. バージョン更新 (tauri.conf.json, Cargo.toml)
# 2. タグ作成 & プッシュ
git tag v2.0.1
git push origin v2.0.1
# → GitHub Actionsが自動でビルド & Release作成
```

## 実装タスク

1. Tauri: Updaterプラグイン追加と設定
2. Tauri: 更新チェック・インストールコマンド実装
3. Frontend: UpdateNotificationモーダル実装
4. Frontend: UpdateProgress実装
5. Frontend: App.tsxに統合
6. CI/CD: release.ymlワークフロー作成
7. 署名鍵生成とGitHub Secrets設定
8. テスト: 初回リリース (v2.0.1)
