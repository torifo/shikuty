# Shikuty - 市区町村パズル

日本の市区町村・都道府県をドラッグ&ドロップで正しい位置に配置するパズルゲーム。

**ライブデモ**: https://shikuty.opus.riumu.net

---

## 機能

### ゲームモード

| モード | 内容 | ピース数 |
|--------|------|---------|
| **全国モード** | 47都道府県を日本地図に配置 | 47 |
| **地方モード** | 8地方から選択して市区町村を配置 | 95〜355 |
| **県内モード** | 都道府県を選択して市区町村を配置 | 10〜194 |

### 選択UI
- **地図から選ぶ**: インタラクティブな日本地図をクリック/タップして選択
  - 地方マップ: 8地方を色分け、ホバーで地方全体をハイライト
  - 都道府県マップ: ホバーで名称ツールチップ、クリックで選択
- **一覧から選ぶ**: 名称グリッドからテキストで選択（地図と切り替え可能）

### ゲームプレイ
- **3段階の難易度**: かんたん / ふつう / むずかしい
  - スナップ距離・ゴースト表示・境界線の太さが変化
  - かんたん: 地理的位置を参考にした初期配置・時間経過で段階的ヒント点滅
- **ホバーツールチップ**: 市区町村名＋よみがな表示（政令市は「京都市北区」形式）
- **完成形プレビュー**: 挑戦前に答えを確認可能
- **模範解答表示**: ゲーム中に完成形をヒントとして表示
- **配置ラベル**: ピースを置くと名称ラベルを表示（clipPathで境界内に自動収縮）
- **パン&ズーム**: 0.5〜8倍ズームで細かい地域も確認可能

### UI / UX
- **レスポンシブ対応**: PC / タブレット / スマホ
- スマホ: ドラッグ中に画面上部に市区町村名を表示

---

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Vite + TypeScript + D3.js v7 + topojson-client |
| API | Ruby on Rails 7.2 (API mode) + blueprinter |
| DB | PostGIS 16-3.5 (Docker) |
| データパイプライン | Python 3.10 + mapshaper + Node.js |
| インフラ | Docker + GHCR + nginx-proxy + Let's Encrypt |

---

## プロジェクト構成

```
shikuty/
├── apps/
│   ├── api/                  # Rails 7.2 API サーバー
│   │   ├── app/
│   │   │   ├── controllers/api/v1/
│   │   │   │   ├── prefectures_controller.rb
│   │   │   │   ├── municipalities_controller.rb
│   │   │   │   └── topojson/files_controller.rb
│   │   │   └── models/
│   │   │       └── municipality.rb  # PostGIS geometry
│   │   └── Dockerfile
│   └── web/                  # フロントエンド (Vite + TypeScript)
│       ├── src/
│       │   ├── engine.ts        # パズルエンジン・D3描画
│       │   ├── screens.ts       # 画面遷移・選択UI
│       │   ├── map-selector.ts  # インタラクティブ日本地図
│       │   ├── prefectures.ts
│       │   ├── regions.ts
│       │   └── style.css
│       └── Dockerfile
├── data-pipeline/            # 国土数値情報 → TopoJSON 変換
│   ├── scripts/
│   │   ├── 01_download.py
│   │   ├── 02_clean_boundaries.py
│   │   ├── 03_simplify.py       # mapshaper Visvalingam
│   │   ├── 04_elevation_stats.py
│   │   ├── 05_export.py
│   │   ├── 06_load_postgis.py
│   │   ├── 07_topojson_convert.sh
│   │   ├── 08_validate.py
│   │   └── patch_yomigana.py    # よみがなパッチ（政令市対応）
│   └── data/
│       ├── ref/                 # 参照データ（政令市区名・よみがな 169件）
│       └── output/topojson/     # 生成済みTopoJSON
├── docs/                     # 設計ドキュメント
├── docker-compose.yml        # 開発環境
└── docker-compose.prod.yml   # 本番環境
```

---

## セットアップ

### 前提条件

- Ruby 3.3.8（rbenv推奨）
- Node.js v22
- Python 3.10
- Docker（PostGIS用）

