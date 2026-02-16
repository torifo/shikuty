"""Elevation statistics computation from SRTM DEM data."""

from pathlib import Path

import geopandas as gpd
import numpy as np
import rasterio
from rasterstats import zonal_stats
from rasterio.merge import merge


def build_srtm_vrt(srtm_dir: Path, output_path: Path) -> Path:
    """Build a VRT (virtual raster) from individual SRTM tiles.

    This creates a single virtual file that can be queried as one raster.
    """
    hgt_files = sorted(srtm_dir.glob("*.hgt"))
    if not hgt_files:
        raise FileNotFoundError(f"No .hgt files found in {srtm_dir}")

    print(f"  Building VRT from {len(hgt_files)} tiles")

    # Use rasterio to create a merged VRT-like approach
    # We'll write a GDAL VRT file for efficiency
    import subprocess

    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Use gdalbuildvrt if available, otherwise merge directly
    try:
        file_list = output_path.with_suffix(".txt")
        file_list.write_text("\n".join(str(f) for f in hgt_files))
        subprocess.run(
            ["gdalbuildvrt", "-input_file_list", str(file_list), str(output_path)],
            check=True,
            capture_output=True,
        )
        file_list.unlink()
        print(f"  VRT created: {output_path}")
    except (FileNotFoundError, subprocess.CalledProcessError):
        # gdalbuildvrt not available, create a merged GeoTIFF instead
        print("  gdalbuildvrt not available, merging tiles directly...")
        datasets = [rasterio.open(f) for f in hgt_files]
        merged, transform = merge(datasets)
        for ds in datasets:
            ds.close()

        merged_path = output_path.with_suffix(".tif")
        profile = rasterio.open(hgt_files[0]).profile.copy()
        profile.update(
            height=merged.shape[1],
            width=merged.shape[2],
            transform=transform,
        )
        with rasterio.open(merged_path, "w", **profile) as dst:
            dst.write(merged)
        print(f"  Merged TIF created: {merged_path}")
        return merged_path

    return output_path


def compute_elevation_stats(gdf: gpd.GeoDataFrame, raster_path: Path,
                            stats_list: list[str]) -> gpd.GeoDataFrame:
    """Compute zonal elevation statistics for each municipality.

    Args:
        gdf: GeoDataFrame with municipality geometries
        raster_path: Path to DEM raster (VRT or TIF)
        stats_list: List of stats to compute (min, max, mean, median, std)

    Returns:
        GeoDataFrame with elevation columns added
    """
    print(f"  Computing zonal stats: {stats_list}")
    print(f"  Raster: {raster_path}")
    print(f"  Municipalities: {len(gdf)}")

    results = zonal_stats(
        gdf,
        str(raster_path),
        stats=stats_list,
        nodata=-32768,  # SRTM nodata value
    )

    for stat in stats_list:
        col_name = f"elevation_{stat}"
        values = [r.get(stat) for r in results]
        if stat in ("min", "max"):
            gdf[col_name] = [int(v) if v is not None else None for v in values]
        else:
            gdf[col_name] = [round(v, 1) if v is not None else None for v in values]

    # Report coverage
    null_count = gdf["elevation_mean"].isna().sum()
    if null_count > 0:
        print(f"  WARNING: {null_count} municipalities with no elevation data")
    else:
        print("  All municipalities have elevation data")

    return gdf
