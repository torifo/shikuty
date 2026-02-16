"""Shared configuration loader for the data pipeline."""

import os
from pathlib import Path

import yaml


def get_project_root() -> Path:
    """Return the data-pipeline root directory."""
    return Path(__file__).resolve().parent.parent


def load_settings() -> dict:
    """Load settings from config/settings.yaml."""
    root = get_project_root()
    settings_path = root / "config" / "settings.yaml"
    with open(settings_path) as f:
        return yaml.safe_load(f)


def get_path(key: str) -> Path:
    """Get a data path from settings, resolved relative to project root."""
    settings = load_settings()
    root = get_project_root()
    return root / settings["paths"][key]


def get_db_url() -> str:
    """Build a SQLAlchemy database URL from settings."""
    settings = load_settings()
    db = settings["database"]
    password = os.environ.get("SHIKUTY_DB_PASSWORD", db.get("password", ""))
    pwd_part = f":{password}" if password else ""
    return f"postgresql://{db['user']}{pwd_part}@{db['host']}:{db['port']}/{db['name']}"
