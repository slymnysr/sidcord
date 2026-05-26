import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useAppDispatch, useAppSelector, closeModal } from '../store';
import { CreateGuildModal } from './CreateGuildModal';
import { JoinGuildModal } from './JoinGuildModal';
import { InviteLinkModal } from './InviteLinkModal';
import { ServerSettingsModal } from './ServerSettingsModal';
import { AddFriendModal } from './AddFriendModal';
import { SearchModal } from './SearchModal';

export function Modal() {
  const modal = useAppSelector((s) => s.ui.modal);
  const dispatch = useAppDispatch();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') dispatch(closeModal());
    }
    if (modal) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, dispatch]);

  if (!modal) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
      onClick={() => dispatch(closeModal())}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={
          'bg-surface-1 border border-line rounded-2xl shadow-2xl relative ring-1 ring-white/5 ' +
          (modal === 'server_settings'
            ? 'w-full max-w-4xl'
            : modal === 'friends' || modal === 'search'
              ? 'w-full max-w-2xl'
              : 'w-full max-w-md')
        }
      >
        <button
          onClick={() => dispatch(closeModal())}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg hover:bg-surface-2 text-ink-secondary hover:text-ink-primary flex items-center justify-center"
          title="Kapat"
        >
          <X size={18} />
        </button>
        {modal === 'create_guild' && <CreateGuildModal />}
        {modal === 'join_guild' && <JoinGuildModal />}
        {modal === 'invite_link' && <InviteLinkModal />}
        {modal === 'server_settings' && <ServerSettingsModal />}
        {modal === 'friends' && <AddFriendModal />}
        {modal === 'search' && <SearchModal />}
      </div>
    </div>
  );
}
