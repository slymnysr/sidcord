import Config

config :gateway, GatewayWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "test_secret_key_base_change_in_production_at_least_64_chars_long_string_here",
  server: false

config :logger, level: :warning
