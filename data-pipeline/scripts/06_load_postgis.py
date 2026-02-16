#!/usr/bin/env python3
"""Step 06: Load municipality data into PostGIS.

Uses simplified geometry to avoid OOM with full-resolution data.
Loads in chunks for memory efficiency.
"""

import sys
from pathlib import Path

import geopandas as gpd
import pandas as pd
from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.config import get_db_url, get_path, load_settings
from lib.db import execute_sql_file, get_engine


def main():
    settings = load_settings()
    interim_dir = get_path("interim")
    db_url = get_db_url()

    print("=" * 60)
    print("Step 6: Load into PostGIS")
    print("=" * 60)

    # Create engine
    print(f"\nConnecting to database...")
    engine = get_engine(db_url)

    # Verify connection
    with engine.connect() as conn:
        result = conn.execute(text("SELECT PostGIS_Version()"))
        print(f"  PostGIS: {result.scalar()}")

    # Run schema migration
    print("\nCreating schema...")
    sql_dir = Path(__file__).resolve().parent / "sql"
    execute_sql_file(engine, sql_dir / "001_create_municipalities.sql")
    print("  Schema created")

    # Load simplified boundaries (smaller, fits in memory)
    print("\nLoading simplified boundaries...")
    gdf = gpd.read_file(interim_dir / "municipalities_simplified.gpkg")
    print(f"  Loaded {len(gdf)} municipalities")

    # Merge elevation stats if available
    elev_path = interim_dir / "elevation_stats.csv"
    if elev_path.exists():
        print("  Merging elevation statistics...")
        elev_df = pd.read_csv(elev_path, dtype={"code": str})
        gdf = gdf.merge(elev_df, on="code", how="left")

    # Ensure required columns exist
    for col in ["elevation_min", "elevation_max", "elevation_mean",
                "elevation_median", "elevation_std"]:
        if col not in gdf.columns:
            gdf[col] = None

    # Fill municipality_name from district_name when NULL (e.g. 政令市の区)
    if "district_name" in gdf.columns:
        gdf["municipality_name"] = gdf["municipality_name"].fillna(gdf["district_name"])
    gdf["municipality_name"] = gdf["municipality_name"].fillna("")
    gdf["full_name"] = gdf["full_name"].fillna("")
    gdf["prefecture_name"] = gdf["prefecture_name"].fillna("")

    # Drop district_name (not in DB schema)
    if "district_name" in gdf.columns:
        gdf = gdf.drop(columns=["district_name"])

    # Ensure full_name exists
    if "full_name" not in gdf.columns:
        gdf["full_name"] = gdf.get("prefecture_name", "").fillna("") + gdf.get("municipality_name", "").fillna("")

    # Rename geometry for PostGIS schema
    gdf = gdf.rename_geometry("geom")

    # Select columns matching DB schema
    keep_cols = ["code", "prefecture_code", "prefecture_name", "municipality_name",
                 "full_name", "elevation_min", "elevation_max", "elevation_mean",
                 "elevation_median", "elevation_std", "area_km2", "geom"]
    gdf = gdf[[c for c in keep_cols if c in gdf.columns]]

    # Clear existing data and load
    print("\nLoading into PostGIS...")
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE municipalities RESTART IDENTITY"))

    gdf.to_postgis(
        name="municipalities",
        con=engine,
        schema="public",
        if_exists="append",
        index=False,
    )
    print(f"  Loaded {len(gdf)} municipalities")

    # Also set geom_simplified = geom (same data for now)
    print("\nSetting geom_simplified...")
    with engine.begin() as conn:
        conn.execute(text("UPDATE municipalities SET geom_simplified = geom"))

    # Verify
    print("\nVerification:")
    with engine.connect() as conn:
        result = conn.execute(text("SELECT count(*) FROM municipalities"))
        count = result.scalar()
        print(f"  Total municipalities: {count}")

        result = conn.execute(
            text("SELECT count(DISTINCT prefecture_code) FROM municipalities")
        )
        pref_count = result.scalar()
        print(f"  Distinct prefectures: {pref_count}")

        result = conn.execute(text(
            "SELECT count(*) FROM municipalities WHERE geom IS NULL"
        ))
        null_geom = result.scalar()
        print(f"  Null geometries: {null_geom}")

    print("\nPostGIS load complete.")


if __name__ == "__main__":
    main()
