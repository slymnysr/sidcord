import { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, X, FileIcon, Smile, AtSign, Sticker, Mic, Square } from 'lucide-react';
import { api } from '../api';
import { useAppDispatch, useAppSelector, setReplyTo } from '../store';
import { sendTyping } from '../gateway';
import { EmojiPicker } from './EmojiPicker';
import { MentionPicker } from './MentionPicker';
import { MarkdownToolbar } from './MarkdownToolbar';

interface PendingFile {
  id: string;
  file: File;
  uploading: boolean;
  publicUrl?: string;
  error?: string;
}

export function MessageInput() {
  const guildId = useAppSelector((s) => s.guilds.selectedId);
  const channelId = useAppSelector((s) => s.channels.selectedId);
  const mode = useAppSelector((s) => s.ui.mode);
  const channel = useAppSelector((s) =>
    mode === 'dm' && channelId
      ? { id: channelId, name: 'DM', type: 'text' as const }
      : guildId && channelId
        ? s.channels.byGuild[guildId]?.find((c) => c.id === channelId)
        : null,
  );
  const dispatch = useAppDispatch();
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [stickers, setStickers] = useState<Awaited<ReturnType<typeof api.stickers.list>>>([]);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartRef = useRef<number>(0);
  const [recordingDur, setRecordingDur] = useState(0);
  const [mention, setMention] = useState<{ type: '@' | '#' | ':' | '/'; q: string; start: number } | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const lastTyping = useRef(0);
  const replyTo = useAppSelector((s) => s.ui.replyTo);
  const replyAuthor = useAppSelector((s) =>
    replyTo && channelId
      ? s.messages.byChannel[channelId]?.find((m) => m.id === replyTo)?.author_id
      : null,
  );
  const replyAuthorUser = useAppSelector((s) => (replyAuthor ? s.users.byId[replyAuthor] : null));

  useEffect(() => {
    setValue('');
    setFiles([]);
    ref.current?.focus();
  }, [channelId]);

  useEffect(() => {
    if (!guildId || !stickerOpen) return;
    api.stickers.list(guildId).then(setStickers).catch(() => {});
  }, [stickerOpen, guildId]);

  async function sendSticker(url: string, name: string) {
    if (!channelId) return;
    setStickerOpen(false);
    try {
      const msg = await api.channels.sendMessage(channelId, ' ', [
        { url, filename: name + '.png', content_type: 'image/png', size_bytes: 0 },
      ]);
      dispatch({ type: 'messages/send/fulfilled', payload: msg, meta: { arg: { channelId, content: ' ' } } });
    } catch (e) {
      console.warn('sticker send', e);
    }
  }

  if (!channel) return null;

  async function uploadFile(file: File): Promise<PendingFile> {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const pending: PendingFile = { id, file, uploading: true };
    setFiles((fs) => [...fs, pending]);
    try {
      const presign = await api.uploads.presign({
        filename: file.name,
        content_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
      });
      const putRes = await fetch(presign.upload_url, {
        method: 'PUT',
        body: file,
        headers: file.type ? { 'Content-Type': file.type } : undefined,
      });
      if (!putRes.ok) throw new Error('upload failed');
      const done: PendingFile = { id, file, uploading: false, publicUrl: presign.public_url };
      setFiles((fs) => fs.map((f) => (f.id === id ? done : f)));
      return done;
    } catch (e: any) {
      const failed: PendingFile = { id, file, uploading: false, error: e?.message || 'upload err' };
      setFiles((fs) => fs.map((f) => (f.id === id ? failed : f)));
      return failed;
    }
  }

  function onPickFiles(list: FileList | null) {
    if (!list) return;
    for (const f of Array.from(list)) {
      if (f.size > 100 * 1024 * 1024) continue; // 100MB
      uploadFile(f);
    }
  }

  function removeFile(id: string) {
    setFiles((fs) => fs.filter((f) => f.id !== id));
  }

  async function submit() {
    const v = value.trim();
    if (!v && files.length === 0) return;
    if (!channelId) return;
    if (files.some((f) => f.uploading)) return; // bekle

    // Slash command algıla: /komut formatı
    const slashMatch = v.match(/^\/([a-z0-9_-]+)\s*$/i);
    if (slashMatch) {
      try {
        await api.commands.run(channelId, slashMatch[1]);
        setValue('');
        return;
      } catch (e: any) {
        // 404 → tanımlı değil, normal mesaj olarak devam et
      }
    }

    setSending(true);
    const okFiles = files.filter((f) => f.publicUrl);
    setValue('');
    setFiles([]);
    try {
      const attachments = okFiles.map((f) => ({
        url: f.publicUrl!,
        filename: f.file.name,
        content_type: f.file.type,
        size_bytes: f.file.size,
      }));
      const msg = await fetch(`/api/v1/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('sidcord_access'),
        },
        body: JSON.stringify({
          content: v || ' ',
          attachments: attachments.length ? attachments : undefined,
          replied_to_id: replyTo ?? undefined,
        }),
      }).then((r) => r.json());
      if (msg && msg.id) {
        dispatch({ type: 'messages/send/fulfilled', payload: msg, meta: { arg: { channelId, content: v } } });
      }
      dispatch(setReplyTo(null));
    } catch {
      setValue(v);
      setFiles(okFiles);
    } finally {
      setSending(false);
      ref.current?.focus();
    }
  }

  function insertAtCaret(text: string) {
    const el = ref.current;
    if (!el) {
      setValue((v) => v + text);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setValue(v);
    const now = Date.now();
    if (guildId && channelId && now - lastTyping.current > 4000) {
      lastTyping.current = now;
      sendTyping(guildId, channelId);
    }
    // @username, #channel, :emoji, /slash için trigger algıla
    const pos = e.target.selectionStart ?? v.length;
    const before = v.slice(0, pos);
    const m = before.match(/(^|\s)([@#:/])([\wçğıöşü-]{0,32})$/i);
    if (m) {
      setMention({
        type: m[2] as any,
        q: m[3] ?? '',
        start: pos - (m[3]?.length ?? 0) - 1,
      });
    } else {
      setMention(null);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        if (blob.size < 1000) return; // çok kısa
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        const pending = await uploadFile(file);
        if (pending.publicUrl && channelId) {
          await api.channels.sendMessage(
            channelId,
            ' ',
            [
              {
                url: pending.publicUrl,
                filename: file.name,
                content_type: file.type,
                size_bytes: file.size,
              },
            ],
          );
          setFiles((fs) => fs.filter((f) => f.id !== pending.id));
        }
      };
      rec.start();
      recorderRef.current = rec;
      recordingStartRef.current = Date.now();
      setRecording(true);
      const interval = setInterval(() => {
        if (!recorderRef.current) {
          clearInterval(interval);
          return;
        }
        setRecordingDur(Math.floor((Date.now() - recordingStartRef.current) / 1000));
      }, 500);
    } catch (e) {
      console.warn('recording error', e);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
    setRecordingDur(0);
  }

  // Ctrl+V image paste — clipboard'tan resim yapıştır
  function onPaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          uploadFile(file);
        }
      }
    }
  }

  function pickMention(replacement: string) {
    if (!mention) return;
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const before = value.slice(0, mention.start);
    const after = value.slice(caret);
    const next = before + replacement + ' ' + after;
    setValue(next);
    setMention(null);
    requestAnimationFrame(() => {
      if (el) {
        const pos = (before + replacement + ' ').length;
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  }

  return (
    <div
      className="px-6 pb-6 pt-2"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onPickFiles(e.dataTransfer.files);
      }}
    >
      {replyTo && (
        <div className="bg-surface-2 border border-line border-b-0 rounded-t-xl px-4 py-2 flex items-center justify-between text-xs">
          <span className="text-ink-secondary truncate">
            <span className="text-ink-tertiary">Yanıtlanan: </span>
            <span className="text-brand-500 font-semibold">
              @{replyAuthorUser?.display_name ?? '…'}
            </span>
          </span>
          <button
            type="button"
            onClick={() => dispatch(setReplyTo(null))}
            className="text-ink-tertiary hover:text-accent-500"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div
        className={
          'bg-surface-2 border transition-colors ' +
          (replyTo ? 'rounded-b-2xl rounded-t-none border-t-0' : 'rounded-2xl') +
          ' ' +
          (dragOver
            ? 'border-brand-500 shadow-glow'
            : 'border-line focus-within:border-brand-500/50 focus-within:shadow-glow')
        }
      >
        <MarkdownToolbar textarea={ref.current} onChange={setValue} />
        {files.length > 0 && (
          <div className="px-4 pt-3 flex flex-wrap gap-2 border-b border-line pb-3">
            {files.map((f) => (
              <FilePreview key={f.id} file={f} onRemove={() => removeFile(f.id)} />
            ))}
          </div>
        )}
        {mention && (
          <MentionPicker
            type={mention.type}
            query={mention.q}
            onPick={pickMention}
            onClose={() => setMention(null)}
          />
        )}
        <div className="flex items-end px-4 py-3 gap-2 relative">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="text-ink-secondary hover:text-brand-500 transition-colors shrink-0"
            title="Dosya ekle"
          >
            <Paperclip size={20} />
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(e) => onPickFiles(e.target.files)}
          />
          <textarea
            ref={ref}
            value={value}
            onChange={handleInputChange}
            onPaste={onPaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !mention) {
                e.preventDefault();
                submit();
              }
              if (e.key === 'Escape' && replyTo) {
                dispatch(setReplyTo(null));
              }
            }}
            placeholder={
              replyTo
                ? `Yanıtla #${channel.name}...`
                : `#${channel.name} kanalına yaz...`
            }
            rows={1}
            disabled={sending}
            className="flex-1 bg-transparent text-ink-primary placeholder:text-ink-tertiary outline-none resize-none max-h-40 text-[15px] leading-snug py-1"
          />
          <button
            type="button"
            onClick={() => {
              if (ref.current) {
                const el = ref.current;
                const before = value.slice(0, el.selectionStart ?? value.length);
                if (!before.endsWith('@') && !before.endsWith(' @') && before !== '') {
                  insertAtCaret(before.endsWith(' ') || before === '' ? '@' : ' @');
                } else if (before === '') {
                  insertAtCaret('@');
                }
              }
            }}
            className="text-ink-secondary hover:text-brand-500 transition-colors shrink-0"
            title="Birini bahset"
          >
            <AtSign size={18} />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setStickerOpen((v) => !v)}
              className="text-ink-secondary hover:text-brand-500 transition-colors shrink-0"
              title="Sticker"
            >
              <Sticker size={20} />
            </button>
            {stickerOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setStickerOpen(false)} />
                <div className="absolute bottom-9 right-0 z-20 w-72 max-h-[400px] bg-surface-1 border border-line rounded-xl shadow-2xl p-3 overflow-y-auto">
                  <div className="text-[10px] font-bold uppercase text-ink-tertiary tracking-wider mb-2">
                    Bu Sunucu — {stickers.length}
                  </div>
                  {stickers.length === 0 ? (
                    <p className="text-xs text-ink-tertiary py-6 text-center">
                      Henüz sticker yok. Sunucu Ayarları &gt; Etiketler'den ekle.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {stickers.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => sendSticker(s.url, s.name)}
                          title={s.name}
                          className="aspect-square bg-surface-2 hover:bg-surface-3 rounded-lg p-2 flex flex-col items-center gap-1"
                        >
                          <img src={s.url} alt={s.name} className="w-14 h-14 object-contain" />
                          <span className="text-[10px] truncate w-full text-center text-ink-secondary">
                            {s.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setEmojiOpen((v) => !v)}
              className="text-ink-secondary hover:text-brand-500 transition-colors shrink-0"
              title="Emoji"
            >
              <Smile size={20} />
            </button>
            {emojiOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setEmojiOpen(false)} />
                <div className="absolute bottom-9 right-0 z-20">
                  <EmojiPicker
                    onPick={(e) => {
                      insertAtCaret(e);
                      // Sticky picker — Discord davranışı, kapatma yok
                    }}
                    onClose={() => setEmojiOpen(false)}
                  />
                </div>
              </>
            )}
          </div>
          {recording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="h-9 px-3 rounded-xl bg-accent-500 hover:bg-accent-600 text-white flex items-center gap-2 transition-colors shrink-0 animate-pulse"
              title="Kaydı durdur ve gönder"
            >
              <Square size={14} />
              <span className="text-xs font-mono">{Math.floor(recordingDur / 60)}:{String(recordingDur % 60).padStart(2, '0')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="text-ink-secondary hover:text-brand-500 transition-colors shrink-0"
              title="Sesli mesaj"
            >
              <Mic size={20} />
            </button>
          )}
          <button
            onClick={submit}
            disabled={(!value.trim() && files.length === 0) || sending || files.some((f) => f.uploading)}
            className="w-9 h-9 rounded-xl bg-brand-500 disabled:bg-surface-3 disabled:text-ink-tertiary text-white flex items-center justify-center hover:bg-brand-400 disabled:hover:bg-surface-3 transition-colors shrink-0"
            title="Gönder"
          >
            <Send size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
      <div className="text-[11px] text-ink-tertiary mt-2 px-1">
        <kbd className="px-1.5 py-0.5 bg-surface-2 rounded text-[10px] text-ink-secondary mr-1">Enter</kbd>
        gönder ·
        <kbd className="px-1.5 py-0.5 bg-surface-2 rounded text-[10px] text-ink-secondary mx-1">Shift</kbd>+
        <kbd className="px-1.5 py-0.5 bg-surface-2 rounded text-[10px] text-ink-secondary mx-1">Enter</kbd>
        yeni satır · sürükle bırak ile dosya ekle
      </div>
    </div>
  );
}

function FilePreview({ file, onRemove }: { file: PendingFile; onRemove: () => void }) {
  const isImage = file.file.type.startsWith('image/');
  const preview = isImage ? URL.createObjectURL(file.file) : null;
  return (
    <div className="relative bg-surface-3 rounded-lg border border-line p-2 max-w-[220px]">
      <button
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-accent-500 text-white flex items-center justify-center"
        title="Kaldır"
      >
        <X size={12} />
      </button>
      {preview ? (
        <img src={preview} alt={file.file.name} className="w-32 h-32 object-cover rounded" />
      ) : (
        <div className="w-32 h-32 flex flex-col items-center justify-center text-ink-secondary">
          <FileIcon size={32} />
          <span className="text-xs mt-1 truncate max-w-[120px]">{file.file.name}</span>
        </div>
      )}
      <div className="text-[10px] text-ink-tertiary mt-1 truncate">
        {file.uploading ? 'Yükleniyor...' : file.error ? `Hata: ${file.error}` : `${formatSize(file.file.size)}`}
      </div>
    </div>
  );
}

function formatSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
