export type Status = 'online' | 'idle' | 'dnd' | 'offline';

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  status: Status;
  bot?: boolean;
}

export interface Guild {
  id: string;
  name: string;
  iconText: string;
  iconColor: string;
  memberCount: number;
}

export type ChannelType = 'text' | 'voice' | 'announcement' | 'forum' | 'stage';

export interface Channel {
  id: string;
  guildId: string;
  name: string;
  type: ChannelType;
  category: string;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  ts: number;
}
