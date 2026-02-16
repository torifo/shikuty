ActiveRecord::Schema[7.2].define(version: 0) do
  enable_extension "plpgsql"
  enable_extension "postgis"

  create_table "municipalities", force: :cascade do |t|
    t.string "code", limit: 6, null: false
    t.string "prefecture_code", limit: 2, null: false
    t.string "prefecture_name", limit: 20, null: false
    t.string "municipality_name", limit: 40, null: false
    t.string "full_name", limit: 80, null: false
    t.integer "elevation_min"
    t.integer "elevation_max"
    t.decimal "elevation_mean", precision: 6, scale: 1
    t.decimal "elevation_median", precision: 6, scale: 1
    t.decimal "elevation_std", precision: 6, scale: 1
    t.geometry "geom", limit: {:srid=>4326, :type=>"multi_polygon"}, null: false
    t.geometry "geom_simplified", limit: {:srid=>4326, :type=>"multi_polygon"}
    t.decimal "area_km2", precision: 10, scale: 2
    t.datetime "created_at", precision: nil, default: -> { "now()" }
    t.datetime "updated_at", precision: nil, default: -> { "now()" }
    t.index ["code"], name: "idx_municipalities_code"
    t.index ["geom"], name: "idx_municipalities_geom", using: :gist
    t.index ["geom_simplified"], name: "idx_municipalities_geom_simplified", using: :gist
    t.index ["prefecture_code"], name: "idx_municipalities_prefecture_code"
    t.unique_constraint ["code"], name: "municipalities_code_key"
  end
end
