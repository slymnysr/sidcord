import { useEffect, useRef, useState } from 'react';
import { Hash, Smile, Pencil, Trash2, Check, X } from 'lucide-react';
import {
  useAppDispatch,
  useAppSelector,
  fetchReactions,
  toggleReactionThunk,
  updateMessage,
  removeMessage,
} from '../store';
import { api, type APIReaction, type APIAttachment } from '../api';
import { Markdown } from '../markdown';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '😢', '🔥', '👀'];

export function MessageList() {
  const guildId = useAppSelector((s) => s.guilds.selectedId);
  const channelId = useAppSelector((s) => s.channels.selectedId);
  const mode = useAppSelector((s) => s.ui.mode);
  const channel = useAppSelector((s) =>
    mode === 'dm' && channelId
      ? { id: channelId, name: 'DM', type: 'text' as const, guild_id: '', position: 0, nsfw: false, rate_limit_sec: 0, created_at: '' }
      : guildId && channelId
        ? s.channels.byGuild[guildId]?.find((c) => c.id === channelId)
        : null,
  );
  const list = useAppSelector((s) => (channelId ? s.messages.byChannel[channelId] ?? [] : []));
  const users = useAppSelector((s) => s.users.byId);
  const me = useAppSelector((s) => s.auth.user);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [list.length, channelId]);

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-tertiary">
        Bir kanal seç
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
      <div className="mb-6 pb-6 border-b border-line">
        <div className="w-14 h-14 rounded-2xl bg-brand-500/15 text-brand-500 flex items-center justify-center mb-3">
          <Hash size={28} strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-bold text-ink-primary tracking-tight">#{channel.name}</h1>
        <p className="text-ink-secondary text-sm mt-1">
          Bu, <span className="text-ink-primary font-medium">#{channel.name}</span> kanalının başlangıcı.
        </p>
      </div>

      {list.length === 0 && (
        <div className="text-center text-ink-tertiary py-16">
          <p className="text-sm">Sessizlik... İlk mesajı sen yaz.</p>
        </div>
      )}

      <TypingIndicator />
      <ul className="space-y-3">
        {list.map((m, i) => {
          const prev = list[i - 1];
          const author = users[m.author_id] ?? (m.author_id === me?.id ? me : null);
          const prevTs = prev ? new Date(prev.created_at).getTime() : 0;
          const curTs = new Date(m.created_at).getTime();
          const grouped = !!prev && prev.author_id === m.author_id && curTs - prevTs < 5 * 60 * 1000;
          return (
            <MessageItem
              key={m.id}
              messageId={m.id}
              authorId={m.author_id}
              authorName={author?.display_name ?? 'Bilinmeyen'}
              authorColor={author?.avatar_color ?? '#6B7280'}
              isBot={!!author?.bot}
              ts={curTs}
              editedAt={m.edited_at}
              content={m.content}
              attachments={m.attachments ?? []}
              grouped={grouped}
            />
          );
        })}
      </ul>
    </div>
  );
}

function TypingIndicator() {
  const channelId = useAppSelector((s) => s.channels.selectedId);
  const me = useAppSelector((s) => s.auth.user);
  const users = useAppSelector((s) => s.users.byId);
  const typing = useAppSelector((s) => (channelId ? s.typing.byChannel[channelId] ?? [] : []));

  const others = typing.filter((t) => t.userId !== me?.id);
  if (others.length === 0) return null;

  const names = others
    .slice(0, 3)
    .map((t) => users[t.userId]?.display_name ?? 'biri')
    .join(', ');

  return (
    <div className="text-xs text-ink-tertiary px-2 mb-1 italic">
      <span className="inline-flex items-center gap-1">
        <span className="flex gap-0.5">
          <span className="w-1 h-1 bg-ink-tertiary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1 h-1 bg-ink-tertiary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1 h-1 bg-ink-tertiary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </span>
        {names} {others.length > 1 ? 'yazıyorlar...' : 'yazıyor...'}
      </span>
    </div>
  );
}

