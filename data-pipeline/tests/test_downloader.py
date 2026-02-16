"""Tests for lib/downloader.py."""

import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.downloader import build_srtm_url, extract_zip


class TestBuildSrtmUrl:
    def test_north_east(self):
        url = build_srtm_url("https://example.com/skadi", 35, 135)
        assert url == "https://example.com/skadi/N35/N35E135.hgt.gz"

    def test_south_west(self):
        url = build_srtm_url("https://example.com/skadi", -10, -70)
        assert url == "https://example.com/skadi/S10/S10W070.hgt.gz"

    def test_zero_lat_lon(self):
        url = build_srtm_url("https://example.com/skadi", 0, 0)
        assert url == "https://example.com/skadi/N00/N00E000.hgt.gz"


class TestExtractZip:
    def test_extract(self, tmp_path):
        # Create a test zip file
        zip_path = tmp_path / "test.zip"
        with zipfile.ZipFile(zip_path, "w") as zf:
            zf.writestr("test.txt", "hello")

        dest = tmp_path / "extracted"
        extract_zip(zip_path, dest)

        assert (dest / "test.txt").exists()
        assert (dest / "test.txt").read_text() == "hello"
