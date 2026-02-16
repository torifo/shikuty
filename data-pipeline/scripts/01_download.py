#!/usr/bin/env python3
"""Step 01: Download N03 administrative boundary data and SRTM DEM tiles."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.config import get_path, load_settings
from lib.downloader import download_file, download_srtm_tiles, extract_zip


def main():
    settings = load_settings()
    raw_dir = get_path("raw")
    raw_dir.mkdir(parents=True, exist_ok=True)

    # --- N03 Administrative Boundaries ---
    print("=" * 60)
    print("Step 1a: Downloading N03 administrative boundary data")
    print("=" * 60)

    n03 = settings["sources"]["n03"]
    zip_path = raw_dir / n03["filename"]
    download_file(n03["url"], zip_path)

    n03_dir = raw_dir / "N03"
    if not n03_dir.exists() or not any(n03_dir.iterdir()):
        extract_zip(zip_path, n03_dir)
    else:
        print(f"  Already extracted: {n03_dir}")

    # Verify GeoJSON or Shapefile exists
    geojson_files = list(n03_dir.rglob("*.geojson")) + list(n03_dir.rglob("*.shp"))
    if not geojson_files:
        print("ERROR: No GeoJSON or Shapefile found in N03 data")
        sys.exit(1)
    print(f"  Found boundary files: {[f.name for f in geojson_files]}")

    # --- SRTM DEM ---
    print()
    print("=" * 60)
    print("Step 1b: Downloading SRTM DEM tiles")
    print("=" * 60)

    srtm = settings["sources"]["srtm"]
    srtm_dir = raw_dir / "srtm"
    tiles = download_srtm_tiles(
        base_url=srtm["base_url"],
        lat_range=srtm["lat_range"],
        lon_range=srtm["lon_range"],
        dest_dir=srtm_dir,
    )
    print(f"  Total SRTM tiles available: {len(tiles)}")

    print()
    print("Download complete.")


if __name__ == "__main__":
    main()
