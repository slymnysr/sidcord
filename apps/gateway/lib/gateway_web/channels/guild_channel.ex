defmodule GatewayWeb.GuildChannel do
  @moduledoc """
  Sunucu kanalı — gerçek zamanlı sunucu olayları + presence tracking.
  Bir kullanıcı bu kanala bağlandığında Gateway.Presence'a kaydedilir,
  guild içindeki diğer kullanıcılar online durumunu görür.
  """
  use Phoenix.Channel
  alias Gateway.Presence
  require Logger

  @impl true
  def join("guild:" <> _guild_id, _params, socket) do
    send(self(), :after_join)
    {:ok, %{joined_at: System.system_time(:millisecond)}, socket}
  end

  @impl true
  def handle_info(:after_join, socket) do
    push(socket, "presence_state", Presence.list(socket))

    {:ok, _} =
      Presence.track(socket, to_string(socket.assigns.user_id), %{
        online_at: System.system_time(:millisecond),
        status: "online"
      })

    {:noreply, socket}
  end

  @impl true
  def handle_in("ping", _payload, socket) do
    {:reply, {:ok, %{pong: System.system_time(:millisecond)}}, socket}
  end

  def handle_in("typing", %{"channel_id" => channel_id}, socket) do
    broadcast_from(socket, "TYPING_START", %{
      user_id: socket.assigns.user_id,
      channel_id: channel_id,
      ts: System.system_time(:millisecond)
    })
    {:noreply, socket}
  end
end
