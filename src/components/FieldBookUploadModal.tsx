// src/components/FieldBookUploadModal.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, UploadCloud, FileSpreadsheet, Check, AlertCircle, RefreshCw, Lock } from 'lucide-react';
import type { MasterField } from '../types/fieldRegister';
import type { RelatedParty } from '../types/party';
import type { FarmingSeason } from '../types/season';
import type { FieldBookSheetResult } from '../types/fieldOperation';
import { parseFieldBookFile } from '../services/fieldBookWorkbook';
import { buildFieldBookImport } from '../services/fieldBookImport';
import { api } from '../services/api';
import { confirmDialog, alertDialog } from './ConfirmDialog';

interface FieldBookUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
  masterFields: MasterField[];
  parties: RelatedParty[];
  seasons: FarmingSeason[];
}

export const FieldBookUploadModal: React.FC<FieldBookUploadModalProps> = ({
  isOpen,
  onClose,
  onImported,
  masterFields,
  parties,
  seasons
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<FieldBookSheetResult[] | null>(null);
  const [operatorId, setOperatorId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const operators = parties.filter((p) => p.roles?.includes('OPERATOR'));

  useEffect(() => {
    if (isOpen) {
      setResults(null);
      setError(null);
      if (!operatorId && operators.length === 1) setOperatorId(operators[0].id);
    }
  }, [isOpen, operators.length]);

  const built = useMemo(
    () => (results && operatorId ? buildFieldBookImport(results, { masterFields, parties, seasons, operatorId }) : null),
    [results, operatorId, masterFields, parties, seasons]
  );

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setError(null);
    setResults(null);
    setIsProcessing(true);
    try {
      if (!/\.xlsx?$/i.test(file.name)) throw new Error('Palun vali e-PRIA põlluraamatu väljavõte (.xls või .xlsx).');
      setResults(parseFieldBookFile(await file.arrayBuffer()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Viga faili lugemisel.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = async () => {
    if (!built || built.payload.fields.length === 0) return;
    // Küsi kinnitust ainult siis, kui mõnel sobitunud hooajakirjel on juba töid, millega sobitatakse
    const n = built.rows.filter((r) => r.matched && r.existingWorksCount > 0).length;
    if (n > 0 && !await confirmDialog(`${n} põllul on sel hooajal juba töid.\n\nOlemasolevad tööd jäävad alles; sama tegevus ±2 päeva sees seotakse, muud lisatakse uute töödena. Jätkata?`)) return;
    setIsSaving(true);
    setError(null);
    try {
      const r = await api.importFieldBook(built.payload);
      onImported();
      onClose();
      const skippedText = r.skipped.length
        ? `\n\nVahele jäetud:\n${r.skipped.map((x) => `Nr ${x.num} (${x.season}): ${x.reason}`).join('\n')}`
        : '';
      const parts = [`${r.created} uut tööd`, `${r.complemented} täiendatud`];
      if (r.entriesAdded) parts.push(`neist ${r.entriesAdded} tööle lisati kanne`);
      if (r.linked) parts.push(`${r.linked} juba olemas`);
      if (r.movedToNext) parts.push(`${r.movedToNext} sügistööd järgmise hooaja alla`);
      if (r.unknown) parts.push(`${r.unknown} tundmatu tegevusega rida vahele jäetud`);
      void alertDialog(`Imporditud ${r.imported} põldu: ${parts.join(', ')}${skippedText}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import ebaõnnestus.');
    } finally {
      setIsSaving(false);
    }
  };

  const rows = built?.rows ?? [];
  const matched = rows.filter((r) => r.matched);
  const seasonsInFile = [...new Set(rows.map((r) => r.season).filter((y): y is number => y !== null))].sort();
  const lockedSeasons = [...new Set(rows.filter((r) => r.seasonLocked && r.season !== null).map((r) => r.season as number))];
  const unmatchedPerformers = [...new Set(rows.flatMap((r) => r.unmatchedPerformers))];
  const opsTotal = matched.reduce((n, r) => n + r.operationsCount, 0);

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-card animate-scale-up">
        <div className="modal-header">
          <div className="modal-title-group">
            <FileSpreadsheet className="text-emerald" size={24} />
            <div>
              <h3>Impordi põlluraamat</h3>
              <p className="modal-subtitle">e-PRIA "Põlluraamatu väljavõte" (.xls) — iga leht on üks põld</p>
            </div>
          </div>
          <button className="icon-btn-ghost" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div
            className={`dropzone ${isDragging ? 'dragging' : ''} ${results ? 'has-file' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            {isProcessing ? (
              <div className="dropzone-state">
                <RefreshCw size={36} className="animate-spin text-emerald" />
                <p>Loen põlluraamatut...</p>
              </div>
            ) : results ? (
              <div className="dropzone-state success">
                <FileSpreadsheet size={36} className="text-emerald" />
                <h4>{results.length} lehte loetud</h4>
                <span className="file-reupload-hint">Klõpsa siia uue faili valimiseks</span>
              </div>
            ) : (
              <div className="dropzone-state">
                <UploadCloud size={44} className="dropzone-icon" />
                <h4>Lohista põlluraamatu väljavõte siia</h4>
                <p>või klõpsa faili valimiseks arvutist</p>
              </div>
            )}
          </div>

          {error && (
            <div className="alert-box error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {results && (
            <div className="parsed-preview-box">
              <div className="form-group" style={{ margin: '8px 0' }}>
                <label>Operaator (kelle põldudega sobitatakse) *</label>
                <select className="form-input" value={operatorId} onChange={(e) => setOperatorId(e.target.value)}>
                  <option value="">-- Vali operaator --</option>
                  {operators.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {built && (
                <>
                  <div className="preview-header">
                    <strong>
                      {rows.length} põldu, hooaeg {seasonsInFile.join(', ')} · {matched.length} sobitatud · {opsTotal} tegevust
                      {unmatchedPerformers.length > 0 ? ` · ${unmatchedPerformers.length} sobitamata teostajat` : ''}
                    </strong>
                  </div>

                  {lockedSeasons.length > 0 && (
                    <div className="alert-box">
                      <Lock size={16} />
                      <span>Hooaeg {lockedSeasons.join(', ')} on lukus — nende põldude tööd jäetakse vahele.</span>
                    </div>
                  )}

                  {unmatchedPerformers.length > 0 && (
                    <div className="alert-box error">
                      <AlertCircle size={16} />
                      <span>
                        Seotud isikute registris puuduvad teostajad: {unmatchedPerformers.join(', ')}. Nende tegevused
                        imporditakse ilma teostajata — lisa isik registrisse ja impordi uuesti, kui soovid seost.
                      </span>
                    </div>
                  )}

                  <div className="preview-fields-scroll">
                    {rows.map((row) => (
                      <div key={row.sheetName} className="preview-field-row">
                        <div className="p-title">
                          <strong>
                            {row.matched ? '✓' : '✗'} Nr {row.num ?? row.sheetName}
                            {row.fieldName ? ` · ${row.fieldName}` : ''}
                          </strong>
                          <span className="p-crop">
                            {row.error
                              ? `Viga: ${row.error}`
                              : row.matched
                                ? `${row.fieldCode} · ${row.operationsCount} tegevust · ${row.productsCount} toodet · olemas ${row.existingWorksCount} tööd`
                                : `${row.fieldCode} · põldu selle operaatori ja hooajaga ei leitud — jäetakse vahele`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Loobu</button>
          {built && matched.length > 0 && (
            <button className="btn btn-primary" onClick={handleConfirm} disabled={isSaving}>
              {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
              <span>Impordi {matched.length} põllu tööd hooajale {seasonsInFile.join(', ')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
