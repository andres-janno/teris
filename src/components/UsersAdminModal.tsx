// src/components/UsersAdminModal.tsx — kasutajate haldus (ainult adminile).
import React, { useCallback, useEffect, useState } from 'react';
import { X, Users, UserPlus, Pencil, KeyRound, Ban, CheckCircle2, Trash2, AlertCircle, Check, Mail } from 'lucide-react';
import { api } from '../services/api';
import type { AdminUser } from '../types/auth';

interface UsersAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
}

type Mode = { kind: 'list' } | { kind: 'add' } | { kind: 'edit'; user: AdminUser } | { kind: 'reset'; user: AdminUser };

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Toiming ebaõnnestus');

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('et-EE', { dateStyle: 'short', timeStyle: 'short' }) : '–';

export const UsersAdminModal: React.FC<UsersAdminModalProps> = ({ isOpen, onClose, currentUserId }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [useInvite, setUseInvite] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers(await api.listUsers());
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setMode({ kind: 'list' });
    setError(null);
    setNotice(null);
    void load();
  }, [isOpen, load]);

  if (!isOpen) return null;

  const openForm = (next: Mode) => {
    setError(null);
    setUsername('');
    setPassword('');
    setRepeat('');
    setDisplayName(next.kind === 'edit' ? next.user.displayName ?? '' : '');
    setIsAdmin(next.kind === 'edit' ? next.user.isAdmin : false);
    setEmail(next.kind === 'edit' ? next.user.email ?? '' : '');
    setUseInvite(true);
    setNotice(null);
    setMode(next);
  };

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const result = await action();
      if (typeof result === 'string') setNotice(result);
      // Toiming õnnestus — tagasi nimekirja ka siis, kui järgnev laadimine ebaõnnestub.
      setMode({ kind: 'list' });
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode.kind === 'reset' || (mode.kind === 'add' && !useInvite)) {
      if (password.length < 10) return setError('Parool peab olema vähemalt 10 märki');
      if (password !== repeat) return setError('Paroolid ei kattu');
    }
    if (mode.kind === 'add') {
      void run(async () => {
        const { emailSent } = await api.createUser({ username, displayName, email, isAdmin, ...(useInvite ? {} : { password }) });
        if (useInvite) {
          return emailSent
            ? `Kutse saadeti aadressile ${email}.`
            : 'Kasutaja loodi, aga e-kirja saatmine ebaõnnestus — proovi „Saada parooli link“.';
        }
      });
    } else if (mode.kind === 'edit') {
      const self = mode.user.id === currentUserId;
      const trimmedEmail = email.trim();
      const payload: { displayName: string; email?: string; isAdmin?: boolean } = { displayName };
      // E-posti saadetakse ainult siis, kui see kasutaja praegusest väärtusest erineb —
      // muidu lükkab server tagasi (tühi string tähendaks „eemalda e-post").
      if (trimmedEmail !== (mode.user.email ?? '')) payload.email = trimmedEmail;
      if (!self) payload.isAdmin = isAdmin;
      void run(() => api.updateUser(mode.user.id, payload));
    } else if (mode.kind === 'reset') void run(() => api.resetUserPassword(mode.user.id, password));
  };

  const sendLink = (u: AdminUser) =>
    void run(async () => {
      const { emailSent } = await api.sendUserLink(u.id);
      return emailSent ? `Parooli link saadeti aadressile ${u.email}.` : 'E-kirja saatmine ebaõnnestus. Proovi hiljem uuesti.';
    });

  const toggleActive = (u: AdminUser) => void run(() => api.updateUser(u.id, { isActive: !u.isActive }));

  const remove = (u: AdminUser) => {
    if (confirm(`Kustutada kasutaja "${u.username}" jäädavalt?`)) void run(() => api.deleteUser(u.id));
  };

  const formTitle =
    mode.kind === 'add'
      ? 'Lisa kasutaja'
      : mode.kind === 'edit'
        ? `Muuda: ${mode.user.username}`
        : mode.kind === 'reset'
          ? `Lähtesta parool: ${mode.user.username}`
          : '';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content animate-scale-up users-admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Users className="text-emerald" size={22} />
            <h3>Kasutajad</h3>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="alert-box error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          {notice && <div className="alert-box">{notice}</div>}

          {mode.kind === 'list' ? (
            <>
              <div className="users-admin-toolbar">
                <button type="button" className="btn btn-primary" onClick={() => openForm({ kind: 'add' })}>
                  <UserPlus size={16} />
                  <span>Lisa kasutaja</span>
                </button>
              </div>
              <div className="users-admin-table-wrap">
                <table className="users-admin-table">
                  <thead>
                    <tr>
                      <th>Nimi</th>
                      <th>Kasutajanimi</th>
                      <th>E-post</th>
                      <th>Roll</th>
                      <th>Olek</th>
                      <th>Viimati sees</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const self = u.id === currentUserId;
                      return (
                        <tr key={u.id} className={u.isActive ? '' : 'inactive'}>
                          <td>{u.displayName ?? '–'}</td>
                          <td>{u.username}</td>
                          <td>{u.email ?? '–'}</td>
                          <td>{u.isAdmin ? 'Admin' : 'Kasutaja'}</td>
                          <td>
                            {u.isActive ? 'Aktiivne' : 'Keelatud'}
                            {u.mustChangePassword && <span className="users-admin-badge">Parool vahetamata</span>}
                            {!u.hasPassword && <span className="users-admin-badge">Kutse saadetud</span>}
                          </td>
                          <td>{formatDate(u.lastLoginAt)}</td>
                          <td className="users-admin-actions">
                            <button type="button" className="icon-btn-ghost" title="Muuda" disabled={busy} onClick={() => openForm({ kind: 'edit', user: u })}>
                              <Pencil size={15} />
                            </button>
                            {!self && (
                              <>
                                {u.email && u.isActive && (
                                  <button type="button" className="icon-btn-ghost" title="Saada parooli link e-postile" disabled={busy} onClick={() => sendLink(u)}>
                                    <Mail size={15} />
                                  </button>
                                )}
                                <button type="button" className="icon-btn-ghost" title="Lähtesta parool" disabled={busy} onClick={() => openForm({ kind: 'reset', user: u })}>
                                  <KeyRound size={15} />
                                </button>
                                <button type="button" className="icon-btn-ghost" title={u.isActive ? 'Keela' : 'Luba'} disabled={busy} onClick={() => toggleActive(u)}>
                                  {u.isActive ? <Ban size={15} /> : <CheckCircle2 size={15} />}
                                </button>
                                <button type="button" className="icon-btn-danger" title="Kustuta" disabled={busy} onClick={() => remove(u)}>
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <form id="users-admin-form" className="users-admin-form" onSubmit={submit}>
              <h4>{formTitle}</h4>
              {mode.kind === 'add' && (
                <div className="form-group">
                  <label htmlFor="ua-username">Kasutajanimi (a–z, 0–9, . _ -)</label>
                  <input id="ua-username" className="form-input" required autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
                </div>
              )}
              {(mode.kind === 'add' || mode.kind === 'edit') && (
                <div className="form-group">
                  <label htmlFor="ua-display">Nimi</label>
                  <input id="ua-display" className="form-input" autoComplete="off" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
              )}
              {(mode.kind === 'add' || mode.kind === 'edit') && (
                <div className="form-group">
                  <label htmlFor="ua-email">E-post{mode.kind === 'add' ? ' (kohustuslik)' : ''}</label>
                  <input id="ua-email" type="email" className="form-input" required={mode.kind === 'add'} autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              )}
              {mode.kind === 'add' && (
                <div className="users-admin-mode">
                  <label className="users-admin-checkbox">
                    <input type="radio" name="ua-mode" checked={useInvite} onChange={() => setUseInvite(true)} />
                    <span>Saada kutse e-postiga (kasutaja määrab parooli ise)</span>
                  </label>
                  <label className="users-admin-checkbox">
                    <input type="radio" name="ua-mode" checked={!useInvite} onChange={() => setUseInvite(false)} />
                    <span>Määra ajutine parool</span>
                  </label>
                </div>
              )}
              {(mode.kind === 'reset' || (mode.kind === 'add' && !useInvite)) && (
                <>
                  <div className="form-group">
                    <label htmlFor="ua-password">Ajutine parool (vähemalt 10 märki)</label>
                    <input id="ua-password" type="password" className="form-input" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="ua-repeat">Korda parooli</label>
                    <input id="ua-repeat" type="password" className="form-input" required autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
                  </div>
                  <p className="modal-subtitle">Kasutaja peab parooli esimesel sisselogimisel vahetama.</p>
                </>
              )}
              {(mode.kind === 'add' || (mode.kind === 'edit' && mode.user.id !== currentUserId)) && (
                <label className="users-admin-checkbox">
                  <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
                  <span>Admin (saab kasutajaid hallata)</span>
                </label>
              )}
            </form>
          )}
        </div>

        <div className="modal-footer">
          {mode.kind === 'list' ? (
            <button type="button" className="btn btn-ghost" onClick={onClose}>Sulge</button>
          ) : (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => { setError(null); setMode({ kind: 'list' }); }}>Tagasi</button>
              <button type="submit" form="users-admin-form" className="btn btn-primary" disabled={busy}>
                <Check size={16} />
                <span>Salvesta</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
