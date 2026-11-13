// src/components/WeatherCredentialModal.tsx — „Ilmaandmete ühendus“: ettevõtte oma Copernicuse (CDS) API võti ilmaandmete laadimiseks.
// Võtit ei näidata kunagi: server tagastab ainult oleku. Ainult administraatorile.
import React, { useCallback, useEffect, useState } from 'react';
import { X, CloudSun, AlertCircle, Check, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { confirmDialog } from './ConfirmDialog';
import { formatDateTimeTallinn } from '../services/dateFormat';
import type { WeatherCredentialStatus } from '../types/weather';
import { Button } from './ui';

interface WeatherCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Tugivaade: ainult lugemine. */
  readOnly?: boolean;
}

export const WeatherCredentialModal: React.FC<WeatherCredentialModalProps> = ({ isOpen, onClose, readOnly = false }) => {
  const [status, setStatus] = useState<WeatherCredentialStatus | null>(null);
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await api.getWeatherCredential());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ühenduse oleku laadimine ebaõnnestus');
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setNotice(null);
    void load();
  }, [isOpen, load]);

  if (!isOpen) return null;

  const close = () => {
    setKey('');
    setError(null);
    setNotice(null);
    onClose();
  };

  const canEdit = !!status?.canEdit && !readOnly;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      setStatus(await api.saveWeatherCredential(key.trim()));
      setKey('');
      setNotice('Võti kontrolliti ja salvestati. Ilmaandmed laetakse järgmisel ööl.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Võtme salvestamine ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirmDialog('Eemaldada Copernicuse võti?\n\nKui ruudul pole ühegi ettevõtte võtit, uusi ilmaandmeid ei laeta.'))) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      setStatus(await api.deleteWeatherCredential());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Võtme eemaldamine ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal-content animate-scale-up weather-credential-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <CloudSun className="text-emerald" size={22} />
            <h3>Ilmaandmete ühendus</h3>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={close}>
            <X size={20} />
          </Button>
        </div>
        <div className="modal-body">
          <p className="modal-subtitle">
            Ilmaandmed tulevad Copernicuse ERA5-Landist. Selleks on vaja ettevõtte Copernicuse konto isiklikku API võtit.
          </p>
          {error && (
            <div className="alert-box error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          {notice && (
            <div className="alert-box">
              <Check size={16} />
              <span>{notice}</span>
            </div>
          )}

          {status && (
            <div className="weather-credential-status">
              <div className="weather-credential-state">
                {status.configured ? <span className="weather-credential-ok">Võti salvestatud</span> : <span className="weather-credential-missing">Võti puudub</span>}
              </div>
              {status.configured && (
                <dl>
                  <dt>Muudetud</dt>
                  <dd>{formatDateTimeTallinn(status.updatedAt)}{status.updatedBy ? ` (${status.updatedBy})` : ''}</dd>
                  <dt>Viimati kasutatud</dt>
                  <dd>{formatDateTimeTallinn(status.lastUsedAt)}</dd>
                  {status.lastError && (<><dt>Viimane viga</dt><dd className="weather-credential-error">{status.lastError}</dd></>)}
                </dl>
              )}
            </div>
          )}

          {canEdit && (
            <form className="weather-credential-form" onSubmit={save}>
              <input
                className="form-input"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="Personal Access Token"
                maxLength={200}
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
              <Button type="submit" variant="primary" disabled={busy || key.trim().length === 0}>
                <Check size={16} />
                <span>Kontrolli ja salvesta</span>
              </Button>
              {status?.configured && (
                <Button type="button" disabled={busy} onClick={() => void remove()}>
                  <Trash2 size={16} />
                  <span>Eemalda võti</span>
                </Button>
              )}
            </form>
          )}
          {status && !canEdit && <p className="modal-subtitle">Võtit saab muuta ainult administraator.</p>}

          <div className="weather-credential-help">
            <strong>Kuidas võtit saada</strong>
            <ol>
              <li>Loo konto aadressil cds.climate.copernicus.eu.</li>
              <li>Täida konto profiil.</li>
              <li>Ava ERA5-Land timeseries andmestiku leht ja aktsepteeri litsents.</li>
              <li>Kopeeri profiililt „Personal Access Token“ ja kleebi see siia.</li>
            </ol>
            <p>Ilmaandmed on ühised: kui sama ruudu teisel ettevõttel on võti, näed andmeid ka ilma oma võtmeta.</p>
          </div>
        </div>
        <div className="modal-footer">
          <Button type="button" variant="ghost" onClick={close}>Sulge</Button>
        </div>
      </div>
    </div>
  );
};
