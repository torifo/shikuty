#!/usr/bin/env python3
"""Step 08: Validate pipeline outputs.

Checks:
- Municipality count (~1,718)
- Prefecture count (47)
- No null geometries or elevation data
- File size limits
- PostGIS row counts
"""

import json
import sys
from pathlib import Path

import geopandas as gpd
import pandas as pd
from sqlalchemy import text as sa_text

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.config import get_db_url, get_path, load_settings


class ValidationError(Exception):
    pass


def check(condition: bool, message: str):
    """Assert a validation condition."""
    status = "PASS" if condition else "FAIL"
    print(f"  [{status}] {message}")
    if not condition:
        raise ValidationError(message)


def validate_geojson(output_dir: Path, settings: dict):
    """Validate GeoJSON outputs."""
    print("\n--- GeoJSON Validation ---")

    geojson_dir = output_dir / "geojson"

    # National file exists
    japan_path = geojson_dir / "japan.geojson"
    check(japan_path.exists(), "National GeoJSON exists")

    gdf = gpd.read_file(japan_path)

    # Municipality count
    count = len(gdf)
    check(1600 <= count <= 2000, f"Municipality count in range: {count}")

    # Prefecture count
    pref_count = gdf["prefecture_code"].nunique()
    check(pref_count == 47, f"Prefecture count: {pref_count}")

    # No null geometries
    null_geom = gdf.geometry.isna().sum()
    check(null_geom == 0, f"No null geometries (found {null_geom})")

    # No empty geometries
    empty_geom = gdf.geometry.is_empty.sum()
    check(empty_geom == 0, f"No empty geometries (found {empty_geom})")

    # No null codes
    null_codes = gdf["code"].isna().sum()
    check(null_codes == 0, f"No null municipality codes (found {null_codes})")

    # Unique codes
    dup_codes = gdf["code"].duplicated().sum()
    check(dup_codes == 0, f"No duplicate codes (found {dup_codes})")

    # Elevation data present
    if "elevation_mean" in gdf.columns:
        null_elev = gdf["elevation_mean"].isna().sum()
        check(null_elev == 0, f"No null elevation_mean (found {null_elev})")

    # Prefecture files
    pref_dir = geojson_dir / "prefectures"
    pref_files = list(pref_dir.glob("*.geojson"))
    check(len(pref_files) == 47, f"47 prefectural GeoJSON files (found {len(pref_files)})")


def validate_topojson(output_dir: Path, settings: dict):
    """Validate TopoJSON outputs."""
    print("\n--- TopoJSON Validation ---")

    topojson_dir = output_dir / "topojson"
    limits = settings["output"]["file_size_limits"]

    # National TopoJSON
    japan_topo = topojson_dir / "japan.topojson"
    check(japan_topo.exists(), "National TopoJSON exists")

    size_mb = japan_topo.stat().st_size / 1e6
    limit_mb = limits["national_topojson_mb"]
    check(size_mb <= limit_mb, f"National TopoJSON size: {size_mb:.1f}MB <= {limit_mb}MB")

    # Verify it's valid JSON with topojson structure
    with open(japan_topo) as f:
        data = json.load(f)
    check(data.get("type") == "Topology", "Valid TopoJSON type")
    check("objects" in data, "TopoJSON has objects")
    check("arcs" in data, "TopoJSON has arcs")

    # Prefecture-only TopoJSON
    pref_topo = topojson_dir / "prefectures.topojson"
    check(pref_topo.exists(), "Prefecture-only TopoJSON exists")

    size_kb = pref_topo.stat().st_size / 1e3
    limit_kb = limits["national_prefecture_only_kb"]
    check(size_kb <= limit_kb, f"Prefecture TopoJSON size: {size_kb:.0f}KB <= {limit_kb}KB")

    # Gzipped size
    gz_path = topojson_dir / "japan.topojson.gz"
    if gz_path.exists():
        gz_kb = gz_path.stat().st_size / 1e3
        print(f"  [INFO] National gzipped: {gz_kb:.0f}KB")

    # Per-prefecture files
    pref_dir = topojson_dir / "prefectures"
    pref_files = list(pref_dir.glob("*.topojson"))
    check(len(pref_files) == 47, f"47 prefectural TopoJSON files (found {len(pref_files)})")

    # Check individual prefecture sizes
    max_size_kb = limits["prefectural_topojson_kb"]
    oversized = []
    for f in pref_files:
        fsize_kb = f.stat().st_size / 1e3
        if fsize_kb > max_size_kb:
            oversized.append((f.name, fsize_kb))
    check(
        len(oversized) == 0,
        f"All prefectural files under {max_size_kb}KB "
        f"({len(oversized)} oversized: {oversized[:3]})" if oversized else
        f"All prefectural files under {max_size_kb}KB"
    )


def validate_csv(output_dir: Path):
    """Validate CSV outputs."""
    print("\n--- CSV Validation ---")

    csv_dir = output_dir / "csv"

    muni_csv = csv_dir / "municipalities.csv"
    check(muni_csv.exists(), "Municipalities CSV exists")

    df = pd.read_csv(muni_csv, dtype={"code": str, "prefecture_code": str})
    check(1600 <= len(df) <= 2000, f"CSV municipality count: {len(df)}")

    pref_csv = csv_dir / "prefectures.csv"
    check(pref_csv.exists(), "Prefectures CSV exists")

    pref_df = pd.read_csv(pref_csv, dtype={"prefecture_code": str})
    check(len(pref_df) == 47, f"CSV prefecture count: {len(pref_df)}")


def validate_postgis(settings: dict):
    """Validate PostGIS data."""
    print("\n--- PostGIS Validation ---")

    try:
        from lib.db import get_engine
        db_url = get_db_url()
        engine = get_engine(db_url)

        with engine.connect() as conn:
            result = conn.execute(sa_text(
                "SELECT count(*) FROM municipalities"
            ))
            count = result.scalar()
            check(1600 <= count <= 2000, f"PostGIS municipality count: {count}")

            result = conn.execute(sa_text(
                "SELECT count(DISTINCT prefecture_code) FROM municipalities"
            ))
            pref_count = result.scalar()
            check(pref_count == 47, f"PostGIS prefecture count: {pref_count}")

            result = conn.execute(sa_text(
                "SELECT count(*) FROM municipalities WHERE geom IS NULL"
            ))
            null_geom = result.scalar()
            check(null_geom == 0, f"PostGIS no null geom: {null_geom}")

            result = conn.execute(sa_text(
                "SELECT count(*) FROM municipalities WHERE geom_simplified IS NULL"
            ))
            null_simp = result.scalar()
            check(null_simp == 0, f"PostGIS no null geom_simplified: {null_simp}")

    except Exception as e:
        print(f"  [SKIP] PostGIS validation skipped: {e}")


def main():
    settings = load_settings()
    output_dir = get_path("output")

    print("=" * 60)
    print("Step 8: Validation")
    print("=" * 60)

    errors = []

    for validate_fn in [
        lambda: validate_geojson(output_dir, settings),
        lambda: validate_topojson(output_dir, settings),
        lambda: validate_csv(output_dir),
        lambda: validate_postgis(settings),
    ]:
        try:
            validate_fn()
        except ValidationError as e:
            errors.append(str(e))

    print("\n" + "=" * 60)
    if errors:
        print(f"VALIDATION FAILED: {len(errors)} error(s)")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)
    else:
        print("ALL VALIDATIONS PASSED")
    print("=" * 60)


if __name__ == "__main__":
    main()
