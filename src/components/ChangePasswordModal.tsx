// src/components/ChangePasswordModal.tsx
import React, { useState } from 'react';
import { X, KeyRound, AlertCircle, Check } from 'lucide-react';
import { api } from '../services/api';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
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
    setBusy(true);
    try {
      await api.changePassword(current, next);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Parooli muutmine ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <form className="modal-content animate-scale-up change-password-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-header">
          <div className="modal-title-group">
            <KeyRound className="text-emerald" size={22} />
            <h3>Muuda parooli</h3>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={close}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
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
              <div className="form-group">
                <label htmlFor="pw-current">Praegune parool</label>
                <input id="pw-current" type="password" className="form-input" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="pw-new">Uus parool (vähemalt 10 märki)</label>
                <input id="pw-new" type="password" className="form-input" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="pw-repeat">Korda uut parooli</label>
                <input id="pw-repeat" type="password" className="form-input" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={close}>{done ? 'Sulge' : 'Loobu'}</button>
          {!done && (
            <button type="submit" className="btn btn-primary" disabled={busy}>
              <Check size={16} />
              <span>Salvesta</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
