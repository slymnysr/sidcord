// Tam Unicode emoji seti (1900+) — unicode-emoji-json'dan lazy yüklenir,
// ana bundle'a girmez (picker ilk açıldığında ~100KB gzip iner ve cache'lenir).
export interface EmojiEntry {
  e: string; // emoji karakteri
  n: string; // İngilizce adı (arama + tooltip)
  s: boolean; // ten rengi destekliyor mu
}

export interface EmojiGroup {
  name: string;
  emojis: EmojiEntry[];
}

const TR_GROUP_NAMES: Record<string, string> = {
  'Smileys & Emotion': 'İfadeler',
  'People & Body': 'İnsan & Vücut',
  'Animals & Nature': 'Hayvan & Doğa',
  'Food & Drink': 'Yemek & İçecek',
  'Travel & Places': 'Seyahat & Yerler',
  Activities: 'Aktiviteler',
  Objects: 'Nesneler',
  Symbols: 'Semboller',
  Flags: 'Bayraklar',
};

let cache: Promise<EmojiGroup[]> | null = null;

export function loadEmojiGroups(): Promise<EmojiGroup[]> {
  if (!cache) {
    cache = import('unicode-emoji-json/data-by-group.json').then((m) => {
      const raw = (m.default ?? m) as Array<{
        name: string;
        emojis: Array<{ emoji: string; name: string; skin_tone_support: boolean }>;
      }>;
      return raw.map((g) => ({
        name: TR_GROUP_NAMES[g.name] ?? g.name,
        emojis: g.emojis.map((x) => ({ e: x.emoji, n: x.name, s: !!x.skin_tone_support })),
      }));
    });
    cache.catch(() => {
      cache = null; // hata olursa sonraki açılışta yeniden dene
    });
  }
  return cache;
}
