import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useAppDispatch, useAppSelector, removeToast } from '../store';

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const COLORS = {
  success: 'border-status-online text-status-online',
  error: 'border-accent-500 text-accent-500',
  info: 'border-brand-500 text-brand-500',
};

export function ToastContainer() {
  const toasts = useAppSelector((s) => s.toasts.list);
  const dispatch = useAppDispatch();
  return (
    <div className="fixed bottom-6 right-6 z-[100] space-y-2 pointer-events-none">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <ToastItem
            key={t.id}
            id={t.id}
            kind={t.kind}
            message={t.message}
            Icon={Icon}
            onClose={() => dispatch(removeToast(t.id))}
          />
        );
      })}
    </div>
  );
}

function ToastItem({
  id,
  kind,
  message,
  Icon,
  onClose,
}: {
  id: string;
  kind: 'success' | 'error' | 'info';
  message: string;
  Icon: typeof CheckCircle2;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [id, onClose]);

  return (
    <div
      className={
        'pointer-events-auto bg-surface-1 border-l-4 border-line ring-1 ring-white/5 rounded-lg shadow-2xl px-4 py-3 flex items-start gap-2.5 min-w-[280px] max-w-md ' +
        COLORS[kind]
      }
    >
      <Icon size={18} className="shrink-0 mt-0.5" />
      <p className="flex-1 text-sm text-ink-primary leading-snug">{message}</p>
      <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary">
        <X size={14} />
      </button>
    </div>
  );
}
