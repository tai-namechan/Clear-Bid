---
name: nuxt-vue-patterns
description: >-
  Nuxt 4 + Vue 3 SFC + TypeScript のパターンガイド。.vue ファイルの作成・編集、
  pages/components/composables、defineProps / defineEmits、Vitest での
  コンポーネント関連実装時に使用する。
---

# Nuxt Vue Patterns（Clear Bid）

## Tech Stack

- Nuxt 4 / Vue 3 / `<script setup lang="ts">`
- `ssr: false`（SPA）
- Tailwind + `app/assets/css/main.css` の `cb-*` クラス
- 状態: composables + `useState` / localStorage（現段階）
- データ取得: `$fetch` → `server/api`

## ディレクトリ

```
app/
├── pages/              # ルート
├── components/         # home / diagnose / pipeline / profile
├── composables/        # useClearBidStore 等
├── layouts/            # default（ボトムナビ）
├── assets/css/         # main.css
└── utils/
```

## SFC 標準

- Options API 禁止
- `defineProps` / `defineEmits` は型付き
- 共有型は `#shared/*` から `import type`
- 共通レイアウト・ボトムナビは原則変更禁止（必要なら提案のみ）

## データフロー

```
pages
 → composables（永続化・オーケストレーション）
 → $fetch('/api/...')
 → components（表示）
```

## アンチパターン

| 禁止 | 正しい方法 |
|------|------------|
| Options API | `<script setup lang="ts">` |
| `any` | `unknown` + 型ガード |
| ページに金額計算直書き | `shared/domain` / `server/domain` |
| ブラウザから AI API 直接呼び出し | `server/api/ai/*` |
| 直書きスタイルの乱立 | `cb-*` / Tailwind |
| Clear Dawn の Inertia/Wayfinder 前提 | Nuxt pages / `$fetch` |

## スタイル

- `design-consistency.mdc` に従う
- 最大幅 430px、モバイルファースト
