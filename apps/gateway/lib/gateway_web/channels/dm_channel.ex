defmodule GatewayWeb.DmChannel do
  use Phoenix.Channel

  @impl true
  def join("dm:" <> _dm_id, _params, socket) do
    {:ok, socket}
  end
end
