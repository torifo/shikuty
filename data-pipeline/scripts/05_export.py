#!/usr/bin/env python3
"""Step 05: Export national/prefectural GeoJSON and CSV files."""

import json
import sys
from pathlib import Path

import geopandas as gpd
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.config import get_path, load_settings


def main():
    settings = load_settings()
    interim_dir = get_path("interim")
    output_dir = get_path("output")
    output_dir.mkdir(parents=True, exist_ok=True)

    geojson_dir = output_dir / "geojson"
    csv_dir = output_dir / "csv"
    geojson_dir.mkdir(parents=True, exist_ok=True)
    csv_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("Step 5: Export GeoJSON and CSV")
    print("=" * 60)

    # Load simplified boundaries
    print("\nLoading simplified boundaries...")
    gdf = gpd.read_file(interim_dir / "municipalities_simplified.gpkg")
    print(f"  Loaded {len(gdf)} municipalities")

    # Merge elevation stats
    elev_path = interim_dir / "elevation_stats.csv"
    if elev_path.exists():
        print("\nMerging elevation statistics...")
        elev_df = pd.read_csv(elev_path, dtype={"code": str})
        gdf = gdf.merge(elev_df, on="code", how="left")
        print(f"  Merged elevation data for {elev_df['code'].notna().sum()} municipalities")
    else:
        print("\nWARNING: No elevation stats found, skipping merge")

    # --- National GeoJSON ---
    print("\n[1/4] Exporting national GeoJSON...")
    national_path = geojson_dir / "japan.geojson"
    gdf.to_file(national_path, driver="GeoJSON")
    size_mb = national_path.stat().st_size / 1e6
    print(f"  Saved: {national_path} ({size_mb:.1f} MB)")

    # --- Prefectural GeoJSON ---
    print("\n[2/4] Exporting prefectural GeoJSON...")
    pref_dir = geojson_dir / "prefectures"
    pref_dir.mkdir(parents=True, exist_ok=True)

    for pref_code, pref_gdf in gdf.groupby("prefecture_code"):
        pref_path = pref_dir / f"{pref_code}.geojson"
        pref_gdf.to_file(pref_path, driver="GeoJSON")

    print(f"  Saved {gdf['prefecture_code'].nunique()} prefectural files")

    # --- Prefecture-boundary-only GeoJSON (47 polygons) ---
    print("\n[3/4] Exporting prefecture boundaries...")
    pref_boundaries = gdf.dissolve(by="prefecture_code", aggfunc="first").reset_index()
    # Keep only relevant columns
    pref_keep = ["prefecture_code", "prefecture_name", "geometry"]
    pref_boundaries = pref_boundaries[[c for c in pref_keep if c in pref_boundaries.columns]]
    pref_boundaries_path = geojson_dir / "prefectures.geojson"
    pref_boundaries.to_file(pref_boundaries_path, driver="GeoJSON")
    size_kb = pref_boundaries_path.stat().st_size / 1e3
    print(f"  Saved: {pref_boundaries_path} ({size_kb:.0f} KB)")

    # --- CSV metadata ---
    print("\n[4/4] Exporting CSV metadata...")
    csv_cols = [c for c in gdf.columns if c != "geometry"]
    gdf[csv_cols].to_csv(csv_dir / "municipalities.csv", index=False)

    # Prefecture summary
    pref_summary = gdf.groupby(["prefecture_code", "prefecture_name"]).agg(
        municipality_count=("code", "count"),
        total_area_km2=("area_km2", "sum"),
    ).reset_index()
    pref_summary.to_csv(csv_dir / "prefectures.csv", index=False)

    print(f"  Saved CSV files to {csv_dir}")

    print("\nExport complete.")


if __name__ == "__main__":
    main()
