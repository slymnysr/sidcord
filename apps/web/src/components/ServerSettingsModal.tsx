import { useEffect, useRef, useState } from 'react';
import { Settings, Shield, Ban, Trash2, Plus, Check } from 'lucide-react';
import { useAppSelector } from '../store';
import { api, type APIRole, type APIBan, type APIMember } from '../api';
import { PERM, PERM_LABELS, has, toggle } from '../perms';

type Tab = 'overview' | 'roles' | 'members' | 'bans';

export function ServerSettingsModal() {
  const guild = useAppSelector((s) => s.guilds.list.find((g) => g.id === s.guilds.selectedId));
  const [tab, setTab] = useState<Tab>('overview');

  if (!guild) return null;

  return (
    <div className="flex max-h-[80vh]" style={{ minHeight: '500px' }}>
      <nav className="w-48 bg-surface-2 border-r border-line p-3 space-y-1 overflow-y-auto rounded-l-2xl">
        <div className="text-xs font-bold uppercase text-ink-tertiary px-2 py-2">
          {guild.name}
        </div>
        <TabBtn icon={<Settings size={16} />} active={tab === 'overview'} onClick={() => setTab('overview')}>
          Genel
        </TabBtn>
        <TabBtn icon={<Shield size={16} />} active={tab === 'roles'} onClick={() => setTab('roles')}>
          Roller
        </TabBtn>
        <TabBtn icon={<Plus size={16} />} active={tab === 'members'} onClick={() => setTab('members')}>
          Üyeler
        </TabBtn>
        <TabBtn icon={<Ban size={16} />} active={tab === 'bans'} onClick={() => setTab('bans')}>
          Banlanmış
        </TabBtn>
      </nav>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'overview' && <OverviewTab guildId={guild.id} />}
        {tab === 'roles' && <RolesTab guildId={guild.id} />}
        {tab === 'members' && <MembersTab guildId={guild.id} />}
        {tab === 'bans' && <BansTab guildId={guild.id} />}
      </div>
    </div>
  );
}

function TabBtn({
  icon,
  active,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        'w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ' +
        (active ? 'bg-brand-500/15 text-brand-500' : 'text-ink-secondary hover:bg-surface-3 hover:text-ink-primary')
      }
    >
      {icon}
      {children}
    </button>
  );
}

function OverviewTab({ guildId }: { guildId: string }) {
  const guild = useAppSelector((s) => s.guilds.list.find((g) => g.id === guildId));
  if (!guild) return null;
  return (
    <div>
      <h2 className="text-2xl font-bold text-ink-primary mb-4">Genel Bilgi</h2>
      <div className="bg-surface-2 rounded-xl border border-line p-4 space-y-2 text-sm">
        <Row label="Sunucu Adı" value={guild.name} />
        <Row label="Sunucu ID" value={guild.id} mono />
        <Row label="Oluşturulma" value={new Date(guild.created_at).toLocaleString('tr-TR')} />
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex">
      <span className="w-40 text-ink-tertiary">{label}</span>
      <span className={'text-ink-primary ' + (mono ? 'font-mono text-xs' : '')}>{value}</span>
    </div>
  );
}

