#!/usr/bin/env python3
"""
TopoJSON ファイルに yomigana プロパティを追加するパッチスクリプト。
政令指定都市の区コードに対して ward_readings から読みを設定する。

使い方:
  python3 data-pipeline/scripts/patch_yomigana.py
"""

import json
import gzip
import shutil
from pathlib import Path

ROOT = Path(__file__).parent.parent
REF_JSON = ROOT / "data/ref/seirei_ward_names.json"
TOPO_DIR = ROOT / "data/output/topojson"

# --- 区読み仮名ロード ---
with open(REF_JSON) as f:
    ref = json.load(f)

ward_readings: dict[str, str] = ref["ward_readings"]
print(f"Loaded {len(ward_readings)} ward readings")


def patch_topojson(path: Path) -> int:
    """TopoJSON ファイルを読み込み、yomigana プロパティを追加して上書き保存する。
    Returns: パッチした feature 数"""
    with open(path) as f:
        topo = json.load(f)

    patched = 0
    for obj_key in topo.get("objects", {}):
        geometries = topo["objects"][obj_key].get("geometries", [])
        for geom in geometries:
            props = geom.get("properties", {})
            code = str(props.get("code", ""))
            if code in ward_readings:
                props["yomigana"] = ward_readings[code]
                patched += 1

    if patched > 0:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(topo, f, ensure_ascii=False, separators=(",", ":"))
        print(f"  Patched {patched} features in {path.name}")

    return patched


total = 0

# --- prefectures/*.topojson ---
pref_dir = TOPO_DIR / "prefectures"
for p in sorted(pref_dir.glob("*.topojson")):
    total += patch_topojson(p)

# --- japan.topojson ---
japan_path = TOPO_DIR / "japan.topojson"
if japan_path.exists():
    total += patch_topojson(japan_path)

# --- prefectures.topojson ---
prefs_path = TOPO_DIR / "prefectures.topojson"
if prefs_path.exists():
    # 都道府県ファイルは区単位ではないのでスキップ（ward codes not present）
    pass

# --- .gz の再生成 ---
gz_src = TOPO_DIR / "japan.topojson"
gz_dst = TOPO_DIR / "japan.topojson.gz"
if gz_src.exists() and gz_dst.exists():
    with open(gz_src, "rb") as f_in, gzip.open(gz_dst, "wb") as f_out:
        shutil.copyfileobj(f_in, f_out)
    print(f"  Regenerated {gz_dst.name}")

print(f"\nDone. Total patched features: {total}")
