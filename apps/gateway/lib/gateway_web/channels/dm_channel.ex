defmodule GatewayWeb.DmChannel do
  use Phoenix.Channel

  @impl true
  def join("dm:" <> _dm_id, _params, socket) do
    {:ok, socket}
  end

  # DM'de "yazıyor" göstergesi — gönderen hariç odadakilere yayınla
  @impl true
  def handle_in("typing", %{"channel_id" => channel_id}, socket) do
    broadcast_from(socket, "TYPING_START", %{
      user_id: socket.assigns.user_id,
      channel_id: channel_id,
      ts: System.system_time(:millisecond)
    })

    {:noreply, socket}
  end

  def handle_in(_event, _payload, socket), do: {:noreply, socket}
end
