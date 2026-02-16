require "rails_helper"

RSpec.describe "Api::V1::Municipalities", type: :request do
  before do
    Municipality.create!(
      code: "13101",
      prefecture_code: "13",
      prefecture_name: "東京都",
      municipality_name: "千代田区",
      full_name: "東京都千代田区",
      area_km2: 11.66,
      elevation_min: 0,
      elevation_max: 26,
      elevation_mean: 6.2,
      geom: "SRID=4326;MULTIPOLYGON(((139.74 35.68, 139.77 35.68, 139.77 35.70, 139.74 35.70, 139.74 35.68)))"
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

  describe "GET /api/v1/municipalities" do
    it "returns all municipalities" do
      get "/api/v1/municipalities"

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["municipalities"].length).to eq(2)
    end

    it "filters by prefecture_code" do
      get "/api/v1/municipalities", params: { prefecture_code: "13" }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["municipalities"].length).to eq(1)
      expect(json["municipalities"][0]["code"]).to eq("13101")
    end
  end

  describe "GET /api/v1/municipalities/:code" do
    it "returns a specific municipality with elevation data" do
      get "/api/v1/municipalities/13101"

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      muni = json["municipality"]

      expect(muni["code"]).to eq("13101")
      expect(muni["municipality_name"]).to eq("千代田区")
      expect(muni["elevation_min"]).to eq(0)
      expect(muni["elevation_max"]).to eq(26)
    end

    it "returns 404 for unknown municipality" do
      get "/api/v1/municipalities/99999"

      expect(response).to have_http_status(:not_found)
    end
  end
end
