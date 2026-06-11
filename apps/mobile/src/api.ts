// Sidcord mobil API istemcisi — web api.ts'in hafif RN uyarlaması.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiBase } from './config';

let accessToken: string | null = null;
let refreshToken: string | null = null;

export async function loadTokens() {
  try {
    accessToken = await AsyncStorage.getItem('sidcord_access');
    refreshToken = await AsyncStorage.getItem('sidcord_refresh');
  } catch {}
}

async function saveTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  try {
    await AsyncStorage.setItem('sidcord_access', access);
    await AsyncStorage.setItem('sidcord_refresh', refresh);
  } catch {}
}

export async function clearTokens() {
  accessToken = null;
  refreshToken = null;
  try {
    await AsyncStorage.multiRemove(['sidcord_access', 'sidcord_refresh']);
  } catch {}
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function refresh(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const res = await fetch(apiBase() + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const d = await res.json();
    await saveTokens(d.access_token, d.refresh_token ?? refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function request<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  if (accessToken) headers.Authorization = 'Bearer ' + accessToken;
  const res = await fetch(apiBase() + path, { ...init, headers });
  if (res.status === 401 && !retried && (await refresh())) {
    return request<T>(path, init, true);
  }
  if (!res.ok) {
    let detail = 'İstek başarısız (' + res.status + ')';
    try {
      const e = await res.json();
      detail = e.detail || e.error || detail;
    } catch {}
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// === Tipler (çekirdek) ===
export interface User {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  avatar_url?: string;
  status: string;
}
export interface Guild {
  id: string;
  name: string;
  icon_text?: string;
  icon_color?: string;
  icon_url_v2?: string;
}
export interface Channel {
  id: string;
  guild_id?: string;
  parent_id?: string;
  type: string;
  name: string;
  position: number;
}
export interface Message {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  created_at: string;
  system?: boolean;
  webhook_username?: string;
  attachments?: { id: string; url: string; filename: string; content_type?: string }[];
}
export interface DMChannel {
  id: string;
  type: 'dm' | 'group_dm';
  name: string;
  participants: string[];
}

export const api = {
  async login(email: string, password: string) {
    const d = await request<{ access_token: string; refresh_token: string; user: User }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    );
    await saveTokens(d.access_token, d.refresh_token);
    return d;
  },
  async register(email: string, password: string, username: string, displayName: string) {
    const d = await request<{ access_token: string; refresh_token: string; user: User }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ email, password, username, display_name: displayName }),
      },
    );
    await saveTokens(d.access_token, d.refresh_token);
    return d;
  },
  me: () => request<User>('/users/me'),
  user: (id: string) => request<User>('/users/' + id),
  guilds: () => request<Guild[]>('/guilds'),
  channels: (guildId: string) => request<Channel[]>(`/guilds/${guildId}/channels`),
  messages: (channelId: string, before?: string) =>
    request<Message[]>(
      `/channels/${channelId}/messages?limit=50` + (before ? `&before=${before}` : ''),
    ),
  sendMessage: (channelId: string, content: string) =>
    request<Message>(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  dms: () => request<DMChannel[]>('/users/me/channels'),
  ack: (channelId: string) =>
    request<void>(`/channels/${channelId}/ack`, { method: 'POST', body: '{}' }),
};
