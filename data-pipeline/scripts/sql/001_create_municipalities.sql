-- Create municipalities table for Shikuty
-- Stores boundary geometry and metadata for all Japanese municipalities

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS municipalities (
    id              BIGSERIAL PRIMARY KEY,
    code            VARCHAR(6) NOT NULL UNIQUE,
    prefecture_code VARCHAR(2) NOT NULL,
    prefecture_name VARCHAR(20) NOT NULL,
    municipality_name VARCHAR(40) NOT NULL,
    full_name       VARCHAR(80) NOT NULL,
    elevation_min   INTEGER,
    elevation_max   INTEGER,
    elevation_mean  NUMERIC(6,1),
    elevation_median NUMERIC(6,1),
    elevation_std   NUMERIC(6,1),
    geom            GEOMETRY(MultiPolygon, 4326) NOT NULL,
    geom_simplified GEOMETRY(MultiPolygon, 4326),
    area_km2        NUMERIC(10,2),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Spatial indexes
CREATE INDEX IF NOT EXISTS idx_municipalities_geom
    ON municipalities USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_municipalities_geom_simplified
    ON municipalities USING GIST (geom_simplified);

-- B-tree indexes
CREATE INDEX IF NOT EXISTS idx_municipalities_code
    ON municipalities (code);
CREATE INDEX IF NOT EXISTS idx_municipalities_prefecture_code
    ON municipalities (prefecture_code);
