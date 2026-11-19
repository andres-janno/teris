// src/components/UsersAdminModal.tsx — kasutajate haldus (ainult adminile).
import React, { useCallback, useEffect, useState } from 'react';
import { Users, UserPlus, Pencil, KeyRound, Ban, CheckCircle2, Trash2, AlertCircle, Check, Mail } from 'lucide-react';
import { api } from '../services/api';
import type { AdminUser } from '../types/auth';
import { formatDateTime } from '../services/dateFormat';
import { confirmDialog } from './ConfirmDialog';
import { SupportAccessPanel } from './SupportAccessPanel';
import { Alert, Badge, Button, Field, Input, CheckboxField, RadioGroup, RadioField, Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogForm, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui';

interface UsersAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  /** Tugivaade: ainult lugemine, muutvad toimingud peidetud. */
  readOnly?: boolean;
}

type Mode = { kind: 'list' } | { kind: 'add' } | { kind: 'edit'; user: AdminUser } | { kind: 'reset'; user: AdminUser };

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Toiming ebaõnnestus');


export const UsersAdminModal: React.FC<UsersAdminModalProps> = ({ isOpen, onClose, currentUserId, readOnly = false }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFinanceManager, setIsFinanceManager] = useState(false);
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
    setIsFinanceManager(next.kind === 'edit' ? next.user.isFinanceManager : false);
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
        const { emailSent } = await api.createUser({ username, displayName, email, isAdmin, isFinanceManager, ...(useInvite ? {} : { password }) });
        if (useInvite) {
          return emailSent
            ? `Kutse saadeti aadressile ${email}.`
            : 'Kasutaja loodi, aga e-kirja saatmine ebaõnnestus — proovi „Saada parooli link“.';
        }
      });
    } else if (mode.kind === 'edit') {
      const self = mode.user.id === currentUserId;
      const trimmedEmail = email.trim();
      const payload: { displayName: string; email?: string; isAdmin?: boolean; isFinanceManager?: boolean } = { displayName, isFinanceManager };
      // E-posti saadetakse ainult siis, kui see kasutaja praegusest väärtusest erineb —
      // muidu lükkab server tagasi (tühi string tähendaks „eemalda e-post").
      if (trimmedEmail !== (mode.user.email ?? '')) payload.email = trimmedEmail;
      if (!self) payload.isAdmin = isAdmin;
      void run(() => api.updateUser(mode.user.id, payload));
    } else if (mode.kind === 'reset') void run(() => api.resetUserPassword(mode.user.id, password));
  };

  const sendLink = async (u: AdminUser) => {
    const kind = u.hasPassword ? 'parooli määramise lingi' : 'kutse';
    if (!await confirmDialog(`Saata kasutajale "${u.username}" ${kind} aadressile ${u.email}?\n\nVarem saadetud lingid kaotavad kehtivuse.`)) return;
    void run(async () => {
      const { emailSent } = await api.sendUserLink(u.id);
      return emailSent ? `Parooli link saadeti aadressile ${u.email}.` : 'E-kirja saatmine ebaõnnestus. Proovi hiljem uuesti.';
    });
  };

  const toggleActive = (u: AdminUser) => void run(() => api.updateUser(u.id, { isActive: !u.isActive }));

  const remove = async (u: AdminUser) => {
    if (await confirmDialog(`Kustutada kasutaja "${u.username}"${u.displayName ? ` (${u.displayName})` : ''} jäädavalt?\n\nKasutaja sessioonid ja saadetud lingid kaovad. Seda ei saa tagasi võtta.`)) void run(() => api.deleteUser(u.id));
  };

  const formTitle =
    mode.kind === 'add'
      ? 'Lisa kasutaja'
      : mode.kind === 'edit'
        ? `Muuda kasutajat: ${mode.user.username}`
        : mode.kind === 'reset'
          ? `Lähtesta parool: ${mode.user.username}`
          : '';

  const FormIcon = mode.kind === 'reset' ? KeyRound : mode.kind === 'edit' ? Pencil : UserPlus;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="xl" className="users-admin-modal" dismissible={!busy}>
        <DialogHeader icon={<Users size={22} />} title="Kasutajad">
          {!readOnly && (
            <Button type="button" variant="primary" size="sm" onClick={() => openForm({ kind: 'add' })}>
              <UserPlus size={15} />
              <span>Lisa kasutaja</span>
            </Button>
          )}
        </DialogHeader>

        <DialogBody>
          {error && mode.kind === 'list' && (
            <Alert tone="error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </Alert>
          )}
          {notice && (
            <Alert>{notice}</Alert>
          )}

          <Table bordered>
            <TableHeader>
              <TableRow>
                <TableHead>Nimi</TableHead>
                <TableHead>Kasutajanimi</TableHead>
                <TableHead>E-post</TableHead>
                <TableHead>Roll</TableHead>
                <TableHead>Olek</TableHead>
                <TableHead>Viimati sees</TableHead>
                <TableHead actions><span className="sr-only">Tegevused</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {users.map((u) => {
                  const self = u.id === currentUserId;
                  return (
                    <TableRow key={u.id} tone={u.isActive ? undefined : 'muted'}>
                      <TableCell wrap className="users-admin-wrap">{u.displayName ?? '–'}</TableCell>
                      <TableCell>{u.username}</TableCell>
                      <TableCell wrap className="users-admin-wrap">{u.email ?? '–'}</TableCell>
                      <TableCell>
                        <span className="users-admin-roles">
                          <span>{u.isAdmin ? 'Admin' : 'Kasutaja'}</span>
                          {u.isFinanceManager && <span>Finantsjuht</span>}
                        </span>
                      </TableCell>
                      <TableCell>
                        {!u.isActive ? (
                          <Badge tone="danger" dot>Keelatud</Badge>
                        ) : !u.hasPassword ? (
                          <Badge tone="warning" dot>Kutse saadetud</Badge>
                        ) : u.mustChangePassword ? (
                          <Badge tone="warning" dot>Parool vahetamata</Badge>
                        ) : (
                          <Badge tone="success" dot>Aktiivne</Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDateTime(u.lastSeenAt ?? u.lastLoginAt)}</TableCell>
                      <TableCell actions>
                          {!readOnly && (
                          <Button type="button" variant="ghost" size="icon-sm" title="Muuda" disabled={busy} onClick={() => openForm({ kind: 'edit', user: u })}>
                            <Pencil size={15} />
                          </Button>
                          )}
                          {!readOnly && !self && (
                            <>
                              {u.email && u.isActive && (
                                <Button type="button" variant="ghost" size="icon-sm" title="Saada parooli link e-postile" disabled={busy} onClick={() => sendLink(u)}>
                                  <Mail size={15} />
                                </Button>
                              )}
                              <Button type="button" variant="ghost" size="icon-sm" title="Lähtesta parool" disabled={busy} onClick={() => openForm({ kind: 'reset', user: u })}>
                                <KeyRound size={15} />
                              </Button>
                              <Button type="button" variant="ghost" size="icon-sm" title={u.isActive ? 'Keela' : 'Luba'} disabled={busy} onClick={() => toggleActive(u)}>
                                {u.isActive ? <Ban size={15} /> : <CheckCircle2 size={15} />}
                              </Button>
                              <Button type="button" variant="danger-ghost" size="icon-sm" title="Kustuta" disabled={busy} onClick={() => remove(u)}>
                                <Trash2 size={15} />
                              </Button>
                            </>
                          )}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>

          <SupportAccessPanel readOnly={readOnly} />
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Sulge</Button>
        </DialogFooter>
      </DialogContent>

      {/* Kasutaja lisamine/muutmine/parooli lähtestamine eraldi aknas registri peal */}
      {mode.kind !== 'list' && (
        <Dialog open onOpenChange={(open) => { if (!open) { setError(null); setMode({ kind: 'list' }); } }}>
          <DialogContent size="md" dismissible={!busy} className="users-edit-modal">
            <DialogForm id="users-admin-form" onSubmit={submit}>
              <DialogHeader icon={<FormIcon size={20} />} title={formTitle} />
              <DialogBody>
              {error && (
                <Alert tone="error">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </Alert>
              )}
              {mode.kind === 'add' && (
                <Field label="Kasutajanimi (a–z, 0–9, . _ -)" htmlFor="ua-username">
                  <Input id="ua-username" required autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
                </Field>
              )}
              {(mode.kind === 'add' || mode.kind === 'edit') && (
                <Field label="Nimi" htmlFor="ua-display">
                  <Input id="ua-display" autoComplete="off" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </Field>
              )}
              {(mode.kind === 'add' || mode.kind === 'edit') && (
                <Field label={<>E-post{mode.kind === 'add' ? ' (kohustuslik)' : ''}</>} htmlFor="ua-email">
                  <Input id="ua-email" type="email" required={mode.kind === 'add'} autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
              )}
              {mode.kind === 'add' && (
                <RadioGroup className="users-admin-mode" orientation="vertical" value={useInvite ? 'invite' : 'password'} onValueChange={(v) => setUseInvite(v === 'invite')}>
                  <RadioField value="invite" label="Saada kutse e-postiga (kasutaja määrab parooli ise)" />
                  <RadioField value="password" label="Määra ajutine parool" />
                </RadioGroup>
              )}
              {(mode.kind === 'reset' || (mode.kind === 'add' && !useInvite)) && (
                <>
                  <Field label="Ajutine parool (vähemalt 10 märki)" htmlFor="ua-password">
                    <Input id="ua-password" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </Field>
                  <Field label="Korda parooli" htmlFor="ua-repeat">
                    <Input id="ua-repeat" type="password" required autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
                  </Field>
                  <p className="hint-text">Kasutaja peab parooli esimesel sisselogimisel vahetama.</p>
                </>
              )}
              {(mode.kind === 'add' || (mode.kind === 'edit' && mode.user.id !== currentUserId)) && (
                <CheckboxField checked={isAdmin} onCheckedChange={setIsAdmin} label="Admin (saab kasutajaid hallata)" />
              )}
              {(mode.kind === 'add' || mode.kind === 'edit') && (
                <CheckboxField checked={isFinanceManager} onCheckedChange={setIsFinanceManager} label="Finantsjuht (kannete ühiku kulud, kinnitamine, põldude tulemus)" />
              )}
              </DialogBody>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => { setError(null); setMode({ kind: 'list' }); }}>Loobu</Button>
                <Button type="submit" variant="primary" disabled={busy}>
                  <Check size={16} />
                  <span>Salvesta</span>
                </Button>
              </DialogFooter>
            </DialogForm>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
};
