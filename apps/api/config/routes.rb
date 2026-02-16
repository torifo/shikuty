Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      # メタデータAPI
      resources :prefectures, only: [:index, :show], param: :code
      resources :municipalities, only: [:index, :show], param: :code

      # TopoJSON静的ファイル配信
      namespace :topojson do
        get "japan", to: "files#japan"
        get "prefectures", to: "files#prefectures_all"
        get "prefectures/:code", to: "files#prefecture", as: :prefecture
      end
    end
  end
end
