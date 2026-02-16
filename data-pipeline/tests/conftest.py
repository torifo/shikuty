"""Shared test fixtures for data pipeline tests."""

import tempfile
from pathlib import Path

import geopandas as gpd
import numpy as np
import pytest
from shapely.geometry import MultiPolygon, Polygon


@pytest.fixture
def tmp_dir(tmp_path):
    """Provide a temporary directory."""
    return tmp_path


@pytest.fixture
def sample_polygons():
    """Create sample adjacent municipality polygons for testing."""
    # Two adjacent squares sharing an edge
    poly1 = Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])
    poly2 = Polygon([(1, 0), (2, 0), (2, 1), (1, 1)])
    poly3 = Polygon([(0, 1), (1, 1), (1, 2), (0, 2)])
    return [
        MultiPolygon([poly1]),
        MultiPolygon([poly2]),
        MultiPolygon([poly3]),
    ]


@pytest.fixture
def sample_gdf(sample_polygons):
    """Create a sample GeoDataFrame mimicking N03 structure."""
    return gpd.GeoDataFrame(
        {
            "N03_001": ["東京都", "東京都", "神奈川県"],
            "N03_003": ["千代田区", "中央区", "横浜市"],
            "N03_004": [None, None, None],
            "N03_007": ["13101", "13102", "14101"],
            "geometry": sample_polygons,
        },
        crs="EPSG:4326",
    )


@pytest.fixture
def sample_n03_gdf():
    """Create a sample GeoDataFrame with duplicate codes (pre-dissolve).

    Simulates a municipality with multiple polygons (e.g. islands).
    """
    poly_main = Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])
    poly_island = Polygon([(2, 2), (2.5, 2), (2.5, 2.5), (2, 2.5)])
    poly_other = Polygon([(3, 0), (4, 0), (4, 1), (3, 1)])

    return gpd.GeoDataFrame(
        {
            "N03_001": ["東京都", "東京都", "大阪府"],
            "N03_003": ["千代田区", "千代田区", "堺市"],
            "N03_004": [None, None, None],
            "N03_007": ["13101", "13101", "27140"],
            "geometry": [poly_main, poly_island, poly_other],
        },
        crs="EPSG:4326",
    )


@pytest.fixture
def settings():
    """Load pipeline settings."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from lib.config import load_settings
    return load_settings()