function RolesTab({ guildId }: { guildId: string }) {
  const [roles, setRoles] = useState<APIRole[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const list = await api.guilds.roles(guildId).catch(() => []);
    setRoles(list);
    if (!selectedId && list.length > 0) setSelectedId(list[0].id);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, [guildId]);

  const selected = roles.find((r) => r.id === selectedId);

  async function createRole() {
    const name = prompt('Yeni rolün adı?');
    if (!name?.trim()) return;
    const r = await api.guilds.createRole(guildId, { name: name.trim(), permissions: '0' });
    await refresh();
    setSelectedId(r.id);
  }

  async function updateSelected(patch: Partial<APIRole>) {
    if (!selected) return;
    const updated = await api.guilds.updateRole(guildId, selected.id, {
      name: patch.name ?? selected.name,
      color: patch.color ?? selected.color,
      permissions: patch.permissions ?? selected.permissions,
      hoist: patch.hoist ?? selected.hoist,
      mentionable: patch.mentionable ?? selected.mentionable,
    });
    setRoles((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
  }

  async function remove() {
    if (!selected || selected.is_everyone) return;
    if (!confirm(`"${selected.name}" rolünü silmek istiyor musun?`)) return;
    await api.guilds.deleteRole(guildId, selected.id);
    setSelectedId(null);
    refresh();
  }

  if (loading) return <p className="text-ink-tertiary">Yükleniyor...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-ink-primary">Roller</h2>
        <button
          onClick={createRole}
          className="bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
        >
          <Plus size={14} /> Yeni Rol
        </button>
      </div>

      <div className="grid grid-cols-[200px_1fr] gap-4">
        <ul className="space-y-1">
          {roles.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => setSelectedId(r.id)}
                className={
                  'w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ' +
                  (r.id === selectedId ? 'bg-brand-500/15 text-brand-500' : 'hover:bg-surface-2 text-ink-secondary')
                }
              >
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : '#6B7280' }}
                />
                {r.name}
              </button>
            </li>
          ))}
        </ul>

        {selected && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-ink-secondary mb-1">Ad</label>
              <input
                value={selected.name}
                disabled={selected.is_everyone}
                onChange={(e) =>
                  setRoles((rs) => rs.map((r) => (r.id === selected.id ? { ...r, name: e.target.value } : r)))
                }
                onBlur={(e) => updateSelected({ name: e.target.value })}
                className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink-primary focus:border-brand-500/50 focus:outline-none disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-ink-secondary mb-2">İzinler</label>
              <div className="grid grid-cols-2 gap-2 bg-surface-2 rounded-xl border border-line p-3 max-h-96 overflow-y-auto">
                {Object.entries(PERM).map(([key, bit]) => {
                  const checked = has(selected.permissions, bit);
                  return (
                    <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-surface-3 rounded px-2 py-1">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => updateSelected({ permissions: toggle(selected.permissions, bit) })}
                        className="rounded accent-brand-500"
                      />
                      <span className="text-sm text-ink-primary">{PERM_LABELS[key] ?? key}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {!selected.is_everyone && (
              <button
                onClick={remove}
                className="bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5"
              >
                <Trash2 size={14} /> Rolü Sil
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MembersTab({ guildId }: { guildId: string }) {
  const [members, setMembers] = useState<APIMember[]>([]);
  const [roles, setRoles] = useState<APIRole[]>([]);
  const me = useAppSelector((s) => s.auth.user);
  const guild = useAppSelector((s) => s.guilds.list.find((g) => g.id === guildId));

  useEffect(() => {
    Promise.all([api.guilds.members(guildId), api.guilds.roles(guildId)]).then(([m, r]) => {
      setMembers(m);
      setRoles(r);
    });
  }, [guildId]);

  async function kick(m: APIMember) {
    if (!confirm(`${m.display_name} kullanıcısını sunucudan atmak istiyor musun?`)) return;
    await api.guilds.kick(guildId, m.user_id);
    setMembers((ms) => ms.filter((x) => x.user_id !== m.user_id));
  }
  async function ban(m: APIMember) {
    const reason = prompt(`${m.display_name} için ban sebebi (boş bırakılabilir):`);
    if (reason === null) return;
    await api.guilds.ban(guildId, m.user_id, reason);
    setMembers((ms) => ms.filter((x) => x.user_id !== m.user_id));
  }
  async function timeoutMember(m: APIMember) {
    const mins = prompt('Timeout süresi (dakika)?', '10');
    if (!mins) return;
    const sec = parseInt(mins, 10) * 60;
    if (!sec) return;
    await api.guilds.timeout(guildId, m.user_id, sec);
  }

  async function toggleRole(m: APIMember, roleId: string) {
    const has = m.role_ids?.includes(roleId);
    try {
      if (has) {
        await api.guilds.unassignRole(guildId, m.user_id, roleId);
        setMembers((ms) =>
          ms.map((x) =>
            x.user_id === m.user_id ? { ...x, role_ids: x.role_ids.filter((r) => r !== roleId) } : x,
          ),
        );
      } else {
        await api.guilds.assignRole(guildId, m.user_id, roleId);
        setMembers((ms) =>
          ms.map((x) =>
            x.user_id === m.user_id ? { ...x, role_ids: [...(x.role_ids ?? []), roleId] } : x,
          ),
        );
      }
    } catch (e) {
      console.warn('toggle role', e);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-ink-primary mb-4">Üyeler ({members.length})</h2>
      <div className="bg-surface-2 rounded-xl border border-line divide-y divide-line">
        {members.map((m) => {
          const isOwner = guild?.owner_id === m.user_id;
          const isMe = me?.id === m.user_id;
          return (
            <div key={m.user_id} className="flex items-center gap-3 p-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: m.avatar_color }}
              >
                {m.display_name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-ink-primary font-semibold truncate flex items-center gap-2 flex-wrap">
                  {m.display_name}
                  {isOwner && (
                    <span className="bg-yellow-500/20 text-yellow-400 text-[10px] px-1.5 rounded">SAHİP</span>
                  )}
                  {m.role_ids?.map((rid) => {
                    const r = roles.find((x) => x.id === rid);
                    if (!r || r.is_everyone) return null;
                    return (
                      <span
                        key={rid}
                        className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1"
                        style={{
                          backgroundColor: `#${r.color.toString(16).padStart(6, '0')}20`,
                          color: `#${r.color.toString(16).padStart(6, '0')}`,
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: `#${r.color.toString(16).padStart(6, '0')}` }}
                        />
                        {r.name}
                      </span>
                    );
                  })}
                </div>
                <div className="text-xs text-ink-tertiary truncate">@{m.username}</div>
              </div>
              {!isOwner && (
                <RoleAssignDropdown member={m} roles={roles} onToggle={(rid) => toggleRole(m, rid)} />
              )}
              {!isOwner && !isMe && (
                <div className="flex gap-1">
                  <button
                    onClick={() => timeoutMember(m)}
                    className="px-2 py-1 rounded text-xs bg-surface-3 hover:bg-yellow-500/20 hover:text-yellow-400 text-ink-secondary"
                  >
                    Timeout
                  </button>
                  <button
                    onClick={() => kick(m)}
                    className="px-2 py-1 rounded text-xs bg-surface-3 hover:bg-orange-500/20 hover:text-orange-400 text-ink-secondary"
                  >
                    Kick
                  </button>
                  <button
                    onClick={() => ban(m)}
                    className="px-2 py-1 rounded text-xs bg-surface-3 hover:bg-accent-500 hover:text-white text-ink-secondary"
                  >
                    Ban
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RoleAssignDropdown({
  member,
  roles,
  onToggle,
}: {
  member: APIMember;
  roles: APIRole[];
  onToggle: (roleId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const assignableRoles = roles.filter((r) => !r.is_everyone);
  if (assignableRoles.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-2 py-1 rounded text-xs bg-surface-3 hover:bg-brand-500/20 hover:text-brand-500 text-ink-secondary"
      >
        Roller
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-surface-1 border border-line rounded-xl shadow-2xl p-1 z-30 max-h-64 overflow-y-auto">
          {assignableRoles.map((r) => {
            const has = member.role_ids?.includes(r.id);
            return (
              <button
                key={r.id}
                onClick={() => onToggle(r.id)}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-surface-2 text-ink-primary text-sm flex items-center gap-2"
              >
                <span
                  className={
                    'w-4 h-4 rounded border-2 flex items-center justify-center ' +
                    (has ? 'bg-brand-500 border-brand-500' : 'border-ink-tertiary')
                  }
                >
                  {has && <Check size={10} className="text-white" />}
                </span>
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: `#${r.color.toString(16).padStart(6, '0')}` }}
                />
                <span className="truncate">{r.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BansTab({ guildId }: { guildId: string }) {
  const [bans, setBans] = useState<APIBan[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const list = await api.guilds.bans(guildId).catch(() => []);
    setBans(list);
    setLoading(false);
  }
  useEffect(() => {
    refresh();
  }, [guildId]);

  async function unban(userId: string) {
    if (!confirm('Banı kaldırmak istiyor musun?')) return;
    await api.guilds.unban(guildId, userId);
    refresh();
  }

  if (loading) return <p className="text-ink-tertiary">Yükleniyor...</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-ink-primary mb-4">Banlanmış Kullanıcılar ({bans.length})</h2>
      {bans.length === 0 && <p className="text-ink-tertiary text-sm">Banlanmış kullanıcı yok.</p>}
      <ul className="space-y-2">
        {bans.map((b) => (
          <li key={b.user_id} className="bg-surface-2 border border-line rounded-xl p-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="text-ink-primary font-mono text-sm">{b.user_id}</div>
              {b.reason && <div className="text-xs text-ink-tertiary mt-1">Sebep: {b.reason}</div>}
              <div className="text-xs text-ink-muted mt-1">
                {new Date(b.banned_at).toLocaleString('tr-TR')}
              </div>
            </div>
            <button
              onClick={() => unban(b.user_id)}
              className="px-3 py-1.5 rounded-lg text-sm bg-surface-3 hover:bg-brand-500 hover:text-white text-ink-secondary"
            >
              Banı Kaldır
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
