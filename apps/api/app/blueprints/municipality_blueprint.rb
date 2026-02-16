class MunicipalityBlueprint < Blueprinter::Base
  identifier :code

  fields :prefecture_code,
         :prefecture_name,
         :municipality_name,
         :full_name,
         :area_km2

  view :with_elevation do
    fields :elevation_min,
           :elevation_max,
           :elevation_mean,
           :elevation_median,
           :elevation_std
  end
end
