import Config

config :gateway, GatewayWeb.Endpoint,
  url: [host: "localhost"],
  render_errors: [
    formats: [json: GatewayWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Gateway.PubSub

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id, :user_id, :session_id]

config :phoenix, :json_library, Jason

import_config "#{config_env()}.exs"
