# XAdmin Admin UI

`admin-ui` は XAdmin 向けのフロントエンドワークスペースです。VBen 5 の monorepo 構成をベースにしていますが、現在のブランチは XAdmin バックエンド連携用に実運用向けの調整が入っています。

この README は upstream VBen の汎用紹介ではなく、現在の XAdmin ブランチの実際の用途と利用方法を説明します。

## 役割

- メインアプリ: `apps/web-antd`
- 現在の利用ブランチ: `xadmin-api-integration`
- 接続先バックエンド: XAdmin `admin`
- UI スタック: Vue 3 + Vite + TypeScript + Ant Design Vue
- ワークスペース構成: `pnpm` + `turbo`

## 現在の統合内容

このブランチでは主に以下を扱います。

- XAdmin バックエンドへのログインとトークン更新
- 動的メニューと権限制御
- プラットフォーム/テナント前提の辞書管理
- 内部メッセージ受信箱
- ファイル管理: アップロード、プレビュー、ダウンロード、削除

## 動作要件

- Node.js `^22.18.0 || ^24.0.0`
- `pnpm >= 11`

## 依存関係のインストール

```bash
pnpm install
```

## 開発起動

XAdmin のメインフロントを起動:

```bash
pnpm dev:antd
```

または:

```bash
pnpm -F @vben/web-antd run dev
```

## ビルド

```bash
pnpm build:antd
```

## チェックコマンド

メインアプリの型チェック:

```bash
pnpm -F @vben/web-antd run typecheck
```

ワークスペース全体の型チェック:

```bash
pnpm exec turbo run typecheck
```

Lint と整形:

```bash
pnpm lint
pnpm format
```

文字コード確認:

```bash
pnpm check:encoding
```

## 主要ディレクトリ

- メインアプリ: `apps/web-antd`
- 管理系 API ラッパー: `apps/web-antd/src/api/admin`
- レイアウト統合: `apps/web-antd/src/layouts`
- システム管理画面: `apps/web-antd/src/views/system`
- 権限管理画面: `apps/web-antd/src/views/app/permission`
- プロフィール画面: `apps/web-antd/src/views/_core/profile`

## バックエンドとの連携

このフロントは通常、同階層の XAdmin バックエンドリポジトリと組み合わせて利用します。

- バックエンド: `../admin`

典型的なローカル構成:

- フロント: `http://localhost:5666` または現在の Vite ポート
- バックエンド REST: `http://localhost:7788`

実際のポートはローカル設定に従ってください。

## このブランチに関する注意

- upstream VBen の一部デモ要素は削除または差し替え済みです。
- メニュー、権限、ページ挙動は XAdmin バックエンド資源に基づきます。
- このブランチをそのまま upstream VBen の素のテンプレートとして扱わないでください。

## 関連リポジトリ

- XAdmin バックエンド: `../admin`
- XAdmin 生成/ツール: `../xkit`
- XAdmin テンプレート: `../xkit-template`

## ライセンス

追加ポリシーがない限り、ライセンスの基礎は upstream を継承します。詳細は [LICENSE](./LICENSE) を参照してください。
