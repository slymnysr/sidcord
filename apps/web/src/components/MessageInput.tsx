import { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, X, FileIcon } from 'lucide-react';
import { api } from '../api';
import { useAppDispatch, useAppSelector } from '../store';
import { sendTyping } from '../gateway';

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
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const lastTyping = useRef(0);

  useEffect(() => {
    setValue('');
    setFiles([]);
    ref.current?.focus();
  }, [channelId]);

  if (!channel || channel.type === 'voice') return null;

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
      // Sendmessage with attachments via the store thunk
      await dispatch({
        type: 'messages/send/pending',
        meta: { arg: { channelId, content: v } },
      });
      const msg = await api.channels.sendMessage(channelId, v || ' ', attachments.length ? attachments : undefined);
      dispatch({
        type: 'messages/send/fulfilled',
        payload: msg,
        meta: { arg: { channelId, content: v } },
      });
    } catch {
      setValue(v);
      setFiles(okFiles);
    } finally {
      setSending(false);
      ref.current?.focus();
    }
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
      <div
        className={
          'bg-surface-2 rounded-2xl border transition-colors ' +
          (dragOver
            ? 'border-brand-500 shadow-glow'
            : 'border-line focus-within:border-brand-500/50 focus-within:shadow-glow')
        }
      >
        {files.length > 0 && (
          <div className="px-4 pt-3 flex flex-wrap gap-2 border-b border-line pb-3">
            {files.map((f) => (
              <FilePreview key={f.id} file={f} onRemove={() => removeFile(f.id)} />
            ))}
          </div>
        )}
        <div className="flex items-end px-4 py-3 gap-3">
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
            onChange={(e) => {
              setValue(e.target.value);
              // 4 saniyede bir typing event
              const now = Date.now();
              if (guildId && channelId && now - lastTyping.current > 4000) {
                lastTyping.current = now;
                sendTyping(guildId, channelId);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={`#${channel.name} kanalına yaz...`}
            rows={1}
            disabled={sending}
            className="flex-1 bg-transparent text-ink-primary placeholder:text-ink-tertiary outline-none resize-none max-h-40 text-[15px] leading-snug py-1"
          />
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
