import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../api';
import { useAppSelector } from '../store';

// Discord paritesi: kategorilere ayrılmış emoji seti
const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  {
    name: 'Sık Kullanılan',
    emojis: ['👍', '❤️', '😂', '🎉', '😮', '😢', '🔥', '👀', '💯', '🙏', '✨', '👏'],
  },
  {
    name: 'İfadeler',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇',
      '🥰','😍','🤩','😘','😗','😚','😙','😋','😛','😜','🤪','😝','🤑',
      '🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬',
      '🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵',
      '🥶','🥴','😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁','☹️',
      '😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱',
      '😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿',
    ],
  },
  {
    name: 'İnsan & Vücut',
    emojis: [
      '👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙',
      '👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏',
      '🙌','👐','🤲','🤝','🙏','💪','🦵','🦶','👂','🦻','👃','🧠','🦷',
      '🦴','👀','👁️','👅','👄','💋','🩸',
    ],
  },
  {
    name: 'Hayvan & Doğa',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷',
      '🐸','🐵','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴',
      '🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦗','🕷️','🦂','🐢','🐍','🦎',
      '🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋',
      '🦈','🌳','🌲','🌴','🌵','🌷','🌻','🌹','🌸','💐','🍄','🌿','🍀',
    ],
  },
  {
    name: 'Yemek & İçecek',
    emojis: [
      '🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭',
      '🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🌽','🥕','🧄',
      '🧅','🥔','🍠','🥐','🍞','🥖','🧀','🥚','🍳','🧈','🥞','🧇','🥓',
      '🥩','🍗','🍖','🌭','🍔','🍟','🍕','🥪','🌮','🌯','🥗','🍝','🍜',
      '🍲','🥘','🍣','🍱','🍤','🍙','🍚','🍘','🍢','🍡','🍧','🍨','🍦',
      '🥧','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯',
      '🥛','☕','🍵','🍶','🍺','🍷','🍸','🍹','🍾','🍴','🥄','🔪',
    ],
  },
  {
    name: 'Aktiviteler',
    emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸',
      '🏒','🏑','🥍','🏏','🥅','⛳','🪁','🏹','🎣','🥊','🥋','🎽','🛹',
      '🛼','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤼','🤸','⛹️','🤺',
      '🤾','🏌️','🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚵','🚴','🏆','🥇',
      '🥈','🥉','🏅','🎖️','🏵️','🎗️','🎫','🎟️','🎪','🤹','🎭','🩰','🎨',
      '🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🪕','🎻','🎲','♟️',
      '🎯','🎳','🎮','🎰','🧩',
    ],
  },
  {
    name: 'Nesneler',
    emojis: [
      '💎','🔔','🔕','💯','🆗','✅','❌','⭕','⛔','🚫','🆘','🚷','🔞',
      '⚠️','📛','🆕','🆙','🆒','🆓','🆗','🆘','🅰️','🅱️','🆎','🅾️','🆑',
      '💸','💰','💵','💴','💶','💷','💳','💎','⚖️','🔧','🔨','⚒️','🛠️',
      '⛏️','🔩','⚙️','⛓️','🔫','💣','🔪','🗡️','⚔️','🛡️','🚬','⚰️','⚱️',
      '🏺','🔮','📿','💈','⚗️','🔭','🔬','🕳️','💊','💉','🩹','🩺','🚪',
    ],
  },
  {
    name: 'Semboller',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞',
      '💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯',
      '🕎','☯️','☦️','🛐','⚛️','♈','♉','♊','♋','♌','♍','♎','♏','♐',
      '♑','♒','♓','⛎','🆔','♻️','⚜️','🔱','📛','🔰','⭕','✅','☑️','✔️',
      '❌','❎','➕','➖','➗','✖️','♾️','💲','💱','™️','©️','®️','〰️',
    ],
  },
];

interface Props {
  onPick: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onPick, onClose }: Props) {
  const guildId = useAppSelector((s) => s.guilds.selectedId);
  const [q, setQ] = useState('');
  const [customEmojis, setCustomEmojis] = useState<
    Awaited<ReturnType<typeof api.emojis.list>>
  >([]);

  useEffect(() => {
    if (!guildId) return;
    api.emojis.list(guildId).then(setCustomEmojis).catch(() => {});
  }, [guildId]);

  const visibleCategories = q.trim()
    ? EMOJI_CATEGORIES.map((c) => ({
        ...c,
        emojis: c.emojis.filter(() => false), // basit isim arama yok, sadece custom için
      })).filter(() => false)
    : EMOJI_CATEGORIES;

  const filteredCustom = q.trim()
    ? customEmojis.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()))
    : customEmojis;

  return (
    <div className="w-80 max-h-[400px] flex flex-col bg-surface-1 border border-line rounded-xl shadow-2xl overflow-hidden">
      <div className="p-2 border-b border-line">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-tertiary" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Emoji ara..."
            className="w-full bg-surface-2 border border-line focus:border-brand-500/50 focus:outline-none rounded-md pl-8 pr-2 py-1.5 text-sm text-ink-primary placeholder:text-ink-tertiary"
          />
        </div>
      </div>
      <div className="overflow-y-auto flex-1 p-2">
        {filteredCustom.length > 0 && (
          <div className="mb-2">
            <div className="text-[10px] font-bold uppercase text-ink-tertiary tracking-wider px-1 mb-1">
              Bu Sunucu
            </div>
            <div className="grid grid-cols-8 gap-1">
              {filteredCustom.map((e) => (
                <button
                  key={e.id}
                  onClick={() => onPick(`:${e.name}:`)}
                  title={`:${e.name}:`}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-2"
                >
                  <img src={e.url} alt={e.name} className="w-6 h-6 object-contain" />
                </button>
              ))}
            </div>
          </div>
        )}
        {visibleCategories.map((cat) => (
          <div key={cat.name} className="mb-2">
            <div className="text-[10px] font-bold uppercase text-ink-tertiary tracking-wider px-1 mb-1">
              {cat.name}
            </div>
            <div className="grid grid-cols-8 gap-0.5">
              {cat.emojis.map((e) => (
                <button
                  key={e}
                  onClick={() => onPick(e)}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-2 text-lg"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button onClick={onClose} className="hidden" />
    </div>
  );
}
