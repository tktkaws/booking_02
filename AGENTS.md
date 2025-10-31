# Repository Guidelines

## 言語ポリシー
- このリポジトリに関する Issue・PR・レビュー・UI 文言は、原則「すべて日本語」で記述・応答してください。
- ドキュメントおよびコミットメッセージも日本語を推奨します。

## プロジェクト構成 / モジュール配置
- **`app/`**: App Router のページ、レイアウト、グローバルスタイル（`globals.css`）。トップは `app/page.tsx`。
- **`public/`**: 静的アセット（`/` 直下で配信）。例: `public/next.svg` → `/next.svg`。
- **設定**: `next.config.ts`、`tsconfig.json`（strict、エイリアス `@/*`）、`eslint.config.mjs`（core-web-vitals）。
- **ビルド出力**: `.next/`（自動生成・編集不可）。

例: `import Button from '@/components/Button'`（エイリアス）。

## ビルド・テスト・開発コマンド
- **`npm run dev`**: 開発サーバー起動（`http://localhost:3000`、HMR）。
- **`npm run build`**: 本番ビルド（型チェック・最適化）。
- **`npm start`**: 本番サーバー実行（事前に `build` 必須）。
- **`npm run lint`**: ESLint 実行（Next + TypeScript ルール）。

## コーディング規約 / 命名
- **言語**: TypeScript（strict）。外部境界では型を明示。
- **コンポーネント**: PascalCase（例: `UserCard.tsx`）。既定はサーバー、クライアントは `'use client'` を先頭に記述。
- **ルート/フォルダ**: 小文字ハイフン（例: `app/bookings/new/page.tsx`）。
- **インポート**: ルート相対の `@/*` を使用。
- **Lint/Format**: ESLint 準拠。PR 前に `npm run lint` を通すこと。

## テスト指針
- 公式テストは未導入。推奨: 単体に Vitest + React Testing Library、E2E に Playwright。
- **配置/命名**: `__tests__/**` または 対象付近の `*.test.ts(x)`。
- **実行**: 将来 `npm run test` / `npm run test:e2e` を追加予定。現状は `npm run dev` で手動確認し、PR にスクリーンショットを添付。

## コミット & PR ガイドライン
- **コミット**: 命令形で簡潔に範囲を明示。例: `feat(bookings): 作成フローを追加`。
- **PR**: 変更概要、UI 変更のスクショ、再現/確認手順、関連 Issue を記載。
- **チェック**: `npm run build` と `npm run lint` を通過してからレビュー依頼。

## セキュリティ / 設定 Tips
- **環境変数**: `.env.local`（git 無視）。クライアント公開は `NEXT_PUBLIC_` 接頭辞。
  - 例: `NEXT_PUBLIC_API_BASE=https://api.example.com`
- **秘密情報**: コミット禁止。必要に応じてプラットフォームのシークレット管理を使用。
- **依存関係**: `next`・`react`・型定義を同期し、`npm audit` を定期実行。


