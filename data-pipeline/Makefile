.PHONY: all clean download clean-boundaries simplify elevation export topojson load-db validate setup

PYTHON := python3
SCRIPTS := scripts
DATA_RAW := data/raw
DATA_INTERIM := data/interim
DATA_OUTPUT := data/output
TOPOJSON_DIR := data/output/topojson

# Sentinel files to track pipeline stages
STAMPS := data/.stamps
STAMP_DOWNLOAD := $(STAMPS)/01_download
STAMP_CLEAN := $(STAMPS)/02_clean
STAMP_SIMPLIFY := $(STAMPS)/03_simplify
STAMP_ELEVATION := $(STAMPS)/04_elevation
STAMP_EXPORT := $(STAMPS)/05_export
STAMP_POSTGIS := $(STAMPS)/06_postgis
STAMP_TOPOJSON := $(STAMPS)/07_topojson
STAMP_VALIDATE := $(STAMPS)/08_validate

all: validate

setup:
	pip install -r requirements.txt
	npm install

$(STAMPS):
	mkdir -p $(STAMPS)

# Step 1: Download raw data
$(STAMP_DOWNLOAD): $(STAMPS)
	$(PYTHON) $(SCRIPTS)/01_download.py
	touch $@

download: $(STAMP_DOWNLOAD)

# Step 2: Clean boundaries (dissolve, reproject, fix topology)
$(STAMP_CLEAN): $(STAMP_DOWNLOAD)
	$(PYTHON) $(SCRIPTS)/02_clean_boundaries.py
	touch $@

clean-boundaries: $(STAMP_CLEAN)

# Step 3: Topology-preserving simplification
$(STAMP_SIMPLIFY): $(STAMP_CLEAN)
	$(PYTHON) $(SCRIPTS)/03_simplify.py
	touch $@

simplify: $(STAMP_SIMPLIFY)

# Step 4: Elevation statistics
$(STAMP_ELEVATION): $(STAMP_DOWNLOAD) $(STAMP_CLEAN)
	$(PYTHON) $(SCRIPTS)/04_elevation_stats.py
	touch $@

elevation: $(STAMP_ELEVATION)

# Step 5: Export GeoJSON + CSV
$(STAMP_EXPORT): $(STAMP_SIMPLIFY) $(STAMP_ELEVATION)
	$(PYTHON) $(SCRIPTS)/05_export.py
	touch $@

export: $(STAMP_EXPORT)

# Step 6: Load into PostGIS
$(STAMP_POSTGIS): $(STAMP_EXPORT)
	$(PYTHON) $(SCRIPTS)/06_load_postgis.py
	touch $@

load-db: $(STAMP_POSTGIS)

# Step 7: Convert to TopoJSON (Node.js)
$(STAMP_TOPOJSON): $(STAMP_EXPORT)
	bash $(SCRIPTS)/07_topojson_convert.sh
	touch $@

topojson: $(STAMP_TOPOJSON)

# Step 8: Validate outputs
$(STAMP_VALIDATE): $(STAMP_TOPOJSON) $(STAMP_POSTGIS)
	$(PYTHON) $(SCRIPTS)/08_validate.py
	touch $@

validate: $(STAMP_VALIDATE)

# Clean all generated data and stamps
clean:
	rm -rf $(DATA_INTERIM)/*
	rm -rf $(DATA_OUTPUT)/*
	rm -rf $(STAMPS)

# Clean everything including raw downloads
clean-all: clean
	rm -rf $(DATA_RAW)/*
