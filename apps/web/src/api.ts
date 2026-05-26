// Sidcord API istemcisi — fetch tabanlı, auth header + token refresh
export type Snowflake = string;

const API_BASE = '/api/v1';
const TOKEN_KEY = 'sidcord_access';
const REFRESH_KEY = 'sidcord_refresh';

export interface APIUser {
  id: Snowflake;
  username: string;
  email: string;
  display_name: string;
  avatar_color: string;
  avatar_url?: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  bot: boolean;
  created_at: string;
}

export interface APIGuild {
  id: Snowflake;
  name: string;
  icon_text: string;
  icon_color: string;
  owner_id: Snowflake;
  description?: string;
  is_public: boolean;
  created_at: string;
}

export interface APIChannel {
  id: Snowflake;
  guild_id: Snowflake;
  parent_id?: Snowflake;
  type: 'text' | 'voice' | 'announcement' | 'forum' | 'stage' | 'category' | 'media' | 'public_thread' | 'private_thread' | 'news_thread';
  name: string;
  topic?: string;
  position: number;
  nsfw: boolean;
  rate_limit_sec: number;
  created_at: string;
}

export interface APIAttachment {
  id: Snowflake;
  message_id: Snowflake;
  filename: string;
  url: string;
  content_type?: string;
  size_bytes: number;
  created_at: string;
}

export interface APIMessage {
  id: Snowflake;
  channel_id: Snowflake;
  author_id: Snowflake;
  content: string;
  edited_at?: string;
  created_at: string;
  attachments?: APIAttachment[];
}

export interface APIMember {
  user_id: Snowflake;
  guild_id: Snowflake;
  nickname?: string;
  joined_at: string;
  username: string;
  display_name: string;
  avatar_color: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  bot: boolean;
  role_ids: Snowflake[];
}

export interface APIInvite {
  code: string;
  guild_id: Snowflake;
  inviter_id: Snowflake;
  max_uses?: number;
  uses: number;
  expires_at?: string;
  created_at: string;
}

export interface APIInvitePreview {
  code: string;
  guild: APIGuild;
  inviter: APIUser;
  member_count: number;
  uses: number;
  max_uses?: number;
  expires_at?: string;
}

export interface APIRole {
  id: Snowflake;
  guild_id: Snowflake;
  name: string;
  color: number;
  position: number;
  permissions: string;
  hoist: boolean;
  mentionable: boolean;
  is_everyone: boolean;
  created_at: string;
}

export interface APIBan {
  guild_id: Snowflake;
  user_id: Snowflake;
  banned_by: Snowflake;
  reason?: string;
  banned_at: string;
}

export interface APIPublicUser {
  id: Snowflake;
  username: string;
  display_name: string;
  avatar_color: string;
  avatar_url?: string;
  banner_url?: string;
  bio?: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  bot: boolean;
  created_at: string;
  friendship_state?: 'self' | 'accepted' | 'pending_sent' | 'pending_received' | 'blocked';
  dm_channel_id?: Snowflake;
}

export interface APIDMChannel {
  id: Snowflake;
  type: 'dm' | 'group_dm';
  name: string;
  participants: Snowflake[];
  created_at: string;
}

export interface APIReaction {
  emoji: string;
  count: number;
  me: boolean;
}

export interface APISearchResult {
  message: APIMessage;
  channel: APIChannel;
  author?: APIUser;
}

export interface APINotification {
  id: Snowflake;
  type: string;
  channel_id?: Snowflake;
  channel_name?: string;
  guild_id?: Snowflake;
  guild_name?: string;
  message_id?: Snowflake;
  message_preview?: string;
  actor_id?: Snowflake;
  actor_username?: string;
  actor_display_name?: string;
  actor_avatar_color?: string;
  read_at?: string;
  created_at: string;
}

