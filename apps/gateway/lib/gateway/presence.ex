defmodule Gateway.Presence do
  @moduledoc """
  Kullanıcı online/offline durumu — Phoenix.Presence tabanlı.
  """
  use Phoenix.Presence,
    otp_app: :gateway,
    pubsub_server: Gateway.PubSub
end
