"""Database utilities for PostGIS loading."""

from pathlib import Path

import geopandas as gpd
from sqlalchemy import create_engine, text


def get_engine(db_url: str):
    """Create a SQLAlchemy engine."""
    return create_engine(db_url)


def execute_sql_file(engine, sql_path: Path):
    """Execute a SQL file against the database."""
    sql = sql_path.read_text()
    with engine.begin() as conn:
        conn.execute(text(sql))


def load_municipalities(engine, gdf: gpd.GeoDataFrame, table: str = "municipalities",
                        schema: str = "public", if_exists: str = "replace"):
    """Load municipality GeoDataFrame into PostGIS.

    Args:
        engine: SQLAlchemy engine
        gdf: GeoDataFrame with municipality data
        table: Target table name
        schema: Target schema
        if_exists: 'replace' to drop/recreate, 'append' to add rows
    """
    print(f"  Loading {len(gdf)} municipalities into {schema}.{table}")

    # Rename columns to match DB schema
    col_map = {
        "elevation_min": "elevation_min",
        "elevation_max": "elevation_max",
        "elevation_mean": "elevation_mean",
        "elevation_median": "elevation_median",
        "elevation_std": "elevation_std",
    }

    # Use geopandas to_postgis for geometry handling
    gdf.to_postgis(
        name=table,
        con=engine,
        schema=schema,
        if_exists=if_exists,
        index=False,
    )

    print(f"  Loaded successfully")


def load_simplified_geometry(engine, gdf_simplified: gpd.GeoDataFrame,
                             table: str = "municipalities", schema: str = "public"):
    """Update the geom_simplified column from simplified GeoDataFrame."""
    print(f"  Updating simplified geometries...")

    with engine.begin() as conn:
        for _, row in gdf_simplified.iterrows():
            wkt = row.geometry.wkt
            conn.execute(
                text(f"""
                    UPDATE {schema}.{table}
                    SET geom_simplified = ST_GeomFromText(:wkt, 4326)
                    WHERE code = :code
                """),
                {"wkt": wkt, "code": row["code"]},
            )

    print(f"  Updated {len(gdf_simplified)} simplified geometries")
