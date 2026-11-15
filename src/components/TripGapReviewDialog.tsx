// src/components/TripGapReviewDialog.tsx — sõitude vahe hoiatuse kontrolli märge koos kohustusliku selgitusega.
import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { TripGap } from '../types/fleet';
import { api } from '../services/api';
import { formatDateTime, formatDuration } from './fleetDateTime';
import { gapParts } from './tripGapText';
import { Button, Field, Textarea, Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter } from './ui';

interface Props {
  gap: TripGap;
  onClose: () => void;
  onSaved: (gap: TripGap) => void;
}

export const TripGapReviewDialog: React.FC<Props> = ({ gap, onClose, onSaved }) => {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      onSaved(await api.reviewTripGap(gap.id, true, note.trim()));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="lg" className="fleet-edit-modal" dismissible={!saving}>
        <DialogHeader icon={<AlertTriangle size={20} className="trip-gap-icon" />} title="Märgi hoiatus kontrollituks" />
        <DialogBody>
          <p style={{ marginTop: 0 }}>
            Sõitude vahel {formatDateTime(gap.startedAt)} – {formatDateTime(gap.endedAt)} ({formatDuration(gap.startedAt, gap.endedAt)}):{' '}
            {gapParts(gap).join(' · ')}
          </p>
          <Field label="Selgitus" htmlFor="trip-gap-note" span="full">
            <Textarea
              id="trip-gap-note" rows={3} value={note} autoFocus
              placeholder="nt tankisime kanistrist; traktor veeti treileriga remonti"
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          {error && <div className="auth-error-banner">{error}</div>}
        </DialogBody>
        <DialogFooter>
          <Button type="button" onClick={onClose} disabled={saving}>Loobu</Button>
          <Button type="button" variant="primary" onClick={save} disabled={saving || !note.trim()}>Märgi kontrollituks</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
