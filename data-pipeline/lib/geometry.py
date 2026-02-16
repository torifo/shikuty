"""Geometry processing utilities for boundary data."""

import geopandas as gpd
from shapely.geometry import MultiPolygon, Polygon
from shapely.validation import make_valid


def load_n03_data(n03_dir) -> gpd.GeoDataFrame:
    """Load N03 data from directory, handling GeoJSON or Shapefile."""
    from pathlib import Path

    n03_dir = Path(n03_dir)

    # Prefer GeoJSON (exclude _prefecture files which contain only 47 prefectures)
    geojson_files = [
        f for f in n03_dir.rglob("*.geojson")
        if "prefecture" not in f.stem.lower()
    ]
    if geojson_files:
        print(f"  Loading: {geojson_files[0]}")
        return gpd.read_file(geojson_files[0])

    # Fall back to Shapefile (exclude _prefecture)
    shp_files = [
        f for f in n03_dir.rglob("*.shp")
        if "prefecture" not in f.stem.lower()
    ]
    if shp_files:
        print(f"  Loading: {shp_files[0]}")
        return gpd.read_file(shp_files[0])

    raise FileNotFoundError(f"No GeoJSON or Shapefile found in {n03_dir}")


def reproject(gdf: gpd.GeoDataFrame, target_crs: str = "EPSG:4326") -> gpd.GeoDataFrame:
    """Reproject GeoDataFrame to target CRS."""
    if gdf.crs is None:
        print("  WARNING: No CRS detected, assuming EPSG:6668")
        gdf = gdf.set_crs("EPSG:6668")

    if gdf.crs.to_epsg() != int(target_crs.split(":")[1]):
        print(f"  Reprojecting from {gdf.crs} to {target_crs}")
        gdf = gdf.to_crs(target_crs)
    else:
        print(f"  Already in {target_crs}")

    return gdf


def fix_geometries(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Fix invalid geometries using make_valid."""
    invalid_count = (~gdf.geometry.is_valid).sum()
    if invalid_count > 0:
        print(f"  Fixing {invalid_count} invalid geometries")
        gdf["geometry"] = gdf.geometry.apply(
            lambda g: make_valid(g) if not g.is_valid else g
        )
    else:
        print("  All geometries valid")
    return gdf


def ensure_multipolygon(geom):
    """Convert Polygon to MultiPolygon for consistency."""
    if isinstance(geom, Polygon):
        return MultiPolygon([geom])
    return geom


def dissolve_by_code(gdf: gpd.GeoDataFrame, code_col: str) -> gpd.GeoDataFrame:
    """Dissolve geometries by municipality code, preserving attributes.

    N03 data has multiple polygons per municipality (islands, exclaves).
    This merges them into single MultiPolygon per code.
    """
    # Keep first occurrence of attribute columns for each code
    attr_cols = [c for c in gdf.columns if c != "geometry" and c != code_col]

    print(f"  Dissolving {len(gdf)} polygons by {code_col}")

    # Filter out rows with null code (ocean/unincorporated areas)
    null_count = gdf[code_col].isna().sum()
    if null_count > 0:
        print(f"  Dropping {null_count} rows with null {code_col}")
        gdf = gdf.dropna(subset=[code_col])

    dissolved = gdf.dissolve(by=code_col, aggfunc="first").reset_index()

    # Ensure all geometries are MultiPolygon
    dissolved["geometry"] = dissolved.geometry.apply(ensure_multipolygon)

    print(f"  Result: {len(dissolved)} municipalities")
    return dissolved


def compute_area_km2(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Compute area in km² using an equal-area projection."""
    # Use Japan Plane Rectangular CS (zone VIII, EPSG:6677 covers most of Japan)
    # For accurate area, project to equal-area then back
    gdf_ea = gdf.to_crs("EPSG:6933")  # World Cylindrical Equal Area
    gdf["area_km2"] = (gdf_ea.geometry.area / 1e6).round(2)
    return gdf
