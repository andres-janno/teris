// src/components/FieldWorkPlanDialog.tsx — töö (plaani) lisamine ja muutmine hüpikaknas; vorm ise on FieldWorkPlanForm.
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { FieldWork, Article, WorkType } from '../types/fieldWork';
import { FieldWorkPlanForm } from './FieldWorkPlanForm';

interface FieldWorkPlanDialogProps {
  fieldSeasonId: number;
  fieldLabel: string;
  fieldAreaHa: number;
  work: FieldWork | null; // null = uus töö
  workTypes: WorkType[];
  articles: Article[];
  workers: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}

export const FieldWorkPlanDialog: React.FC<FieldWorkPlanDialogProps> = ({ fieldSeasonId, fieldLabel, fieldAreaHa, work, workTypes, articles, workers, onClose, onSaved }) => {
  // Esc sulgeb ainult selle dialoogi (capture-faasis, enne täisvaate Esc-käsitlejat)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop sub-modal">
      <div className="modal-content animate-scale-up work-entry-modal">
        <div className="modal-header">
          <div>
            <h3>{work ? `Muuda tööd: ${work.workTypeName}` : 'Lisa töö'}</h3>
            <p className="modal-subtitle">{fieldLabel}</p>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose} title="Sulge (Esc)"><X size={20} /></button>
        </div>
        <FieldWorkPlanForm
          fieldSeasonId={fieldSeasonId}
          fieldAreaHa={fieldAreaHa}
          work={work}
          workTypes={workTypes}
          articles={articles}
          workers={workers}
          mode="edit"
          layout="dialog"
          onSaved={onSaved}
          onCancel={onClose}
        />
      </div>
    </div>,
    document.body
  );
};
