## 概要

`system.md` §2 および §3.3 で「モバイルはPWA（Progressive Web App）として提供し、ネイティブアプリは作らない」「React Nativeによるネイティブアプリは作らない」と明記されているが、実際のプロジェクトには `apps/mobile/` ディレクトリに **React Native/Expo** ベースのネイティブアプリが存在する。

## 矛盾箇所

| ドキュメント | 記述 | 実態 |
|---|---|---|
| `system.md` §2 | モバイルはPWA（Progressive Web App）として提供 | `apps/mobile/` に Expo/React Native アプリが存在 |
| `system.md` §3.3 | React Nativeによるネイティブアプリは作らない | `package.json` に `expo`, `react-native` 依存 |
| `system.md` §3.3 | Web Clientをレスポンシブ対応し、PWAとして提供 | PWAマニフェスト設定やServiceWorker が不明確 |
| ルート `package.json` | — | `build:mobile:ios`, `build:mobile:android` スクリプト存在 |

## 影響するINV

- **INV-1 (Headless-First):** ネイティブアプリとPWAでは「UIの障害からの隔離」の実装が異なる
- **全体の一貫性:** ドキュメントと実装の矛盾はエージェントの判断を誤らせる

## 提案

1. **PWA方針を維持** — `apps/mobile/` を削除し、Web Clientにレスポンシブ+PWA対応を追加
2. **ネイティブアプリ方針に変更** — ドキュメントを更新して React Native/Expo アプリの存在を正式に認める
3. **両方サポート** — PWAを主、ネイティブを補助として位置づける

> **重要:** プロジェクトの方向性に関わる判断が必要です。

## 対象ファイル

- `docs/specs/system.md`
- `apps/mobile/` ディレクトリ全体
- ルート `package.json` のモバイル関連スクリプト
