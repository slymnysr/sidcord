defmodule GatewayWeb.HealthController do
  use Phoenix.Controller, formats: [:json]

  def index(conn, _params) do
    json(conn, %{
      status: "ok",
      service: "sidcord-gateway",
      version: "0.0.1"
    })
  end
end
