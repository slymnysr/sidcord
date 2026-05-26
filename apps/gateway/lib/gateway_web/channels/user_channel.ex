defmodule GatewayWeb.UserChannel do
  @moduledoc """
  Kullanıcı kişisel kanalı — bildirimler, presence, friend events.
  """
  use Phoenix.Channel

  @impl true
  def join("user:" <> user_id, _params, %{assigns: %{user_id: user_id}} = socket) do
    {:ok, socket}
  end

  def join("user:" <> _other_id, _params, _socket) do
    {:error, %{reason: "unauthorized"}}
  end
end