### 開発環境の起動

```bash
# 1. PostGIS 起動（port 54321）
docker compose up -d

# 2. Rails API
cd apps/api
bundle install
bin/rails db:setup
bin/rails server
# → http://localhost:3000

# 3. フロントエンド（別ターミナル）
cd apps/web
npm install
npm run dev
# → http://localhost:5180
```

> フロントエンドの `/api` リクエストは Vite の `server.proxy` 設定で `localhost:3000` に転送されます。

---

## データパイプライン

国土数値情報 N03（行政区域）2024年版をもとに以下の手順でデータを生成します。

```bash
cd data-pipeline

# Python 依存ライブラリのインストール
pip install -r requirements.txt

# パイプライン実行（順番に）
python scripts/01_download.py           # N03シェープファイルをダウンロード
python scripts/02_clean_boundaries.py   # 境界クリーニング・dissolve（124,133 → 1,905市区町村）
python scripts/03_simplify.py           # mapshaper Visvalingam で約88%削減
python scripts/04_elevation_stats.py    # 標高統計を付与（オプション）
python scripts/05_export.py             # GeoJSON エクスポート
python scripts/06_load_postgis.py       # PostGIS にロード
bash  scripts/07_topojson_convert.sh    # TopoJSON 生成
python scripts/08_validate.py           # 検証

# よみがなパッチ（政令市20市・169区のよみがなを付与）
python scripts/patch_yomigana.py
```

### 生成されるTopoJSON

| ファイル | 用途 | サイズ |
|---------|------|--------|
| `japan.topojson` | 全市区町村（地方・県内モード） | 720KB（gzip: 156KB） |
| `prefectures.topojson` | 47都道府県のみ（全国モード・地図UI） | 52KB |
| `prefectures/{code}.topojson` | 都道府県別（県内モード） | 各数〜30KB |

---

## API エンドポイント

```
GET /api/v1/prefectures                 # 都道府県一覧
GET /api/v1/prefectures/:code           # 都道府県詳細

GET /api/v1/municipalities              # 市区町村一覧（?prefecture_code=XX）
GET /api/v1/municipalities/:code        # 市区町村詳細

GET /api/v1/topojson/japan              # 全国TopoJSON
GET /api/v1/topojson/prefectures        # 47都道府県TopoJSON
GET /api/v1/topojson/prefectures/:code  # 都道府県別TopoJSON
```

---

## データベーススキーマ

```sql
CREATE TABLE municipalities (
  code              VARCHAR(6) PRIMARY KEY,  -- 市区町村コード（6桁）
  prefecture_code   VARCHAR(2),
  prefecture_name   VARCHAR(20),
  municipality_name VARCHAR(40),
  full_name         VARCHAR(80),             -- "東京都渋谷区" 形式
  geom              GEOMETRY(MultiPolygon, 4326),  -- PostGIS
  geom_simplified   GEOMETRY(MultiPolygon, 4326),
  area_km2          DECIMAL,
  elevation_min     INTEGER,
  elevation_max     INTEGER,
  elevation_mean    DECIMAL
);
```

---

## リリース履歴

Dockerイメージタグ（`ghcr.io/torifo/shikuty-web`）と対応する機能を記載します。

### v0.3.2 — 地図選択UI（現在）
`df15483`

- 地方・都道府県選択画面に「地図」「一覧」タブを追加
- 地方マップ: 8地方を色分け表示、ホバーで地方全体をハイライト
- 都道府県マップ: ホバーツールチップ、クリックで即選択
- TopoJSONをキャッシュしタブ切替時の再取得を防止
- グリッド一覧は従来どおり「一覧」タブで引き続き利用可能

### v0.3.1 — ラベルフォントサイズ修正
`16afcab`

- フォントサイズ算出を `min(pw, ph) × 0.7 / 文字数` に変更
  - 縦長・不整形な都道府県でもはみ出さないよう、バウンディングボックスの短辺基準に統一
- clipPath定義をSVGルートの `<defs>` に移動（ブラウザ互換性対応）

