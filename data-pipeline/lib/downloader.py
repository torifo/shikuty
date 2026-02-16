"""Download utilities for N03 and SRTM data."""

import zipfile
from pathlib import Path

import requests
from tqdm import tqdm


def download_file(url: str, dest: Path, chunk_size: int = 8192) -> Path:
    """Download a file with progress bar. Skips if file already exists."""
    if dest.exists():
        print(f"  Already exists: {dest}")
        return dest

    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"  Downloading: {url}")

    response = requests.get(url, stream=True, timeout=300)
    response.raise_for_status()

    total = int(response.headers.get("content-length", 0))
    with open(dest, "wb") as f, tqdm(total=total, unit="B", unit_scale=True) as pbar:
        for chunk in response.iter_content(chunk_size=chunk_size):
            f.write(chunk)
            pbar.update(len(chunk))

    return dest


def extract_zip(zip_path: Path, dest_dir: Path) -> Path:
    """Extract a zip file to destination directory."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    print(f"  Extracting: {zip_path} -> {dest_dir}")

    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(dest_dir)

    return dest_dir


def build_srtm_url(base_url: str, lat: int, lon: int) -> str:
    """Build SRTM tile URL for given lat/lon."""
    ns = "N" if lat >= 0 else "S"
    ew = "E" if lon >= 0 else "W"
    tile_name = f"{ns}{abs(lat):02d}{ew}{abs(lon):03d}"
    return f"{base_url}/{ns}{abs(lat):02d}/{tile_name}.hgt.gz"


def download_srtm_tiles(base_url: str, lat_range: list, lon_range: list,
                         dest_dir: Path) -> list[Path]:
    """Download SRTM tiles for the specified lat/lon range.

    Returns list of successfully downloaded tile paths.
    """
    import gzip
    import shutil

    dest_dir.mkdir(parents=True, exist_ok=True)
    downloaded = []

    lat_min, lat_max = lat_range
    lon_min, lon_max = lon_range
    total_tiles = (lat_max - lat_min + 1) * (lon_max - lon_min + 1)
    print(f"  Downloading SRTM tiles: {total_tiles} potential tiles")

    for lat in range(lat_min, lat_max + 1):
        for lon in range(lon_min, lon_max + 1):
            url = build_srtm_url(base_url, lat, lon)
            ns = "N" if lat >= 0 else "S"
            ew = "E" if lon >= 0 else "W"
            tile_name = f"{ns}{abs(lat):02d}{ew}{abs(lon):03d}"
            hgt_path = dest_dir / f"{tile_name}.hgt"

            if hgt_path.exists():
                downloaded.append(hgt_path)
                continue

            gz_path = dest_dir / f"{tile_name}.hgt.gz"
            try:
                response = requests.get(url, stream=True, timeout=60)
                if response.status_code == 404:
                    continue  # Ocean tile, expected
                response.raise_for_status()

                with open(gz_path, "wb") as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)

                # Decompress
                with gzip.open(gz_path, "rb") as f_in, open(hgt_path, "wb") as f_out:
                    shutil.copyfileobj(f_in, f_out)
                gz_path.unlink()

                downloaded.append(hgt_path)
            except requests.RequestException:
                # Some tiles over ocean don't exist
                if gz_path.exists():
                    gz_path.unlink()
                continue

    print(f"  Downloaded {len(downloaded)} SRTM tiles")
    return downloaded
