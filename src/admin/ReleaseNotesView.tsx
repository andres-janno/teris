// src/admin/ReleaseNotesView.tsx — teenusepakkuja admini vaade väljalaske märkmete (release notes) haldamiseks.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, Mail, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import { platformApi, type PlatformReleaseNoteRow } from './platformApi.ts';
import { formatTallinn } from './format.ts';
import { Alert, Badge, Button, Card, CardButton, CheckboxField, Input, Select, Textarea } from '../components/ui';
import { cn } from '../components/ui/cn';
import {
  adminCardClass,
  adminCardFootClass,
  adminFieldLabelClass,
  adminH2FlushClass,
  adminHintClass,
  adminMutedClass,
  adminToolbarClass
} from './adminUi.ts';
import {
  RELEASE_NOTE_AUDIENCE_LABELS,
  RELEASE_NOTE_CATEGORIES,
  RELEASE_NOTE_CATEGORY_LABELS,
  RELEASE_NOTE_STATUS_LABELS,
  type ReleaseNoteAudience,
  type ReleaseNoteCategory,
  type ReleaseNoteItem
} from '../types/releaseNotes.ts';

function todayVersion(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Tallinn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${g('year')}.${g('month')}.${g('day')}`;
}

function newItem(category: ReleaseNoteCategory = 'FEATURE'): ReleaseNoteItem {
  return {
    id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    category,
    area: '',
    text: ''
  };
}

const CATEGORY_TONE: Record<ReleaseNoteCategory, 'success' | 'info' | 'warning'> = {
  FEATURE: 'success',
  IMPROVEMENT: 'info',
  FIX: 'warning'
};

export function ReleaseNotesView() {
  const [rows, setRows] = useState<PlatformReleaseNoteRow[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // Redaktori väljad
  const [version, setVersion] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [items, setItems] = useState<ReleaseNoteItem[]>([]);
  const [previewMode, setPreviewMode] = useState(false);

  // Avaldamise ja e-kirja valikud
  const [audience, setAudience] = useState<ReleaseNoteAudience>('ALL_ACTIVE_USERS');
  const [sendEmailOnPublish, setSendEmailOnPublish] = useState(true);
  const [testEmail, setTestEmail] = useState('');
  const [showCommits, setShowCommits] = useState(false);

  const load = useCallback(async (keepId?: string | null) => {
    try {
      const list = await platformApi.listReleaseNotes();
      setRows(list);
      setError('');
      const targetId = keepId !== undefined ? keepId : selectedId;
      const found = list.find((r) => r.id === targetId) ?? list[0] ?? null;
      if (found) {
        setSelectedId(found.id);
        setVersion(found.version);
        setTitle(found.title);
        setSummary(found.summary ?? '');
        setItems(found.items.map((i) => ({ ...i })));
        setAudience(found.emailAudience ?? 'ALL_ACTIVE_USERS');
      } else {
        setSelectedId(null);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = useMemo(() => rows?.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const selectRow = (row: PlatformReleaseNoteRow) => {
    setSelectedId(row.id);
    setVersion(row.version);
    setTitle(row.title);
    setSummary(row.summary ?? '');
    setItems(row.items.map((i) => ({ ...i })));
    setAudience(row.emailAudience ?? 'ALL_ACTIVE_USERS');
    setPreviewMode(false);
    setShowCommits(false);
    setNotice('');
    setError('');
  };

  const dirty = useMemo(() => {
    if (!current) return false;
    return (
      version.trim() !== current.version ||
      title.trim() !== current.title ||
      summary.trim() !== (current.summary ?? '') ||
      JSON.stringify(items) !== JSON.stringify(current.items)
    );
  }, [current, version, title, summary, items]);

  const handleCreateDraft = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const base = todayVersion();
      const existingVersions = new Set((rows ?? []).map((r) => r.version));
      let nextVer = base;
      for (let i = 2; existingVersions.has(nextVer) && i < 50; i++) nextVer = `${base}-${i}`;
      const created = await platformApi.createReleaseNote({
        version: nextVer,
        title: `TERIS uuendused ${nextVer}`,
        summary: '',
        items: [newItem('FEATURE')]
      });
      await load(created.id);
      setNotice(`Mustand ${created.version} loodud.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!current) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const cleaned = items.filter((i) => i.text.trim() !== '');
      const updated = await platformApi.updateReleaseNote(current.id, {
        version: version.trim(),
        title: title.trim(),
        summary: summary.trim() || null,
        items: cleaned
      });
      await load(updated.id);
      setNotice('Muudatused salvestatud.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!current || current.status !== 'DRAFT') return;
    if (!window.confirm(`Kustutada mustand ${current.version}?`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await platformApi.deleteReleaseNote(current.id);
      await load(null);
      setNotice(`Mustand ${current.version} kustutatud.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = async () => {
    if (!current) return;
    if (dirty) {
      setError('Salvesta muudatused enne avaldamist.');
      return;
    }
    const emailMsg = sendEmailOnPublish
      ? `ja panna e-kirjad saatmisjärjekorda (${RELEASE_NOTE_AUDIENCE_LABELS[audience]})`
      : '(ilma e-kirja saatmata)';
    if (!window.confirm(`Avaldada versioon ${current.version} klientidele ${emailMsg}?`)) return;

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await platformApi.publishReleaseNote(current.id, {
        sendEmail: sendEmailOnPublish,
        audience
      });
      await load(res.row.id);
      setNotice(
        sendEmailOnPublish
          ? `Versioon ${res.row.version} avaldatud. E-kirja järjekorda lisatud ${res.queued} saajat.`
          : `Versioon ${res.row.version} avaldatud rakenduses.`
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleSendEmailsNow = async () => {
    if (!current) return;
    if (!window.confirm(`Saata versiooni ${current.version} e-kiri (${RELEASE_NOTE_AUDIENCE_LABELS[audience]})?`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await platformApi.sendReleaseNoteEmail(current.id, audience);
      await load(res.row.id);
      setNotice(`E-kirja järjekorda lisatud ${res.queued} saajat.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleRetryFailed = async () => {
    if (!current) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await platformApi.retryFailedReleaseNoteEmails(current.id);
      await load(res.row.id);
      setNotice(`Uuesti järjekorda pandud ${res.retried} ebaõnnestunud kirja.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleSendTest = async () => {
    if (!current) return;
    if (!testEmail.trim()) {
      setError('Sisesta testkirja e-posti aadress.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await platformApi.sendTestReleaseNoteEmail(current.id, testEmail.trim());
      setNotice(`Testkiri saadetud aadressile ${res.to}.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const updateItem = (idx: number, patch: Partial<ReleaseNoteItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    setItems((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return copy;
    });
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const groupedPreview = useMemo(
    () =>
      RELEASE_NOTE_CATEGORIES.map((cat) => ({
        category: cat,
        label: RELEASE_NOTE_CATEGORY_LABELS[cat].plural,
        items: items.filter((i) => i.category === cat && i.text.trim() !== '')
      })).filter((g) => g.items.length > 0),
    [items]
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
      {/* Vasak paan: versioonide nimekiri */}
      <Card className={adminCardClass}>
        <div className={cn(adminToolbarClass, 'mb-3 justify-between')}>
          <h2 className={adminH2FlushClass}>Uuendused</h2>
          <Button size="sm" variant="primary" disabled={busy} onClick={() => void handleCreateDraft()}>
            <Plus size={14} /> Uus mustand
          </Button>
        </div>

        {!rows ? (
          <p className={adminMutedClass}>Laadin…</p>
        ) : rows.length === 0 ? (
          <p className={adminMutedClass}>Ühtegi väljalaset veel pole. Loo mustand siit või käivita `npm run release:draft`.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((r) => (
              <CardButton
                key={r.id}
                onClick={() => selectRow(r)}
                className={cn(
                  'w-full text-left',
                  r.id === selectedId && 'border-primary bg-primary/5'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">{r.version}</span>
                  <Badge tone={r.status === 'PUBLISHED' ? 'success' : 'warning'} variant="soft">
                    {RELEASE_NOTE_STATUS_LABELS[r.status]}
                  </Badge>
                </div>
                <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.title}</div>
                <div className="mt-1.5 flex items-center justify-between text-xs text-subtle">
                  <span>{r.publishedAt ? formatTallinn(r.publishedAt) : formatTallinn(r.updatedAt)}</span>
                  {r.deliveryCounts.total > 0 && (
                    <span>
                      Kirjad: {r.deliveryCounts.sent}/{r.deliveryCounts.total}
                      {r.deliveryCounts.failed > 0 ? ` (vigu ${r.deliveryCounts.failed})` : ''}
                    </span>
                  )}
                </div>
              </CardButton>
            ))}
          </div>
        )}
      </Card>

      {/* Parem paan: redaktor ja avaldamine */}
      <Card className={adminCardClass}>
        {error && <Alert tone="error" className="mb-3">{error}</Alert>}
        {notice && <Alert tone="success" className="mb-3">{notice}</Alert>}

        {!current ? (
          <p className={adminMutedClass}>Vali vasakult väljalase või loo uus mustand.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <h2 className={adminH2FlushClass}>Versioon {current.version}</h2>
                <Badge tone={current.status === 'PUBLISHED' ? 'success' : 'warning'} variant="soft">
                  {RELEASE_NOTE_STATUS_LABELS[current.status]}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => setPreviewMode((p) => !p)}>
                  <Eye size={14} /> {previewMode ? 'Tagasi redaktorisse' : 'Eelvaade'}
                </Button>
                <Button size="sm" variant="primary" disabled={busy || !dirty} onClick={() => void handleSave()}>
                  Salvesta
                </Button>
                {current.status === 'DRAFT' && (
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => void handleDelete()}>
                    <Trash2 size={14} /> Kustuta
                  </Button>
                )}
              </div>
            </div>

            {previewMode ? (
              <div className="rounded-lg border border-border bg-muted/30 p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Versioon {version}
                </div>
                <h3 className="mt-1 text-xl font-semibold text-foreground">{title}</h3>
                {summary.trim() && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{summary}</p>}
                {groupedPreview.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">Muudatuse punkte veel pole.</p>
                ) : (
                  <div className="mt-4 flex flex-col gap-4">
                    {groupedPreview.map((g) => (
                      <div key={g.category}>
                        <div className="mb-2 flex items-center gap-2">
                          <Badge tone={CATEGORY_TONE[g.category]} variant="soft">{g.label}</Badge>
                        </div>
                        <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
                          {g.items.map((it) => (
                            <li key={it.id}>
                              {it.area?.trim() && <strong className="font-semibold">{it.area.trim()}: </strong>}
                              {it.text}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr]">
                  <div>
                    <label className={adminFieldLabelClass}>Versioon</label>
                    <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="2026.11.24" />
                  </div>
                  <div>
                    <label className={adminFieldLabelClass}>Pealkiri</label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Novembri uuendused" />
                  </div>
                </div>

                <div>
                  <label className={adminFieldLabelClass}>Lühike sissejuhatus (valikuline)</label>
                  <Textarea
                    rows={2}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Lühike kokkuvõte sellest, mis selles versioonis peamiselt paranes."
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className={adminFieldLabelClass}>Muudatused ({items.length})</label>
                    <Button size="sm" variant="secondary" onClick={() => setItems((prev) => [...prev, newItem('FEATURE')])}>
                      <Plus size={14} /> Lisa punkt
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.map((it, idx) => (
                      <div key={it.id} className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-muted/20 p-2.5 sm:grid-cols-[155px_130px_1fr_auto]">
                        <Select
                          value={it.category}
                          onValueChange={(v) => updateItem(idx, { category: v as ReleaseNoteCategory })}
                          options={RELEASE_NOTE_CATEGORIES.map((c) => ({
                            value: c,
                            label: RELEASE_NOTE_CATEGORY_LABELS[c].singular
                          }))}
                        />
                        <Input
                          value={it.area ?? ''}
                          onChange={(e) => updateItem(idx, { area: e.target.value })}
                          placeholder="Valdkond (nt Ladu)"
                        />
                        <Input
                          value={it.text}
                          onChange={(e) => updateItem(idx, { text: e.target.value })}
                          placeholder="Inimkeelne kirjeldus kliendile..."
                        />
                        <div className="flex items-center gap-1">
                          <Button size="icon-sm" variant="ghost" title="Liiguta üles" disabled={idx === 0} onClick={() => moveItem(idx, -1)}>
                            <ArrowUp size={14} />
                          </Button>
                          <Button size="icon-sm" variant="ghost" title="Liiguta alla" disabled={idx === items.length - 1} onClick={() => moveItem(idx, 1)}>
                            <ArrowDown size={14} />
                          </Button>
                          <Button size="icon-sm" variant="ghost" title="Eemalda" onClick={() => removeItem(idx)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Seotud commitid (kui mustand loodi skriptiga) */}
            {current.sourceCommits.length > 0 && (
              <div className="rounded-lg border border-border p-3">
                <button
                  type="button"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setShowCommits((s) => !s)}
                >
                  {showCommits ? '▼' : '▶'} Seotud git commitid ({current.sourceCommits.length}
                  {current.fromCommit || current.toCommit ? ` • ${current.fromCommit ?? '…'} → ${current.toCommit ?? 'HEAD'}` : ''})
                </button>
                {showCommits && (
                  <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto font-mono text-xs text-muted-foreground">
                    {current.sourceCommits.map((c) => (
                      <li key={c.hash}>
                        <span className="text-foreground">{c.hash}</span> {c.date ? `[${c.date}] ` : ''}{c.subject}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Testkiri */}
            <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
              <div className="min-w-60 flex-1">
                <label className={adminFieldLabelClass}>Saada testkiri enne avaldamist</label>
                <Input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="sinu@email.ee"
                />
              </div>
              <Button size="sm" variant="secondary" disabled={busy || dirty} onClick={() => void handleSendTest()}>
                <Mail size={14} /> Saada testkiri
              </Button>
            </div>

            {/* Avaldamine ja e-kirjade saatmine */}
            <div className={cn(adminCardFootClass, 'flex-col items-stretch gap-3')}>
              {current.status === 'DRAFT' ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-4">
                    <CheckboxField
                      checked={sendEmailOnPublish}
                      onCheckedChange={(v) => setSendEmailOnPublish(v === true)}
                      label="Saada avaldamisel ka e-kiri"
                    />
                    {sendEmailOnPublish && (
                      <div className="w-64">
                        <Select
                          value={audience}
                          onValueChange={(v) => setAudience(v as ReleaseNoteAudience)}
                          options={[
                            { value: 'ALL_ACTIVE_USERS', label: RELEASE_NOTE_AUDIENCE_LABELS.ALL_ACTIVE_USERS },
                            { value: 'TENANT_ADMINS', label: RELEASE_NOTE_AUDIENCE_LABELS.TENANT_ADMINS }
                          ]}
                        />
                      </div>
                    )}
                  </div>
                  <Button variant="primary" disabled={busy || dirty} onClick={() => void handlePublish()}>
                    <Send size={14} /> Avalda klientidele
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    <div>
                      Avaldatud: <strong className="text-foreground">{current.publishedAt ? formatTallinn(current.publishedAt) : '—'}</strong>
                      {current.publishedBy ? ` (${current.publishedBy})` : ''}
                    </div>
                    <div className="mt-0.5">
                      E-kirjad: saadetud <strong>{current.deliveryCounts.sent}</strong> / {current.deliveryCounts.total}
                      {current.deliveryCounts.pending > 0 ? `, ootel ${current.deliveryCounts.pending}` : ''}
                      {current.deliveryCounts.failed > 0 ? `, ebaõnnestunud ${current.deliveryCounts.failed}` : ''}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-60">
                      <Select
                        value={audience}
                        onValueChange={(v) => setAudience(v as ReleaseNoteAudience)}
                        options={[
                          { value: 'ALL_ACTIVE_USERS', label: RELEASE_NOTE_AUDIENCE_LABELS.ALL_ACTIVE_USERS },
                          { value: 'TENANT_ADMINS', label: RELEASE_NOTE_AUDIENCE_LABELS.TENANT_ADMINS }
                        ]}
                      />
                    </div>
                    <Button size="sm" variant="primary" disabled={busy} onClick={() => void handleSendEmailsNow()}>
                      <Send size={14} /> {current.deliveryCounts.total > 0 ? 'Saada uutele saajatele' : 'Saada e-kiri'}
                    </Button>
                    {current.deliveryCounts.failed > 0 && (
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => void handleRetryFailed()}>
                        <RefreshCw size={14} /> Proovi vigu uuesti ({current.deliveryCounts.failed})
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void load(current.id)}>
                      <RefreshCw size={14} /> Värskenda
                    </Button>
                  </div>
                </div>
              )}
              {dirty && <p className={adminHintClass}>Sul on salvestamata muudatused — salvesta enne testkirja või avaldamist.</p>}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