### v0.3.0 — ラベル・よみがな・政令市対応
`a348f63`

- **SVG clipPath**: 配置済みラベルをピース境界内にクリッピング
- **よみがな表示**: ツールチップ・ドラッグバーに「○○（よみがな）」形式で表示
  - 政令市20市・169区分のよみがな辞書を整備（`data/ref/seirei_ward_names.json`）
  - `patch_yomigana.py` でTopoJSONに一括付与（332フィーチャー）
- **政令市の完全名称**: 「北区」→「京都市北区」のように市区名を連結表示
- ゲーム中ツールチップ・完成形プレビューのホバーツールチップにも適用

### v0.2.x — ゲームプレイ機能充実
`009ce56` 〜 `d1b756b`

- **50音順グリッド配置** (`009ce56`): ノーマル・ハードモードのピース初期配置を50音順グリッドに整理
- **完成形プレビュー** (`c956ece`): スポイラー警告付きで挑戦前に完成形を確認可能
- **難易度別初期配置** (`c956ece`): かんたんは地理的位置マッピング、ノーマルはグリッド、ハードはランダム
- **模範解答ボタン** (`c956ece`): ゲーム中にワンクリックで完成形を表示
- **完成形ホバーツールチップ** (`d1b756b`): プレビュー画面でも市区町村名を表示

### v0.1.x — 基盤構築・インフラ整備
`5ef00e2` 〜 `0518b21`

- **Sprint 0** (`5ef00e2`): データパイプライン・Rails API・D3.jsパズル初期実装
- **地形色ラベル** (`f41e363`): 面積ベースの地形色（緑〜茶）・配置時に市区町村名ラベル表示
- **レスポンシブ対応** (`740de9e`): PC / タブレット / スマホ 3段階レイアウト
- **パン&ズーム** (`813ef91`): 離島（小笠原・先島等）対応のためD3 zoom実装
- **本番デプロイ** (`08c54d5`): VPS + nginx-proxy + GHCR によるインフラ整備
- **簡単モードヒント・スマホ名前バー** (`0518b21`): 段階的ゴーストヒント点滅、ドラッグ中名称表示

---

## デプロイ

本番環境は VPS 上で Docker コンテナとして稼働しています。

### コンテナレジストリ

```
ghcr.io/torifo/shikuty-web   # Nginx（静的配信）
ghcr.io/torifo/shikuty-api   # Rails API
```

### Web のビルド＆デプロイ

```bash
# ビルド & タグ付け
cd apps/web
docker build -t ghcr.io/torifo/shikuty-web:latest \
             -t ghcr.io/torifo/shikuty-web:vX.Y.Z .

# プッシュ
docker push ghcr.io/torifo/shikuty-web:latest
docker push ghcr.io/torifo/shikuty-web:vX.Y.Z

# VPS で更新
ssh root@<VPS_IP>
docker pull ghcr.io/torifo/shikuty-web:latest
docker stop shikuty-web && docker rm shikuty-web
docker run -d --name shikuty-web \
  --network global-proxy-network \
  --network shikuty_internal \
  -e VIRTUAL_HOST=shikuty.opus.riumu.net \
  -e LETSENCRYPT_HOST=shikuty.opus.riumu.net \
  --restart unless-stopped \
  ghcr.io/torifo/shikuty-web:latest
```

### インフラ構成

```
Internet
  └── nginx-proxy + acme-companion (Let's Encrypt)
        ├── shikuty-web  (Nginx 静的配信)
        └── shikuty-api  (Rails API)
              └── shikuty-db-prod (PostGIS 16-3.5)
```

TopoJSONファイルは VPS の `/opt/shikuty/data/topojson/` に配置し、APIコンテナに読み取り専用でマウントします。

---

## データソース

- [国土数値情報 行政区域データ (N03)](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2024.html) — 2024年版
  - 国土交通省 国土政策局 国土情報課 提供
  - ライセンス: [国土数値情報利用規約](https://nlftp.mlit.go.jp/ksj/other/agreement.html)

---

## ライセンス

MIT
