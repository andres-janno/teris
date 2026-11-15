// src/components/ChangePasswordModal.tsx
import React, { useState } from 'react';
import { KeyRound, AlertCircle, Check } from 'lucide-react';
import { api } from '../services/api';
import { Button, Field, Input, Dialog, DialogContent, DialogForm, DialogHeader, DialogBody, DialogFooter } from './ui';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Sundvahetus: aken ei sulgu, õnnestumisel kutsutakse onDone, lisaks "Logi välja".
  forced?: boolean;
  onDone?: () => void;
  onLogout?: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, forced = false, onDone, onLogout }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const close = () => {
    setCurrent('');
    setNext('');
    setRepeat('');
    setError(null);
    setDone(false);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 10) return setError('Parool peab olema vähemalt 10 märki');
    if (next !== repeat) return setError('Uued paroolid ei kattu');
    if (next === current) return setError('Uus parool peab erinema praegusest');
    setBusy(true);
    try {
      await api.changePassword(current, next);
      if (forced) onDone?.();
      else setDone(true);
    } catch (err) {
      // Sundvahetuse ajal sessioon kadus (admin lähtestas/keelas) — tagasi sisselogimisele.
      if (forced && (err as { status?: number }).status === 401) return onLogout?.();
      setError(err instanceof Error ? err.message : 'Parooli muutmine ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !forced) close(); }}>
      <DialogContent size="sm" className="change-password-modal" dismissible={!forced && !busy}>
        <DialogForm onSubmit={submit}>
        <DialogHeader
          icon={<KeyRound className="text-emerald" size={22} />}
          title={forced ? 'Määra uus parool' : 'Muuda parooli'}
          description={forced ? 'Sinu parool on ajutine. Määra endale uus parool, et jätkata.' : undefined}
          showClose={!forced}
        />
        <DialogBody>
          {done ? (
            <div className="alert-box">
              <Check size={16} />
              <span>Parool muudetud. Teistes seadmetes tuleb uuesti sisse logida.</span>
            </div>
          ) : (
            <>
              {error && (
                <div className="alert-box error">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}
              <Field label={forced ? 'Ajutine parool' : 'Praegune parool'} htmlFor="pw-current">
                <Input id="pw-current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
              </Field>
              <Field label="Uus parool (vähemalt 10 märki)" htmlFor="pw-new">
                <Input id="pw-new" type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} />
              </Field>
              <Field label="Korda uut parooli" htmlFor="pw-repeat">
                <Input id="pw-repeat" type="password" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} />
              </Field>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          {forced ? (
            <Button type="button" variant="ghost" onClick={onLogout}>Logi välja</Button>
          ) : (
            <Button type="button" variant="ghost" onClick={close}>{done ? 'Sulge' : 'Loobu'}</Button>
          )}
          {!done && (
            <Button type="submit" variant="primary" disabled={busy}>
              <Check size={16} />
              <span>Salvesta</span>
            </Button>
          )}
        </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
};
