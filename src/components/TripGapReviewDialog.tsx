// src/components/TripGapReviewDialog.tsx — sõitude vahe hoiatuse kontrolli märge koos kohustusliku selgitusega.
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import type { TripGap } from '../types/fleet';
import { api } from '../services/api';
import { formatDateTime, formatDuration } from './fleetDateTime';
import { gapParts } from './tripGapText';

interface Props {
  gap: TripGap;
  onClose: () => void;
  onSaved: (gap: TripGap) => void;
}

export const TripGapReviewDialog: React.FC<Props> = ({ gap, onClose, onSaved }) => {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

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

  return createPortal(
    <div className="modal-backdrop sub-modal">
      <div className="modal-content fleet-edit-modal animate-scale-up">
        <div className="modal-header">
          <div className="modal-title-group">
            <AlertTriangle size={20} className="trip-gap-icon" />
            <h3>Märgi hoiatus kontrollituks</h3>
          </div>
          <button className="icon-btn-ghost" type="button" onClick={onClose} title="Sulge (Esc)"><X size={20} /></button>
        </div>
        <div className="modal-body">
          <p style={{ marginTop: 0 }}>
            Sõitude vahel {formatDateTime(gap.startedAt)} – {formatDateTime(gap.endedAt)} ({formatDuration(gap.startedAt, gap.endedAt)}):{' '}
            {gapParts(gap).join(' · ')}
          </p>
          <div className="form-group full-width">
            <label htmlFor="trip-gap-note">Selgitus</label>
            <textarea
              id="trip-gap-note" className="form-input" rows={3} value={note} autoFocus
              placeholder="nt tankisime kanistrist; traktor veeti treileriga remonti"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {error && <div className="auth-error-banner">{error}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Loobu</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !note.trim()}>Märgi kontrollituks</button>
        </div>
      </div>
    </div>,
    document.body
  );
};
