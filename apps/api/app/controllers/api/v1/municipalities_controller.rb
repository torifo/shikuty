module Api
  module V1
    class MunicipalitiesController < ApplicationController
      # GET /api/v1/municipalities?prefecture_code=13
      def index
        municipalities = Municipality.ordered

        if params[:prefecture_code].present?
          municipalities = municipalities.by_prefecture(params[:prefecture_code])
        end

        municipalities = municipalities.page(params[:page]).per(params[:per] || 50)

        render json: MunicipalityBlueprint.render(
          municipalities,
          view: :with_elevation,
          root: :municipalities,
          meta: {
            total: municipalities.total_count,
            page: municipalities.current_page,
            per: municipalities.limit_value
          }
        )
      end

      # GET /api/v1/municipalities/:code
      def show
        municipality = Municipality.find_by!(code: params[:code])

        render json: MunicipalityBlueprint.render(
          municipality,
          view: :with_elevation,
          root: :municipality
        )
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Municipality not found" }, status: :not_found
      end
    end
  end
end
