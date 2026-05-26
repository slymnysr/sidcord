// Frontend permission bitmask sabitleri (backend ile aynı)
// 64-bit bitmask — JS Number 53-bit ile sınırlı, BigInt kullanıyoruz
export const PERM = {
  CREATE_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  ADD_REACTIONS: 1n << 6n,
  VIEW_AUDIT_LOG: 1n << 7n,
  PRIORITY_SPEAKER: 1n << 8n,
  STREAM: 1n << 9n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  SEND_TTS: 1n << 12n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_HISTORY: 1n << 16n,
  MENTION_EVERYONE: 1n << 17n,
  USE_EXTERNAL_EMOJIS: 1n << 18n,
  VIEW_INSIGHTS: 1n << 19n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  DEAFEN_MEMBERS: 1n << 23n,
  MOVE_MEMBERS: 1n << 24n,
  USE_VAD: 1n << 25n,
  CHANGE_NICKNAME: 1n << 26n,
  MANAGE_NICKNAMES: 1n << 27n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_WEBHOOKS: 1n << 29n,
  MANAGE_EMOJIS: 1n << 30n,
  USE_APP_COMMANDS: 1n << 31n,
  MODERATE_MEMBERS: 1n << 39n,
} as const;

export const PERM_LABELS: Record<string, string> = {
  CREATE_INVITE: 'Davet Oluştur',
  KICK_MEMBERS: 'Üye At',
  BAN_MEMBERS: 'Üye Banla',
  ADMINISTRATOR: 'Yönetici (her şey)',
  MANAGE_CHANNELS: 'Kanalları Yönet',
  MANAGE_GUILD: 'Sunucuyu Yönet',
  ADD_REACTIONS: 'Tepki Ekle',
  VIEW_AUDIT_LOG: 'Denetim Kaydı',
  VIEW_CHANNEL: 'Kanal Gör',
  SEND_MESSAGES: 'Mesaj Gönder',
  MANAGE_MESSAGES: 'Mesajları Yönet',
  EMBED_LINKS: 'Bağlantı Gömme',
  ATTACH_FILES: 'Dosya Ekle',
  READ_HISTORY: 'Mesaj Geçmişi Oku',
  MENTION_EVERYONE: '@everyone Bahset',
  CONNECT: 'Sesli Kanala Katıl',
  SPEAK: 'Konuş',
  MUTE_MEMBERS: 'Üyeleri Sustur',
  DEAFEN_MEMBERS: 'Üyeleri Sağırlaştır',
  MOVE_MEMBERS: 'Üyeleri Taşı',
  USE_VAD: 'Ses Aktivasyonu',
  CHANGE_NICKNAME: 'Takma Ad Değiştir',
  MANAGE_NICKNAMES: 'Takma Adları Yönet',
  MANAGE_ROLES: 'Rolleri Yönet',
  MANAGE_WEBHOOKS: 'Webhook Yönet',
  MANAGE_EMOJIS: 'Emojileri Yönet',
  MODERATE_MEMBERS: 'Timeout Uygula',
};

export function has(haveStr: string, want: bigint): boolean {
  const have = BigInt(haveStr || '0');
  if ((have & PERM.ADMINISTRATOR) !== 0n) return true;
  return (have & want) === want;
}

export function toggle(haveStr: string, perm: bigint): string {
  const have = BigInt(haveStr || '0');
  const next = (have & perm) !== 0n ? have & ~perm : have | perm;
  return next.toString();
}
