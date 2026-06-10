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
  def join("guild:" <> _guild_id, params, socket) do
    send(self(), :after_join)
    status = validate_status(Map.get(params, "status"))
    {:ok, %{joined_at: System.system_time(:millisecond)}, assign(socket, :presence_status, status)}
  end

  @impl true
  def handle_info(:after_join, socket) do
    push(socket, "presence_state", Presence.list(socket))

    # Görünmez ("offline" seçili) kullanıcı presence'a hiç yazılmaz — herkese çevrimdışı görünür,
    # ama kanalda kalır ve tüm olayları almaya devam eder.
    unless socket.assigns.presence_status == "offline" do
      {:ok, _} =
        Presence.track(socket, to_string(socket.assigns.user_id), %{
          online_at: System.system_time(:millisecond),
          status: socket.assigns.presence_status
        })
    end

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

  # Durum değişikliği (online/idle/dnd/offline) — "offline" = görünmez: presence'tan çıkar.
  def handle_in("status", %{"status" => s}, socket) do
    new_status = validate_status(s)
    old_status = socket.assigns.presence_status
    socket = assign(socket, :presence_status, new_status)
    uid = to_string(socket.assigns.user_id)

    cond do
      new_status == "offline" and old_status != "offline" ->
        Presence.untrack(socket, uid)

      new_status != "offline" and old_status == "offline" ->
        {:ok, _} =
          Presence.track(socket, uid, %{
            online_at: System.system_time(:millisecond),
            status: new_status
          })

      new_status != "offline" ->
        Presence.update(socket, uid, fn meta -> Map.put(meta, :status, new_status) end)

      true ->
        :ok
    end

    {:noreply, socket}
  end

  # Rich presence: aktivite ayarla/temizle — presence meta üzerinden tüm üyelere yayılır.
  # payload: %{"type" => "playing|streaming|listening|watching|custom", "name" => "..."} | %{} (temizle)
  def handle_in("activity", payload, socket) do
    activity =
      case payload do
        %{"name" => name} when is_binary(name) and name != "" ->
          %{
            type: validate_activity_type(Map.get(payload, "type")),
            name: String.slice(name, 0, 128),
            started_at: Map.get(payload, "started_at") || System.system_time(:millisecond)
          }

        _ ->
          nil
      end

    # Görünmez kullanıcı presence'ta yok — update hata verir, aktivite zaten gizli.
    unless socket.assigns.presence_status == "offline" do
      Presence.update(socket, to_string(socket.assigns.user_id), fn meta ->
        if activity, do: Map.put(meta, :activity, activity), else: Map.delete(meta, :activity)
      end)
    end

    {:noreply, socket}
  end

  defp validate_status(s) when s in ["online", "idle", "dnd", "offline"], do: s
  defp validate_status(_), do: "online"

  defp validate_activity_type(t) when t in ["playing", "streaming", "listening", "watching", "custom"], do: t
  defp validate_activity_type(_), do: "playing"
end
