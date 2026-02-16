#!/usr/bin/env bash
# Step 07: Convert GeoJSON to TopoJSON using Node.js topojson-cli tools.
#
# Applies: geo2topo -> toposimplify -> topoquantize
# This is the final conversion step that produces browser-ready files.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIPELINE_DIR="$(dirname "$SCRIPT_DIR")"
GEOJSON_DIR="$PIPELINE_DIR/data/output/geojson"
TOPOJSON_DIR="$PIPELINE_DIR/data/output/topojson"
NODE_BIN="$PIPELINE_DIR/node_modules/.bin"

# Verify tools exist
for tool in geo2topo toposimplify topoquantize; do
    if [ ! -x "$NODE_BIN/$tool" ]; then
        echo "ERROR: $tool not found. Run 'npm install' in $PIPELINE_DIR"
        exit 1
    fi
done

mkdir -p "$TOPOJSON_DIR/prefectures"

echo "============================================================"
echo "Step 7: TopoJSON conversion"
echo "============================================================"

# --- National TopoJSON (all municipalities) ---
echo ""
echo "[1/3] Converting national GeoJSON -> TopoJSON..."
"$NODE_BIN/geo2topo" municipalities="$GEOJSON_DIR/japan.geojson" \
    | "$NODE_BIN/toposimplify" -s 1e-7 -f \
    | "$NODE_BIN/topoquantize" 1e5 \
    > "$TOPOJSON_DIR/japan.topojson"

SIZE_KB=$(du -k "$TOPOJSON_DIR/japan.topojson" | cut -f1)
echo "  Saved: $TOPOJSON_DIR/japan.topojson (${SIZE_KB} KB)"

# Gzip copy for size check
gzip -k -f "$TOPOJSON_DIR/japan.topojson"
GZIP_KB=$(du -k "$TOPOJSON_DIR/japan.topojson.gz" | cut -f1)
echo "  Gzipped: ${GZIP_KB} KB"

# --- Prefecture-only TopoJSON (47 polygons) ---
echo ""
echo "[2/3] Converting prefecture boundaries -> TopoJSON..."
"$NODE_BIN/geo2topo" prefectures="$GEOJSON_DIR/prefectures.geojson" \
    | "$NODE_BIN/toposimplify" -s 1e-7 -f \
    | "$NODE_BIN/topoquantize" 1e5 \
    > "$TOPOJSON_DIR/prefectures.topojson"

SIZE_KB=$(du -k "$TOPOJSON_DIR/prefectures.topojson" | cut -f1)
echo "  Saved: $TOPOJSON_DIR/prefectures.topojson (${SIZE_KB} KB)"

# --- Per-prefecture TopoJSON ---
echo ""
echo "[3/3] Converting prefectural GeoJSON -> TopoJSON..."
COUNT=0
for GEOJSON_FILE in "$GEOJSON_DIR/prefectures/"*.geojson; do
    BASENAME=$(basename "$GEOJSON_FILE" .geojson)
    "$NODE_BIN/geo2topo" municipalities="$GEOJSON_FILE" \
        | "$NODE_BIN/toposimplify" -s 1e-7 -f \
        | "$NODE_BIN/topoquantize" 1e5 \
        > "$TOPOJSON_DIR/prefectures/${BASENAME}.topojson"
    COUNT=$((COUNT + 1))
done
echo "  Converted $COUNT prefectural files"

echo ""
echo "TopoJSON conversion complete."
echo "  Output directory: $TOPOJSON_DIR"
ls -lh "$TOPOJSON_DIR/"*.topojson
