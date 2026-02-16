#!/usr/bin/env bash
# PostGIS データベースセットアップスクリプト
# 使い方: sudo -u postgres bash scripts/setup_db.sh
set -euo pipefail

ROLE="toriforiumu"
DEV_DB="shikuty_development"
TEST_DB="shikuty_test"

echo "=== PostgreSQL / PostGIS セットアップ ==="

# ロール作成（既に存在する場合はスキップ）
if psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${ROLE}'" | grep -q 1; then
    echo "  Role '${ROLE}' already exists"
else
    createuser -s "${ROLE}"
    echo "  Created superuser role '${ROLE}'"
fi

# 開発DB作成
if psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DEV_DB}'" | grep -q 1; then
    echo "  Database '${DEV_DB}' already exists"
else
    createdb -O "${ROLE}" "${DEV_DB}"
    echo "  Created database '${DEV_DB}'"
fi

# テストDB作成
if psql -tAc "SELECT 1 FROM pg_database WHERE datname='${TEST_DB}'" | grep -q 1; then
    echo "  Database '${TEST_DB}' already exists"
else
    createdb -O "${ROLE}" "${TEST_DB}"
    echo "  Created database '${TEST_DB}'"
fi

# PostGIS拡張を有効化
psql -d "${DEV_DB}" -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql -d "${TEST_DB}" -c "CREATE EXTENSION IF NOT EXISTS postgis;"
echo "  PostGIS extension enabled"

echo ""
echo "=== セットアップ完了 ==="
echo "次に実行: cd data-pipeline && python3 scripts/06_load_postgis.py"
