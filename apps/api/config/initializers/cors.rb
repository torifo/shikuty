Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins ENV.fetch("CORS_ORIGINS", "*")

    resource "*",
      headers: :any,
      methods: [:get, :options, :head],
      max_age: 86_400
  end
end
