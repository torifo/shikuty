#!/usr/bin/env python3
"""Step 02: Clean boundaries - load, reproject, dissolve, fix topology."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.config import get_path, load_settings
from lib.geometry import (
    compute_area_km2,
    dissolve_by_code,
    fix_geometries,
    load_n03_data,
    reproject,
)


def main():
    settings = load_settings()
    raw_dir = get_path("raw")
    interim_dir = get_path("interim")
    interim_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("Step 2: Clean boundaries")
    print("=" * 60)

    # Load N03 data
    print("\n[1/5] Loading N03 data...")
    n03_dir = raw_dir / "N03"
    gdf = load_n03_data(n03_dir)
    print(f"  Loaded {len(gdf)} features, CRS: {gdf.crs}")
    print(f"  Columns: {list(gdf.columns)}")

    # Reproject to WGS84
    print("\n[2/5] Reprojecting...")
    target_crs = settings["projection"]["target_crs"]
    gdf = reproject(gdf, target_crs)

    # Fix invalid geometries
    print("\n[3/5] Fixing geometries...")
    gdf = fix_geometries(gdf)

    # Dissolve by municipality code
    print("\n[4/5] Dissolving by municipality code...")
    code_col = settings["dissolve"]["key"]
    gdf = dissolve_by_code(gdf, code_col)

    # Rename columns for clarity
    col_map = settings["columns"]
    rename_map = {}
    if col_map["prefecture_code"] in gdf.columns:
        # Extract prefecture code from the full code (first 2 digits)
        gdf["prefecture_code"] = gdf[code_col].str[:2]
    if "N03_001" in gdf.columns:
        rename_map["N03_001"] = "prefecture_name"
    if "N03_003" in gdf.columns:
        rename_map["N03_003"] = "municipality_name"
    if "N03_004" in gdf.columns:
        rename_map["N03_004"] = "district_name"
    if code_col in gdf.columns:
        rename_map[code_col] = "code"

    gdf = gdf.rename(columns=rename_map)

    # Build full_name (prefecture + district + municipality)
    gdf["full_name"] = gdf["prefecture_name"].fillna("")
    if "district_name" in gdf.columns:
        gdf["full_name"] = gdf["full_name"] + gdf["district_name"].fillna("")
    if "municipality_name" in gdf.columns:
        gdf["full_name"] = gdf["full_name"] + gdf["municipality_name"].fillna("")

    # Compute area
    print("\n[5/5] Computing area...")
    gdf = compute_area_km2(gdf)

    # Select and order columns
    keep_cols = ["code", "prefecture_code", "prefecture_name",
                 "municipality_name", "full_name", "area_km2", "geometry"]
    if "district_name" in gdf.columns:
        keep_cols.insert(4, "district_name")
    gdf = gdf[[c for c in keep_cols if c in gdf.columns]]

    # Save
    output_path = interim_dir / "municipalities_clean.gpkg"
    print(f"\nSaving to {output_path}")
    gdf.to_file(output_path, driver="GPKG")
    print(f"  Saved {len(gdf)} municipalities")
    print(f"  Prefectures: {gdf['prefecture_code'].nunique()}")
    print(f"  Bounds: {gdf.total_bounds}")

    print("\nClean boundaries complete.")


if __name__ == "__main__":
    main()
