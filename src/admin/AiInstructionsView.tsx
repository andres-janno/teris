// AI ühenduse juhis: tekst, mille MCP server saadab AI-kliendile ühenduse alguses (kõigile ettevõtetele ühine).
import { useEffect, useState } from 'react';
import { platformApi, type McpInstructions } from './platformApi.ts';
import { formatTallinn } from './format.ts';

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

  if (!data) return <div className="glass-card admin-card">{error || 'Laen…'}</div>;
  const dirty = draft !== data.value;

  return (
    <div className="glass-card admin-card">
      <h2>AI ühendus — juhis AI-le</h2>
      <p className="muted">
        Seda teksti näeb AI-klient (nt Claude) iga uue ühenduse alguses. Juhis on kõigile ettevõtetele ühine. Muudatus kehtib kasutaja järgmisest ühendusest.
      </p>
      <p className="muted">
        {data.isDefault ? 'Kehtib vaikejuhis (koodis).' : `Muudetud: ${data.updatedAt ? formatTallinn(data.updatedAt) : '–'}${data.updatedBy ? `, ${data.updatedBy}` : ''}`}
      </p>
      {error && <div className="alert-box error">{error}</div>}
      {notice && <div className="alert-box">{notice}</div>}
      <textarea
        className="form-input ai-instructions-input"
        value={draft}
        maxLength={data.maxLength}
        rows={22}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="ai-instructions-footer">
        <span className="muted num">{draft.length} / {data.maxLength}</span>
        <button type="button" className="btn btn-secondary" disabled={busy || data.isDefault} onClick={() => void run(() => platformApi.resetMcpInstructions(), 'Vaikejuhis taastatud')}>
          Taasta vaikejuhis
        </button>
        <button type="button" className="btn btn-primary" disabled={busy || !dirty || !draft.trim()} onClick={() => void run(() => platformApi.saveMcpInstructions(draft), 'Juhis salvestatud')}>
          Salvesta
        </button>
      </div>
    </div>
  );
}
