#!/usr/bin/env python3
"""Step 04: Compute elevation statistics from SRTM DEM for each municipality."""

import sys
from pathlib import Path

import geopandas as gpd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.config import get_path, load_settings
from lib.elevation import build_srtm_vrt, compute_elevation_stats


def main():
    settings = load_settings()
    raw_dir = get_path("raw")
    interim_dir = get_path("interim")

    print("=" * 60)
    print("Step 4: Elevation statistics")
    print("=" * 60)

    # Load cleaned (unsimplified) boundaries for accurate stats
    input_path = interim_dir / "municipalities_clean.gpkg"
    print(f"\nLoading boundaries: {input_path}")
    gdf = gpd.read_file(input_path)
    print(f"  Loaded {len(gdf)} municipalities")

    # Build VRT from SRTM tiles
    print("\nPreparing DEM raster...")
    srtm_dir = raw_dir / "srtm"
    vrt_path = interim_dir / "srtm_japan.vrt"
    raster_path = build_srtm_vrt(srtm_dir, vrt_path)

    # Compute zonal statistics
    print("\nComputing elevation statistics...")
    stats_list = settings["elevation"]["stats"]
    gdf = compute_elevation_stats(gdf, raster_path, stats_list)

    # Summary
    print(f"\n  Elevation range across Japan:")
    print(f"    Min: {gdf['elevation_min'].min()}m")
    print(f"    Max: {gdf['elevation_max'].max()}m")
    print(f"    Mean of means: {gdf['elevation_mean'].mean():.1f}m")

    # Save elevation stats as separate file (to be merged later)
    output_path = interim_dir / "elevation_stats.csv"
    elev_cols = ["code"] + [f"elevation_{s}" for s in stats_list]
    gdf[elev_cols].to_csv(output_path, index=False)
    print(f"\nSaved elevation stats to {output_path}")

    print("\nElevation statistics complete.")


if __name__ == "__main__":
    main()
