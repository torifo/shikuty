"""Tests for lib/geometry.py."""

import sys
from pathlib import Path

import geopandas as gpd
import pytest
from shapely.geometry import MultiPolygon, Polygon

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.geometry import (
    compute_area_km2,
    dissolve_by_code,
    ensure_multipolygon,
    fix_geometries,
    reproject,
)


class TestEnsureMultiPolygon:
    def test_polygon_to_multipolygon(self):
        poly = Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])
        result = ensure_multipolygon(poly)
        assert isinstance(result, MultiPolygon)

    def test_multipolygon_unchanged(self):
        mp = MultiPolygon([Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])])
        result = ensure_multipolygon(mp)
        assert result is mp


class TestReproject:
    def test_reproject_6668_to_4326(self):
        gdf = gpd.GeoDataFrame(
            {"a": [1]},
            geometry=[Polygon([(139.7, 35.7), (139.8, 35.7), (139.8, 35.8)])],
            crs="EPSG:6668",
        )
        result = reproject(gdf, "EPSG:4326")
        assert result.crs.to_epsg() == 4326

    def test_already_4326(self):
        gdf = gpd.GeoDataFrame(
            {"a": [1]},
            geometry=[Polygon([(139.7, 35.7), (139.8, 35.7), (139.8, 35.8)])],
            crs="EPSG:4326",
        )
        result = reproject(gdf, "EPSG:4326")
        assert result.crs.to_epsg() == 4326


class TestFixGeometries:
    def test_valid_geometry_unchanged(self, sample_gdf):
        result = fix_geometries(sample_gdf)
        assert len(result) == len(sample_gdf)
        assert result.geometry.is_valid.all()

    def test_fixes_invalid_geometry(self):
        # Bowtie polygon (self-intersecting)
        bowtie = Polygon([(0, 0), (1, 1), (1, 0), (0, 1)])
        gdf = gpd.GeoDataFrame({"a": [1]}, geometry=[bowtie], crs="EPSG:4326")
        result = fix_geometries(gdf)
        assert result.geometry.is_valid.all()


class TestDissolveByCode:
    def test_dissolve_merges_duplicates(self, sample_n03_gdf):
        result = dissolve_by_code(sample_n03_gdf, "N03_007")
        assert len(result) == 2  # 13101 (merged) + 27140

    def test_dissolved_geometry_is_multipolygon(self, sample_n03_gdf):
        result = dissolve_by_code(sample_n03_gdf, "N03_007")
        for geom in result.geometry:
            assert isinstance(geom, MultiPolygon)

    def test_preserves_attributes(self, sample_n03_gdf):
        result = dissolve_by_code(sample_n03_gdf, "N03_007")
        row = result[result["N03_007"] == "13101"].iloc[0]
        assert row["N03_001"] == "東京都"

    def test_drops_null_codes(self):
        gdf = gpd.GeoDataFrame(
            {
                "N03_007": ["13101", None],
                "N03_001": ["東京都", "不明"],
                "geometry": [
                    Polygon([(0, 0), (1, 0), (1, 1), (0, 1)]),
                    Polygon([(2, 2), (3, 2), (3, 3), (2, 3)]),
                ],
            },
            crs="EPSG:4326",
        )
        result = dissolve_by_code(gdf, "N03_007")
        assert len(result) == 1


class TestComputeAreaKm2:
    def test_area_is_positive(self, sample_gdf):
        result = compute_area_km2(sample_gdf)
        assert "area_km2" in result.columns
        assert (result["area_km2"] > 0).all()