function MessageItem({
  messageId,
  authorId,
  authorName,
  authorColor,
  isBot,
  ts,
  editedAt,
  content,
  attachments,
  grouped,
}: {
  messageId: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  isBot: boolean;
  ts: number;
  editedAt?: string;
  content: string;
  attachments: APIAttachment[];
  grouped: boolean;
}) {
  const dispatch = useAppDispatch();
  const me = useAppSelector((s) => s.auth.user);
  const channelId = useAppSelector((s) => s.channels.selectedId);
  const reactions = useAppSelector((s) => s.reactions.byMessage[messageId] ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);
  const isMine = me?.id === authorId;

  useEffect(() => {
    if (reactions.length === 0) dispatch(fetchReactions(messageId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId]);

  function toggle(emoji: string) {
    const cur = reactions.find((r: APIReaction) => r.emoji === emoji);
    dispatch(toggleReactionThunk({ messageId, emoji, isAdding: !cur?.me }));
  }

  async function saveEdit() {
    const v = editValue.trim();
    if (!v || v === content) {
      setEditing(false);
      return;
    }
    try {
      const updated = await api.messages.edit(messageId, v);
      dispatch(updateMessage(updated));
      setEditing(false);
    } catch (e) {
      console.error('edit', e);
    }
  }

  async function doDelete() {
    if (!channelId) return;
    if (!confirm('Mesajı silmek istiyor musun?')) return;
    try {
      await api.messages.delete(messageId);
      dispatch(removeMessage({ channel_id: channelId, id: messageId }));
    } catch (e) {
      console.error('delete', e);
    }
  }

  return (
    <li className="flex gap-3 group relative px-2 -mx-2 py-1 hover:bg-surface-1/40 rounded">
      {!grouped ? (
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
          style={{ backgroundColor: authorColor }}
        >
          {authorName.slice(0, 1).toUpperCase()}
        </div>
      ) : (
        <div className="w-10 shrink-0 text-[10px] text-transparent group-hover:text-ink-tertiary text-right pr-2 leading-7 select-none">
          {formatTime(ts)}
        </div>
      )}

      <div className="flex-1 min-w-0">
        {!grouped && (
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-semibold text-ink-primary text-[15px]">{authorName}</span>
            {isBot && (
              <span className="bg-brand-500/15 text-brand-500 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                BOT
              </span>
            )}
            <span className="text-xs text-ink-tertiary">{formatFull(ts)}</span>
          </div>
        )}
        {editing ? (
          <div className="flex items-center gap-2">
            <textarea
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  saveEdit();
                } else if (e.key === 'Escape') {
                  setEditing(false);
                  setEditValue(content);
                }
              }}
              rows={1}
              className="flex-1 bg-surface-2 border border-line rounded-lg px-3 py-1.5 text-ink-primary outline-none focus:border-brand-500/50 max-h-40 resize-none"
            />
            <button
              onClick={saveEdit}
              title="Kaydet"
              className="w-7 h-7 rounded-md bg-brand-500 hover:bg-brand-400 text-white flex items-center justify-center"
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setEditValue(content);
              }}
              title="İptal"
              className="w-7 h-7 rounded-md bg-surface-3 hover:bg-accent-500 hover:text-white text-ink-secondary flex items-center justify-center"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="text-ink-primary leading-relaxed break-words">
            <Markdown content={content} />
            {editedAt && (
              <span className="text-[10px] text-ink-tertiary ml-1" title={new Date(editedAt).toLocaleString('tr-TR')}>
                (düzenlendi)
              </span>
            )}
          </div>
        )}
        {attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {attachments.map((a) => (
              <AttachmentView key={a.id} a={a} />
            ))}
          </div>
        )}
        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {reactions.map((r: APIReaction) => (
              <button
                key={r.emoji}
                onClick={() => toggle(r.emoji)}
                className={
                  'px-2 py-0.5 rounded-full text-xs flex items-center gap-1 border transition-colors ' +
                  (r.me
                    ? 'bg-brand-500/15 border-brand-500/50 text-brand-500'
                    : 'bg-surface-2 border-line text-ink-secondary hover:bg-surface-3')
                }
              >
                <span>{r.emoji}</span>
                <span className="font-semibold">{r.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="opacity-0 group-hover:opacity-100 absolute right-2 top-1 flex gap-0.5 bg-surface-2 border border-line rounded-md transition-opacity">
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="hover:bg-surface-3 w-7 h-7 flex items-center justify-center text-ink-secondary hover:text-ink-primary rounded"
          title="Tepki ekle"
        >
          <Smile size={14} />
        </button>
        {isMine && (
          <button
            onClick={() => setEditing(true)}
            className="hover:bg-surface-3 w-7 h-7 flex items-center justify-center text-ink-secondary hover:text-brand-500 rounded"
            title="Düzenle"
          >
            <Pencil size={14} />
          </button>
        )}
        {isMine && (
          <button
            onClick={doDelete}
            className="hover:bg-surface-3 w-7 h-7 flex items-center justify-center text-ink-secondary hover:text-accent-500 rounded"
            title="Sil"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {pickerOpen && (
        <div className="absolute right-2 top-9 bg-surface-1 border border-line rounded-lg shadow-2xl p-1 flex gap-0.5 z-10">
          {QUICK_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => {
                toggle(e);
                setPickerOpen(false);
              }}
              className="w-8 h-8 hover:bg-surface-2 rounded flex items-center justify-center text-lg"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

function AttachmentView({ a }: { a: APIAttachment }) {
  const ct = a.content_type ?? '';
  if (ct.startsWith('image/')) {
    return (
      <a href={a.url} target="_blank" rel="noreferrer" className="block max-w-xs">
        <img src={a.url} alt={a.filename} className="rounded-lg max-h-80 border border-line" />
      </a>
    );
  }
  if (ct.startsWith('video/')) {
    return (
      <video controls src={a.url} className="rounded-lg max-h-80 max-w-md border border-line" />
    );
  }
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 bg-surface-2 hover:bg-surface-3 border border-line rounded-lg px-3 py-2 text-sm transition-colors"
    >
      <span className="text-ink-secondary">📎</span>
      <span className="text-ink-primary font-medium truncate max-w-[200px]">{a.filename}</span>
      <span className="text-ink-tertiary text-xs">{formatBytes(a.size_bytes)}</span>
    </a>
  );
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function formatFull(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return `Bugün ${formatTime(ts)}`;
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return `Dün ${formatTime(ts)}`;
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

