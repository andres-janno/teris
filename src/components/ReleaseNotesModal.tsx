// src/components/ReleaseNotesModal.tsx — kliendirakenduse „Uuendused“ (release notes) vaade.
import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  CheckboxField,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader
} from './ui';
import {
  RELEASE_NOTE_CATEGORIES,
  RELEASE_NOTE_CATEGORY_LABELS,
  type ClientReleaseNote,
  type ReleaseNoteCategory
} from '../types/releaseNotes';

interface ReleaseNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  releases: ClientReleaseNote[];
  loading: boolean;
  receiveReleaseNotes: boolean;
  readOnly?: boolean;
  onToggleEmailPreference: (next: boolean) => Promise<void>;
}

const CATEGORY_TONE: Record<ReleaseNoteCategory, 'success' | 'info' | 'warning'> = {
  FEATURE: 'success',
  IMPROVEMENT: 'info',
  FIX: 'warning'
};

function formatDateEt(iso: string): string {
  try {
    return new Intl.DateTimeFormat('et-EE', {
      timeZone: 'Europe/Tallinn',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export const ReleaseNotesModal: React.FC<ReleaseNotesModalProps> = ({
  isOpen,
  onClose,
  releases,
  loading,
  receiveReleaseNotes,
  readOnly = false,
  onToggleEmailPreference
}) => {
  const [savingPref, setSavingPref] = useState(false);
  const [prefError, setPrefError] = useState('');

  const handleToggle = async (checked: boolean) => {
    setSavingPref(true);
    setPrefError('');
    try {
      await onToggleEmailPreference(checked);
    } catch (err) {
      setPrefError((err as Error).message || 'Eelistuse salvestamine ebaõnnestus');
    } finally {
      setSavingPref(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader title="TERIS uuendused" icon={<Sparkles size={18} />} />

        <DialogBody className="max-h-[68vh] space-y-6 overflow-y-auto">
          {prefError && <Alert tone="error">{prefError}</Alert>}
          {loading ? (
            <p className="text-sm text-muted-foreground">Laadin uuendusi…</p>
          ) : releases.length === 0 ? (
            <p className="text-sm text-muted-foreground">Avaldatud uuendusi veel pole.</p>
          ) : (
            releases.map((rel) => {
              const groups = RELEASE_NOTE_CATEGORIES.map((cat) => ({
                category: cat,
                label: RELEASE_NOTE_CATEGORY_LABELS[cat].plural,
                items: rel.items.filter((i) => i.category === cat)
              })).filter((g) => g.items.length > 0);

              return (
                <article key={rel.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge tone="success" variant="soft">{rel.version}</Badge>
                      <h3 className="text-base font-semibold text-foreground">{rel.title}</h3>
                    </div>
                    <time className="text-xs text-muted-foreground">{formatDateEt(rel.publishedAt)}</time>
                  </div>

                  {rel.summary && (
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                      {rel.summary}
                    </p>
                  )}

                  {groups.length > 0 && (
                    <div className="mt-3 space-y-3">
                      {groups.map((g) => (
                        <div key={g.category}>
                          <Badge tone={CATEGORY_TONE[g.category]} variant="soft" className="mb-1.5">
                            {g.label}
                          </Badge>
                          <ul className="list-disc space-y-1 pl-4 text-sm leading-relaxed text-foreground">
                            {g.items.map((it) => (
                              <li key={it.id}>
                                {it.area && <strong className="font-medium">{it.area}: </strong>}
                                {it.text}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </DialogBody>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-3">
          {!readOnly ? (
            <CheckboxField
              checked={receiveReleaseNotes}
              disabled={savingPref}
              onCheckedChange={(v) => void handleToggle(v === true)}
              label="Teavita mind uutest versioonidest e-postiga"
            />
          ) : (
            <span />
          )}
          <Button variant="primary" onClick={onClose}>Sulge</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
