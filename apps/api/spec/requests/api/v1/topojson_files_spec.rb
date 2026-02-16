require "rails_helper"

RSpec.describe "Api::V1::Topojson::Files", type: :request do
  let(:topojson_dir) do
    Rails.root.join("..", "..", "data-pipeline", "data", "output", "topojson")
  end

  describe "GET /api/v1/topojson/japan" do
    it "returns japan.topojson when file exists" do
      skip "TopoJSON files not yet generated" unless topojson_dir.join("japan.topojson").exist?

      get "/api/v1/topojson/japan"
      expect(response).to have_http_status(:ok)
      expect(response.headers["Content-Type"]).to include("topojson")
    end

    it "returns 404 when file does not exist" do
      allow_any_instance_of(Pathname).to receive(:exist?).and_return(false)

      get "/api/v1/topojson/japan"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "GET /api/v1/topojson/prefectures/:code" do
    it "rejects invalid prefecture codes" do
      get "/api/v1/topojson/prefectures/abc"
      expect(response).to have_http_status(:bad_request)
    end

    it "rejects too-long codes" do
      get "/api/v1/topojson/prefectures/123"
      expect(response).to have_http_status(:bad_request)
    end
  end
end