export interface AuthResponse {
  user: APIUser;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export class APIError extends Error {
  constructor(public status: number, public code: string, public detail: string) {
    super(`${code}: ${detail}`);
  }
}

export const tokenStore = {
  access(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

async function request<T>(
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = tokenStore.access();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401 && !retried) {
    const ok = await tryRefresh();
    if (ok) return request<T>(path, init, true);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new APIError(
      res.status,
      body.error || 'unknown',
      body.detail || res.statusText,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function tryRefresh(): Promise<boolean> {
  const rt = tokenStore.refresh();
  if (!rt) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) {
      tokenStore.clear();
      return false;
    }
    const data: AuthResponse = await res.json();
    tokenStore.set(data.access_token, data.refresh_token);
    return true;
  } catch {
    tokenStore.clear();
    return false;
  }
}

export const api = {
  async register(input: {
    username: string;
    email: string;
    display_name: string;
    password: string;
  }): Promise<AuthResponse> {
    const r = await request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    tokenStore.set(r.access_token, r.refresh_token);
    return r;
  },

  async login(input: { email: string; password: string }): Promise<AuthResponse> {
    const r = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    tokenStore.set(r.access_token, r.refresh_token);
    return r;
  },

  logout() {
    tokenStore.clear();
  },

  me: () => request<APIUser>('/users/me'),
  user: (userId: string) =>
    request<APIPublicUser>(`/users/${userId}`),
  users: {
    user: (userId: string) => request<APIPublicUser>(`/users/${userId}`),
  },
  updateStatus: (status: 'online' | 'idle' | 'dnd' | 'offline') =>
    request<void>('/users/me/status', {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  guilds: {
    list: () => request<APIGuild[]>('/guilds'),
    create: (name: string, iconText?: string, iconColor?: string) =>
      request<APIGuild>('/guilds', {
        method: 'POST',
        body: JSON.stringify({ name, icon_text: iconText, icon_color: iconColor }),
      }),
    channels: (guildId: string) => request<APIChannel[]>(`/guilds/${guildId}/channels`),
    createChannel: (
      guildId: string,
      name: string,
      type: 'text' | 'voice' | 'announcement' | 'forum' | 'stage' | 'category' | 'media' = 'text',
      parentId?: string | null,
    ) =>
      request<APIChannel>('/channels', {
        method: 'POST',
        body: JSON.stringify({ guild_id: guildId, name, type, parent_id: parentId ?? undefined }),
      }),
    members: (guildId: string) => request<APIMember[]>(`/guilds/${guildId}/members`),
    createInvite: (guildId: string, opts: { max_uses?: number; expires_in_sec?: number } = {}) =>
      request<APIInvite>(`/guilds/${guildId}/invites`, {
        method: 'POST',
        body: JSON.stringify(opts),
      }),
    invites: (guildId: string) => request<APIInvite[]>(`/guilds/${guildId}/invites`),

    roles: (guildId: string) => request<APIRole[]>(`/guilds/${guildId}/roles`),
    createRole: (
      guildId: string,
      input: { name: string; color?: number; permissions?: string; hoist?: boolean; mentionable?: boolean },
    ) =>
      request<APIRole>(`/guilds/${guildId}/roles`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    updateRole: (
      guildId: string,
      roleId: string,
      input: Partial<{ name: string; color: number; permissions: string; hoist: boolean; mentionable: boolean; position: number }>,
    ) =>
      request<APIRole>(`/guilds/${guildId}/roles/${roleId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    deleteRole: (guildId: string, roleId: string) =>
      request<void>(`/guilds/${guildId}/roles/${roleId}`, { method: 'DELETE' }),
    assignRole: (guildId: string, userId: string, roleId: string) =>
      request<void>(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, { method: 'PUT' }),
    unassignRole: (guildId: string, userId: string, roleId: string) =>
      request<void>(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, { method: 'DELETE' }),

    kick: (guildId: string, userId: string) =>
      request<void>(`/guilds/${guildId}/members/${userId}`, { method: 'DELETE' }),
    ban: (guildId: string, userId: string, reason?: string) =>
      request<void>(`/guilds/${guildId}/bans/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ reason: reason ?? '' }),
      }),
    unban: (guildId: string, userId: string) =>
      request<void>(`/guilds/${guildId}/bans/${userId}`, { method: 'DELETE' }),
    bans: (guildId: string) => request<APIBan[]>(`/guilds/${guildId}/bans`),
    timeout: (guildId: string, userId: string, durationSec: number) =>
      request<{ timeout_until: string | null }>(`/guilds/${guildId}/members/${userId}/timeout`, {
        method: 'PATCH',
        body: JSON.stringify({ duration_sec: durationSec }),
      }),
  },

  invites: {
    preview: (code: string) => request<APIInvitePreview>(`/invites/${code}`),
    accept: (code: string) => request<APIGuild>(`/invites/${code}/accept`, { method: 'POST' }),
    delete: (code: string) => request<void>(`/invites/${code}`, { method: 'DELETE' }),
  },

  dms: {
    list: () => request<APIDMChannel[]>('/users/me/channels'),
    open: (userId: string) =>
      request<{ channel_id: string }>('/users/me/channels', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      }),
  },

  reactions: {
    list: (messageId: string) => request<APIReaction[]>(`/messages/${messageId}/reactions`),
    add: (messageId: string, emoji: string) =>
      request<void>(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, { method: 'PUT' }),
    remove: (messageId: string, emoji: string) =>
      request<void>(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, { method: 'DELETE' }),
  },

  uploads: {
    presign: (input: { filename: string; content_type: string; size_bytes: number }) =>
      request<{ upload_url: string; public_url: string; key: string; filename: string }>(
        '/uploads/presign',
        { method: 'POST', body: JSON.stringify(input) },
      ),
  },

  notifications: {
    count: () => request<{ unread: number }>('/notifications/count'),
    list: () => request<APINotification[]>('/notifications'),
    markAllRead: () => request<void>('/notifications/read-all', { method: 'POST' }),
  },

  search: {
    messages: (q: string, opts: { guildId?: string; channelId?: string; authorId?: string; limit?: number } = {}) => {
      const p = new URLSearchParams({ q });
      if (opts.guildId) p.set('guild_id', opts.guildId);
      if (opts.channelId) p.set('channel_id', opts.channelId);
      if (opts.authorId) p.set('author_id', opts.authorId);
      if (opts.limit) p.set('limit', String(opts.limit));
      return request<APISearchResult[]>(`/search/messages?${p}`);
    },
  },

  messages: {
    edit: (messageId: string, content: string) =>
      request<APIMessage>(`/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      }),
    delete: (messageId: string) =>
      request<void>(`/messages/${messageId}`, { method: 'DELETE' }),
    pin: (messageId: string) => request<void>(`/messages/${messageId}/pin`, { method: 'PUT' }),
    unpin: (messageId: string) => request<void>(`/messages/${messageId}/pin`, { method: 'DELETE' }),
  },

  events: {
    list: (guildId: string) =>
      request<
        Array<{
          id: Snowflake;
          guild_id: Snowflake;
          channel_id?: Snowflake;
          creator_id: Snowflake;
          name: string;
          description?: string;
          scheduled_start_at: string;
          scheduled_end_at?: string;
          entity_type: 'voice' | 'stage_instance' | 'external';
          entity_location?: string;
          status: 'scheduled' | 'active' | 'completed' | 'canceled';
          image_url?: string;
          subscriber_count: number;
          subscribed: boolean;
        }>
      >(`/guilds/${guildId}/events`),
    create: (
      guildId: string,
      input: {
        name: string;
        description?: string;
        scheduled_start_at: string;
        scheduled_end_at?: string;
        entity_type: 'voice' | 'stage_instance' | 'external';
        channel_id?: string;
        entity_location?: string;
        image_url?: string;
      },
    ) =>
      request<{ id: Snowflake }>(`/guilds/${guildId}/events`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    delete: (eventId: string) => request<void>(`/events/${eventId}`, { method: 'DELETE' }),
    subscribe: (eventId: string) =>
      request<void>(`/events/${eventId}/subscribers/me`, { method: 'PUT' }),
    unsubscribe: (eventId: string) =>
      request<void>(`/events/${eventId}/subscribers/me`, { method: 'DELETE' }),
  },

  sounds: {
    list: (guildId: string) =>
      request<
        Array<{
          id: Snowflake;
          guild_id: Snowflake;
          name: string;
          emoji?: string;
          file_url: string;
          volume: number;
          uploader_id: Snowflake;
          created_at: string;
        }>
      >(`/guilds/${guildId}/sounds`),
    create: (
      guildId: string,
      input: { name: string; emoji?: string; file_url: string; volume?: number },
    ) =>
      request<{ id: Snowflake; file_url: string }>(`/guilds/${guildId}/sounds`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    delete: (soundId: string) => request<void>(`/sounds/${soundId}`, { method: 'DELETE' }),
    play: (soundId: string, channelId: string) =>
      request<void>(`/sounds/${soundId}/play`, {
        method: 'POST',
        body: JSON.stringify({ channel_id: channelId }),
      }),
  },

  stageInstances: {
    create: (input: { channel_id: string; topic: string; privacy_level?: 'guild_only' | 'public' }) =>
      request<{ channel_id: Snowflake; topic: string }>(`/stage-instances`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    get: (channelId: string) =>
      request<{ channel_id: Snowflake; topic: string; started_by: Snowflake; started_at: string }>(
        `/stage-instances/${channelId}`,
      ),
    delete: (channelId: string) =>
      request<void>(`/stage-instances/${channelId}`, { method: 'DELETE' }),
  },

  threads: {
    create: (
      channelId: string,
      input: { name: string; type?: 'public_thread' | 'private_thread'; starter_message_id?: string },
    ) =>
      request<APIChannel>(`/channels/${channelId}/threads`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    list: (channelId: string, archived = false) =>
      request<
        Array<APIChannel & { archived?: boolean; message_count?: number; member_count?: number; creator_id?: string }>
      >(`/channels/${channelId}/threads${archived ? '?archived=true' : ''}`),
    join: (channelId: string) =>
      request<void>(`/channels/${channelId}/thread-members/me`, { method: 'PUT' }),
    leave: (channelId: string) =>
      request<void>(`/channels/${channelId}/thread-members/me`, { method: 'DELETE' }),
  },

  channels: {
    create: (guildId: string, name: string, type = 'text') =>
      request<APIChannel>('/channels', {
        method: 'POST',
        body: JSON.stringify({ guild_id: guildId, name, type }),
      }),
    update: (
      channelId: string,
      patch: {
        name?: string;
        topic?: string;
        nsfw?: boolean;
        rate_limit_sec?: number;
        parent_id?: string | null;
        position?: number;
      },
    ) =>
      request<APIChannel>(`/channels/${channelId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    delete: (channelId: string) =>
      request<void>(`/channels/${channelId}`, { method: 'DELETE' }),
    muteSettings: (
      channelId: string,
      input: {
        notif_level?: 'all' | 'mentions' | 'nothing';
        mute_until_sec?: number;
      },
    ) =>
      request<void>(`/channels/${channelId}/notif-settings`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    upsertOverride: (
      channelId: string,
      input: { target_type: 'role' | 'user'; target_id: string; allow: string; deny: string },
    ) =>
      request<void>(`/channels/${channelId}/overrides`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    listOverrides: (channelId: string) =>
      request<
        Array<{ channel_id: string; target_type: 'role' | 'user'; target_id: string; allow: string; deny: string }>
      >(`/channels/${channelId}/overrides`),
    deleteOverride: (channelId: string, targetType: 'role' | 'user', targetId: string) =>
      request<void>(`/channels/${channelId}/overrides/${targetType}/${targetId}`, {
        method: 'DELETE',
      }),
    pins: (channelId: string) => request<APIMessage[]>(`/channels/${channelId}/pins`),
    messages: (channelId: string, before?: string, limit = 50) => {
      const q = new URLSearchParams();
      if (before) q.set('before', before);
      q.set('limit', String(limit));
      return request<APIMessage[]>(`/channels/${channelId}/messages?${q}`);
    },
    sendMessage: (
      channelId: string,
      content: string,
      attachments?: { url: string; filename: string; content_type: string; size_bytes: number }[],
    ) =>
      request<APIMessage>(`/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, attachments }),
      }),
  },
};
