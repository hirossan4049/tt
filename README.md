# TT — Timetable Planner

**https://tt.h1rose.com**

Tomorrowland Thailand 2026 のタイムテーブルから見たいセットを選び、自分だけのタイムテーブルを
Instagram Story / 壁紙の画像、または Story 用の動画として書き出す Web アプリ（非公式ファンメイド）。

## 機能

- **タイムテーブル** — 縦＝時間、横＝ステージ。出演枠は実時間に比例。ステージ名・時刻は固定スクロール。
  - タップで `未選択 → ● Must → ○ Maybe → 未選択`。タップ後に出る下部バーで任意の状態へ直接切り替え／詳細を開く。
  - 長押しで詳細シート。キーボード: `Space` 切替 / `Enter` 詳細。
  - 重複は枠右端の赤バー（Must × Must は実線、それ以外は破線）。
- **マイプラン** — 日ごとの時系列。重なりはレーン分割＋重複時間を表示。
- **書き出し** — Poster / Timeline / Grid × Ink / Paper / Riso。内容（Must のみ / Must+Maybe / 全枠）、写真の有無、日付を切替。
  - **画像**: Story 1080×1920、壁紙（Android / iPhone 16 / 16 Pro Max / Pixel 9）。Canvas による専用レンダリング。
  - **動画（Story）**: 1080×1920 / 30fps の MP4。WebCodecs（H.264 優先）で実時間より速くエンコード、非対応環境は MediaRecorder にフォールバック。
  - 書き出した画像・動画には **「MADE WITH tt.h1rose.com」** を記載（動画は最後に tt.h1rose.com のエンドカード）。
  - スマホでは共有シート（そのまま Instagram へ）、PC ではダウンロード。
- **共有リンク** — `#s=` に選択状態をエンコード。
- 選択状態は LocalStorage に自動保存。
- アーティスト写真は Wikipedia 記事のリード画像のうち、Wikimedia Commons 上で CC / パブリックドメインのものだけを実行時に取得し、クレジットを表示。無い場合はタイポグラフィのフォールバック。「写真を変更」で自分の画像に差し替え可能。

> 時刻・日付・ステージは Tomorrowland Thailand 2026 Week 1 の公式ラインナップデータを反映しています（`src/lib/data.ts`）。

## 技術構成

Next.js 16（App Router, `output: 'export'`）/ Cloudflare Workers / React 19 / TypeScript / Tailwind CSS v4 / Zustand 5（persist → LocalStorage）/
mediabunny（WebCodecs → MP4）/ Fontsource（Big Shoulders Display, Archivo, IBM Plex Mono, Noto Sans JP をセルフホスト）/ Vitest。

```
src/
  app/            layout, page, globals.css (デザイントークン)
  components/     Planner(シェル/上部バー/検索/ナビ), Grid(+Dock), MyPlan, Sheet, ExportStudio
  lib/
    data.ts       ステージ・日付・出演データ
    plan.ts       重複判定・マイプランのクラスタリング・共有リンク
    render.ts     書き出し用 Canvas レンダラ（静止画＋モーション）
    export.ts     PNG / MP4 生成、共有・保存
    photos.ts     Wikimedia Commons 写真取得（ライセンス確認つき）
    store.ts      Zustand ストア
```

## 開発

```bash
npm ci
npm run dev        # http://localhost:3000
npm test
npm run build      # → out/
```

## デプロイ（Cloudflare Workers 静的アセット）

`wrangler.jsonc` で `out/` を配信し、`tt.h1rose.com` をカスタムドメインとして割り当てます（`public/_headers` でキャッシュ設定）。

**初回設定（Workers Builds による Git 連携）**

1. Cloudflare ダッシュボード → Workers & Pages → Create → Import a repository → `hirossan4049/tt`
2. Build command: `npm run build` / Deploy command: `npx wrangler deploy`（Root directory はそのまま）
3. 以降は `main` への push で自動デプロイ、他ブランチはプレビュー URL が発行されます

h1rose.com の DNS が Cloudflare にあるため、`tt.h1rose.com` の DNS レコードと証明書は初回デプロイ時に自動作成されます。

**手元から直接デプロイ**

```bash
npx wrangler login
npm run deploy     # build → wrangler deploy
npm run preview    # build → wrangler dev（ローカル確認）
```
