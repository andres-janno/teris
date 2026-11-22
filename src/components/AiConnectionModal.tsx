// src/components/AiConnectionModal.tsx — „AI ühendus“: kasutaja enda API-võtmed AI-kliendi (MCP) jaoks.
// Täielikku linki näidatakse ainult kohe pärast loomist.
import React, { useCallback, useEffect, useState } from 'react';
import { Bot, AlertCircle, Copy, Check, Trash2, Plus } from 'lucide-react';
import { api } from '../services/api';
import { confirmDialog } from './ConfirmDialog';
import { formatDateTimeTallinn } from '../services/dateFormat';
import type { ApiKeyRow, CreatedApiKey } from '../types/apiKey';
import { Alert, Button, Input, Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from './ui';

// Võtme rida (link + nupp, nimi + nupp): kitsal ekraanil veerus. Kolmas veerg („Loodud“) kitsal ekraanil peidus.
const keyRowClass = 'flex gap-2 max-[641px]:flex-col';
const hideNarrowClass = 'max-[641px]:hidden';

interface AiConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiConnectionModal: React.FC<AiConnectionModalProps> = ({ isOpen, onClose }) => {
  const [keys, setKeys] = useState<ApiKeyRow[] | null>(null);
  const [name, setName] = useState('');
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setKeys(await api.listApiKeys());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Võtmete laadimine ebaõnnestus');
    }
  }, []);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  if (!isOpen) return null;

  const close = () => {
    setName('');
    setCreated(null);
    setCopied(false);
    setError(null);
    onClose();
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const k = await api.createApiKey(name.trim());
      setCreated(k);
      setCopied(false);
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Võtme loomine ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
    } catch {
      setError('Kopeerimine ebaõnnestus — vali link ja kopeeri käsitsi');
    }
  };

  const revoke = async (k: ApiKeyRow) => {
    if (!(await confirmDialog(`Tühistada võti "${k.name}"?\n\nSeda kasutav AI-ühendus lakkab kohe töötamast.`))) return;
    setError(null);
    try {
      await api.revokeApiKey(k.id);
      if (created?.id === k.id) setCreated(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Võtme tühistamine ebaõnnestus');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent size="lg" dismissible={!busy}>
        <DialogHeader
          icon={<Bot size={22} />}
          title="AI ühendus"
          description="Ühenda oma Terise andmed AI-assistendiga (nt Claude). AI saab andmeid ainult lugeda ja näeb sama, mida sina Terises."
        />
        <DialogBody>
          {error && (
            <Alert tone="error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </Alert>
          )}

          {created && (
            <div className="mb-4 flex flex-col gap-2">
              <Alert>
                <AlertCircle size={16} />
                <span>Linki näidatakse ainult üks kord. See annab ligipääsu sinu Terise andmetele — ära jaga seda.</span>
              </Alert>
              <div className={keyRowClass}>
                <Input className="min-w-0 flex-1 font-mono text-xs" readOnly value={created.url} onFocus={(e) => e.currentTarget.select()} />
                <Button type="button" variant="primary" onClick={() => void copy()}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copied ? 'Kopeeritud' : 'Kopeeri'}</span>
                </Button>
              </div>
            </div>
          )}

          <form className={keyRowClass} onSubmit={create}>
            <Input
              className="min-w-0 flex-1"
              placeholder="Võtme nimi (valikuline), nt Claude Desktop sülearvutis"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit" disabled={busy}>
              <Plus size={16} />
              <span>Loo uus võti</span>
            </Button>
          </form>

          <Table containerClassName="my-4">
            <TableHeader>
              <TableRow>
                <TableHead>Nimi</TableHead>
                <TableHead>Võti</TableHead>
                <TableHead className={hideNarrowClass}>Loodud</TableHead>
                <TableHead>Viimati kasutatud</TableHead>
                <TableHead actions><span className="sr-only">Tegevused</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys?.length === 0 && <TableEmpty colSpan={5}>Võtmeid pole</TableEmpty>}
              {keys?.map((k) => (
                <TableRow key={k.id}>
                  <TableCell wrap>{k.name}</TableCell>
                  <TableCell><code>{k.keyPrefix}…</code></TableCell>
                  <TableCell className={hideNarrowClass}>{formatDateTimeTallinn(k.createdAt)}</TableCell>
                  <TableCell>{formatDateTimeTallinn(k.lastUsedAt)}</TableCell>
                  <TableCell actions>
                    <Button type="button" variant="ghost" size="icon-sm" title="Tühista" aria-label={`Tühista ${k.name}`} onClick={() => void revoke(k)}>
                      <Trash2 size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="text-sm leading-natural">
            <strong>Kuidas ühendada</strong>
            <ol className="mt-1.5 ml-4">
              <li>Loo võti ja kopeeri link.</li>
              <li>Ava AI-kliendis connectorite seaded ja lisa uus MCP connector (nt Claude Desktop → Settings → Connectors → Add custom connector).</li>
              <li>Kleebi link URL-i väljale ja salvesta. Seejärel küsi AI-lt näiteks „Mis põllud mul tänavu on?“</li>
            </ol>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close}>Sulge</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
