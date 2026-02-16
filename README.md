# Shikuty - 市区町村パズル

日本の市区町村をドラッグ&ドロップで正しい位置に配置するパズルゲーム。

## 機能

- **全国モード**: 47都道府県を日本地図に配置
- **地方モード**: 地方ごとの市区町村を配置（95〜355ピース）
- **県内モード**: 都道府県内の市区町村を配置（10〜194ピース）
- **3段階の難易度**: かんたん / ふつう / むずかしい（スナップ距離・ゴースト表示・境界線の太さが変化）
- **レスポンシブ対応**: PC / タブレット / スマホ

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Vite + TypeScript + D3.js v7 + topojson-client |
| API | Ruby on Rails 7.2 (API mode) |
| DB | PostGIS (Docker) |
| データパイプライン | Python 3.10 + mapshaper |

## プロジェクト構成

```
shikuty/
├── apps/
│   ├── api/          # Rails API サーバー
│   └── web/          # フロントエンド (Vite + TypeScript)
├── data-pipeline/    # 国土数値情報 → TopoJSON 変換
├── docs/             # 設計ドキュメント
├── packages/         # 共有パッケージ
└── docker-compose.yml
```

## セットアップ

### 前提条件

- Ruby 3.3.8 (rbenv)
- Node.js v22
- Python 3.10
- Docker (PostGIS用)

### 起動手順

```bash
# PostGIS 起動
docker compose up -d

# Rails API
cd apps/api
bundle install
bin/rails db:setup
bin/rails server

# フロントエンド
cd apps/web
npm install
npm run dev    # http://localhost:5180
```

## データソース

- [国土数値情報 行政区域データ (N03)](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2024.html) - 2024年版
