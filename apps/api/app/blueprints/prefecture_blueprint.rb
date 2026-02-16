class PrefectureBlueprint < Blueprinter::Base
  identifier :prefecture_code

  fields :prefecture_name

  field :municipality_count do |pref, _options|
    pref.try(:municipality_count) || 0
  end

  field :total_area_km2 do |pref, _options|
    pref.try(:total_area_km2)&.to_f
  end
end
