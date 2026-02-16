require "rails_helper"

RSpec.describe "Api::V1::Prefectures", type: :request do
  before do
    Municipality.create!(
      code: "13101",
      prefecture_code: "13",
      prefecture_name: "東京都",
      municipality_name: "千代田区",
      full_name: "東京都千代田区",
      area_km2: 11.66,
      geom: "SRID=4326;MULTIPOLYGON(((139.74 35.68, 139.77 35.68, 139.77 35.70, 139.74 35.70, 139.74 35.68)))"
    )
    Municipality.create!(
      code: "13102",
      prefecture_code: "13",
      prefecture_name: "東京都",
      municipality_name: "中央区",
      full_name: "東京都中央区",
      area_km2: 10.21,
      geom: "SRID=4326;MULTIPOLYGON(((139.76 35.66, 139.79 35.66, 139.79 35.68, 139.76 35.68, 139.76 35.66)))"
    )
    Municipality.create!(
      code: "27102",
      prefecture_code: "27",
      prefecture_name: "大阪府",
      municipality_name: "堺市",
      full_name: "大阪府堺市",
      area_km2: 149.82,
      geom: "SRID=4326;MULTIPOLYGON(((135.46 34.54, 135.52 34.54, 135.52 34.58, 135.46 34.58, 135.46 34.54)))"
    )
  end

  describe "GET /api/v1/prefectures" do
    it "returns all prefectures with municipality counts" do
      get "/api/v1/prefectures"

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      prefectures = json["prefectures"]

      expect(prefectures.length).to eq(2)

      tokyo = prefectures.find { |p| p["prefecture_code"] == "13" }
      expect(tokyo["prefecture_name"]).to eq("東京都")
      expect(tokyo["municipality_count"]).to eq(2)
    end
  end

  describe "GET /api/v1/prefectures/:code" do
    it "returns a specific prefecture" do
      get "/api/v1/prefectures/13"

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["prefecture"]["prefecture_name"]).to eq("東京都")
    end

    it "returns 404 for unknown prefecture" do
      get "/api/v1/prefectures/99"

      expect(response).to have_http_status(:not_found)
    end
  end
end
