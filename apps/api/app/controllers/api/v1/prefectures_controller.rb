module Api
  module V1
    class PrefecturesController < ApplicationController
      # GET /api/v1/prefectures
      def index
        prefectures = Municipality
          .select(
            "prefecture_code",
            "MIN(prefecture_name) AS prefecture_name",
            "COUNT(*) AS municipality_count",
            "SUM(area_km2) AS total_area_km2"
          )
          .group(:prefecture_code)
          .order(:prefecture_code)

        render json: PrefectureBlueprint.render(prefectures, root: :prefectures)
      end

      # GET /api/v1/prefectures/:code
      def show
        prefecture = Municipality
          .select(
            "prefecture_code",
            "MIN(prefecture_name) AS prefecture_name",
            "COUNT(*) AS municipality_count",
            "SUM(area_km2) AS total_area_km2"
          )
          .where(prefecture_code: params[:code])
          .group(:prefecture_code)
          .take

        if prefecture
          render json: PrefectureBlueprint.render(prefecture, root: :prefecture)
        else
          render json: { error: "Prefecture not found" }, status: :not_found
        end
      end
    end
  end
end
