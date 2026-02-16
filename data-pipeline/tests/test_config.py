"""Tests for lib/config.py."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.config import get_path, get_project_root, load_settings


def test_get_project_root():
    root = get_project_root()
    assert root.name == "data-pipeline"
    assert (root / "config" / "settings.yaml").exists()


def test_load_settings():
    settings = load_settings()
    assert "sources" in settings
    assert "simplification" in settings
    assert "database" in settings
    assert settings["simplification"]["tolerance"] == 0.0001


def test_get_path():
    raw_path = get_path("raw")
    assert raw_path.name == "raw"
    assert "data-pipeline" in str(raw_path)


def test_settings_has_required_keys():
    settings = load_settings()

    # Sources
    assert "n03" in settings["sources"]
    assert "url" in settings["sources"]["n03"]
    assert "srtm" in settings["sources"]

    # Simplification
    assert "tolerance" in settings["simplification"]
    assert "quantization" in settings["simplification"]

    # Elevation
    assert "stats" in settings["elevation"]
    assert "min" in settings["elevation"]["stats"]

    # Output limits
    assert "file_size_limits" in settings["output"]
