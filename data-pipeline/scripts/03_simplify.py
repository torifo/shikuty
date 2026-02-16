#!/usr/bin/env python3
"""Step 03: Topology-preserving simplification using mapshaper (Node.js).

Uses mapshaper CLI for memory-efficient, topology-preserving simplification.
Mapshaper automatically detects shared boundaries and preserves them.
"""

import subprocess
import sys
from pathlib import Path

import geopandas as gpd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.config import get_path, load_settings


def main():
    settings = load_settings()
    interim_dir = get_path("interim")
    project_root = get_path("raw").parent.parent  # data-pipeline/

    print("=" * 60)
    print("Step 3: Topology-preserving simplification")
    print("=" * 60)

    mapshaper = project_root / "node_modules" / ".bin" / "mapshaper"
    if not mapshaper.exists():
        print("ERROR: mapshaper not found. Run 'npm install' first.")
        sys.exit(1)

    input_path = interim_dir / "municipalities_clean.gpkg"
    output_gpkg = interim_dir / "municipalities_simplified.gpkg"
    output_geojson = interim_dir / "municipalities_simplified.geojson"

    print(f"\nInput: {input_path}")

    # First convert GPKG to GeoJSON for mapshaper
    print("\n  Converting GPKG to GeoJSON for mapshaper...")
    temp_geojson = interim_dir / "municipalities_clean.geojson"
    gdf = gpd.read_file(input_path)
    print(f"  Loaded {len(gdf)} municipalities")
    gdf.to_file(temp_geojson, driver="GeoJSON")

    # Run mapshaper for topology-preserving simplification
    # - visvalingam: Visvalingam-Whyatt algorithm
    # - percentage: keep this fraction of removable points
    # - planar: use planar coordinates (for degree-based data)
    tolerance = settings["simplification"]["tolerance"]
    print(f"\n  Algorithm: Visvalingam (topology-preserving via mapshaper)")
    print(f"  Interval: {tolerance} degrees (~{tolerance * 111_000:.0f}m)")

    cmd = [
        str(mapshaper),
        str(temp_geojson),
        "-simplify", f"interval={tolerance}", "visvalingam", "planar", "keep-shapes",
        "-o", str(output_geojson), "format=geojson",
    ]

    print(f"\n  Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  STDERR: {result.stderr}")
        sys.exit(1)
    print(f"  {result.stderr.strip()}" if result.stderr else "  Done")

    # Load result and save as GPKG
    print("\n  Loading simplified result...")
    gdf_simplified = gpd.read_file(output_geojson)
    print(f"  Result: {len(gdf_simplified)} municipalities")

    # Save as GPKG
    gdf_simplified.to_file(output_gpkg, driver="GPKG")

    # Report file sizes
    orig_size = temp_geojson.stat().st_size / 1e6
    simp_size = output_geojson.stat().st_size / 1e6
    reduction = (1 - simp_size / orig_size) * 100
    print(f"\n  GeoJSON size: {orig_size:.1f}MB -> {simp_size:.1f}MB ({reduction:.1f}% reduction)")

    # Cleanup temp file
    temp_geojson.unlink()

    print("\nSimplification complete.")


if __name__ == "__main__":
    main()
