module Api
  module V1
    module Topojson
      class FilesController < ApplicationController
        TOPOJSON_DIR = Rails.root.join("..", "..", "data-pipeline", "data", "output", "topojson")

        before_action :set_cache_headers

        # GET /api/v1/topojson/japan
        def japan
          send_topojson("japan.topojson")
        end

        # GET /api/v1/topojson/prefectures
        def prefectures_all
          send_topojson("prefectures.topojson")
        end

        # GET /api/v1/topojson/prefectures/:code
        def prefecture
          code = params[:code]
          unless code.match?(/\A\d{2}\z/)
            return render json: { error: "Invalid prefecture code" }, status: :bad_request
          end

          send_topojson("prefectures/#{code}.topojson")
        end

        private

        def send_topojson(relative_path)
          file_path = TOPOJSON_DIR.join(relative_path)

          unless file_path.exist?
            return render json: { error: "File not found" }, status: :not_found
          end

          send_file file_path,
                    type: "application/topojson+json; charset=utf-8",
                    disposition: "inline"
        end

        def set_cache_headers
          # TopoJSONは静的データなので長期キャッシュ
          expires_in 1.year, public: true, stale_while_revalidate: 1.day
        end
      end
    end
  end
end
