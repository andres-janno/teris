// AI ühenduse juhis: tekst, mille MCP server saadab AI-kliendile ühenduse alguses (kõigile ettevõtetele ühine).
import { Alert, Card, Button, Textarea } from '../components/ui';
import { useEffect, useState } from 'react';
import { platformApi, type McpInstructions } from './platformApi.ts';
import { formatTallinn } from './format.ts';
import { adminCardClass, adminH2Class } from './adminUi.ts';

export function AiInstructionsView() {
  const [data, setData] = useState<McpInstructions | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const apply = (d: McpInstructions) => {
    setData(d);
    setDraft(d.value);
  };

  useEffect(() => {
    platformApi.getMcpInstructions().then(apply).catch((err) => setError((err as Error).message));
  }, []);

  const run = async (fn: () => Promise<McpInstructions>, done: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      apply(await fn());
      setNotice(done);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <Card className={adminCardClass}>{error || 'Laen…'}</Card>;
  const dirty = draft !== data.value;

  return (
    <Card className={adminCardClass}>
      <h2 className={adminH2Class}>AI ühendus — juhis AI-le</h2>
      <p>
        Seda teksti näeb AI-klient (nt Claude) iga uue ühenduse alguses. Juhis on kõigile ettevõtetele ühine. Muudatus kehtib kasutaja järgmisest ühendusest.
      </p>
      <p>
        {data.isDefault ? 'Kehtib vaikejuhis (koodis).' : `Muudetud: ${data.updatedAt ? formatTallinn(data.updatedAt) : '–'}${data.updatedBy ? `, ${data.updatedBy}` : ''}`}
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert>{notice}</Alert>}
      <Textarea
        className="mt-4 resize-y font-mono text-sm leading-normal"
        value={draft}
        maxLength={data.maxLength}
        rows={22}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="mt-3 flex items-center justify-end gap-2">
        <span className="num mr-auto tabular-nums">{draft.length} / {data.maxLength}</span>
        <Button disabled={busy || data.isDefault} onClick={() => void run(() => platformApi.resetMcpInstructions(), 'Vaikejuhis taastatud')}>
          Taasta vaikejuhis
        </Button>
        <Button variant="primary" disabled={busy || !dirty || !draft.trim()} onClick={() => void run(() => platformApi.saveMcpInstructions(draft), 'Juhis salvestatud')}>
          Salvesta
        </Button>
      </div>
    </Card>
  );
}
