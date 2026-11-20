// src/components/WeatherCredentialModal.tsx — „Ilmaandmete ühendus“: ettevõtte oma Copernicuse (CDS) API võti ilmaandmete laadimiseks.
// Võtit ei näidata kunagi: server tagastab ainult oleku. Ainult administraatorile.
import React, { useCallback, useEffect, useState } from 'react';
import { CloudSun, AlertCircle, Check, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { confirmDialog } from './ConfirmDialog';
import { formatDateTimeTallinn } from '../services/dateFormat';
import type { WeatherCredentialStatus } from '../types/weather';
import { Alert, Badge, Button, Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, Input, hintTextClass } from './ui';

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
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent size="md" dismissible={!busy}>
        <DialogHeader
          icon={<CloudSun size={22} />}
          title="Ilmaandmete ühendus"
          description="Ilmaandmed tulevad Copernicuse ERA5-Landist. Selleks on vaja ettevõtte Copernicuse konto isiklikku API võtit."
        />
        <DialogBody>
          {error && (
            <Alert tone="error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </Alert>
          )}
          {notice && (
            <Alert>
              <Check size={16} />
              <span>{notice}</span>
            </Alert>
          )}

          {status && (
            <div className="my-3 text-sm leading-natural">
              <div className="mb-1.5 font-medium">
                {status.configured ? <Badge tone="success">Võti salvestatud</Badge> : <Badge tone="warning">Võti puudub</Badge>}
              </div>
              {status.configured && (
                <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 [&>dd]:m-0 [&>dt]:text-subtle">
                  <dt>Muudetud</dt>
                  <dd>{formatDateTimeTallinn(status.updatedAt)}{status.updatedBy ? ` (${status.updatedBy})` : ''}</dd>
                  <dt>Viimati kasutatud</dt>
                  <dd>{formatDateTimeTallinn(status.lastUsedAt)}</dd>
                  {status.lastError && (<><dt>Viimane viga</dt><dd className="text-danger-solid">{status.lastError}</dd></>)}
                </dl>
              )}
            </div>
          )}

          {canEdit && (
            <form className="mt-3 mb-4 flex flex-wrap gap-2" onSubmit={save}>
              <Input
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="Personal Access Token"
                maxLength={200}
                className="min-w-0 grow shrink basis-65"
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
          {status && !canEdit && <p className={hintTextClass}>Võtit saab muuta ainult administraator.</p>}

          <div className="text-sm leading-natural [&>ol]:mt-1.5 [&>ol]:mb-2 [&>ol]:ml-4 [&>ol]:p-0">
            <strong>Kuidas võtit saada</strong>
            <ol>
              <li>Loo konto aadressil cds.climate.copernicus.eu.</li>
              <li>Täida konto profiil.</li>
              <li>Ava ERA5-Land timeseries andmestiku leht ja aktsepteeri litsents.</li>
              <li>Kopeeri profiililt „Personal Access Token“ ja kleebi see siia.</li>
            </ol>
            <p>Ilmaandmed on ühised: kui sama ruudu teisel ettevõttel on võti, näed andmeid ka ilma oma võtmeta.</p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close}>Sulge</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
