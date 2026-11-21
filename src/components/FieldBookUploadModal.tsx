// src/components/FieldBookUploadModal.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UploadCloud, FileSpreadsheet, Check, AlertCircle, RefreshCw, Lock } from 'lucide-react';
import type { MasterField } from '../types/fieldRegister';
import type { RelatedParty } from '../types/party';
import type { FarmingSeason } from '../types/season';
import type { FieldBookSheetResult } from '../types/fieldOperation';
import { parseFieldBookFile } from '../services/fieldBookWorkbook';
import { buildFieldBookImport } from '../services/fieldBookImport';
import { api } from '../services/api';
import { confirmDialog, alertDialog } from './ConfirmDialog';
import {
  Alert, Button, Card, CheckboxField, Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, Dropzone, Field, Select,
  dropzoneIconClass, dropzoneStateClass, fileReuploadHintClass, previewBoxClass, previewCropClass, previewFieldClass, previewFieldRowClass, previewFieldsScrollClass, previewHeaderClass,
} from './ui';

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
  const [createPerformers, setCreatePerformers] = useState(true); // puuduvad teostajad lisatakse töötajana
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
    () => (results && operatorId ? buildFieldBookImport(results, { masterFields, parties, seasons, operatorId, createMissingPerformers: createPerformers }) : null),
    [results, operatorId, masterFields, parties, seasons, createPerformers]
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
      onImported(); // värskendab ka isikute loendi (uued teostajad)
      onClose();
      const skippedText = r.skipped.length
        ? `\n\nVahele jäetud:\n${r.skipped.map((x) => `Nr ${x.num} (${x.season}): ${x.reason}`).join('\n')}`
        : '';
      const parts = [`${r.created} uut tööd`, `${r.complemented} täiendatud`];
      if (r.entriesAdded) parts.push(`neist ${r.entriesAdded} tööle lisati kanne`);
      if (r.linked) parts.push(`${r.linked} juba olemas`);
      if (r.movedToNext) parts.push(`${r.movedToNext} sügistööd järgmise hooaja alla`);
      if (r.unknown) parts.push(`${r.unknown} tundmatu tegevusega rida vahele jäetud`);
      if (r.partiesCreated) parts.push(`isikute registrisse lisati ${r.partiesCreated} töötajat`);
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="md" dismissible={!isSaving && !isProcessing}>
        <DialogHeader
          icon={<FileSpreadsheet size={24} />}
          title="Impordi põlluraamat"
          description={'e-PRIA "Põlluraamatu väljavõte" (.xls) — iga leht on üks põld'}
        />
        <DialogBody>
          <Dropzone
            dragging={isDragging}
            hasFile={!!results}
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
              type="file"
              ref={fileInputRef}
              accept=".xls,.xlsx"
              hidden
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            {isProcessing ? (
              <div className={dropzoneStateClass}>
                <RefreshCw size={36} className="animate-spin" />
                <p>Loen põlluraamatut...</p>
              </div>
            ) : results ? (
              <div className={dropzoneStateClass}>
                <FileSpreadsheet size={36} />
                <h4>{results.length} lehte loetud</h4>
                <span className={fileReuploadHintClass}>Klõpsa siia uue faili valimiseks</span>
              </div>
            ) : (
              <div className={dropzoneStateClass}>
                <UploadCloud size={44} className={dropzoneIconClass} />
                <h4>Lohista põlluraamatu väljavõte siia</h4>
                <p>või klõpsa faili valimiseks arvutist</p>
              </div>
            )}
          </Dropzone>

          {error && (
            <Alert tone="error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </Alert>
          )}

          {results && (
            <Card variant="tile" padding="sm" className={previewBoxClass}>
              <Field label="Operaator (kelle põldudega sobitatakse) *" htmlFor="fb-operator" className={previewFieldClass}>
                <Select id="fb-operator" placeholder="-- Vali operaator --" value={operatorId} onValueChange={setOperatorId}
                  options={operators.map((p) => ({ value: p.id, label: p.name }))} />
              </Field>

              {built && (
                <>
                  <div className={previewHeaderClass}>
                    <strong>
                      {rows.length} põldu, hooaeg {seasonsInFile.join(', ')} · {matched.length} sobitatud · {opsTotal} tegevust
                      {unmatchedPerformers.length > 0 ? ` · ${unmatchedPerformers.length} sobitamata teostajat` : ''}
                    </strong>
                  </div>

                  {lockedSeasons.length > 0 && (
                    <Alert>
                      <Lock size={16} />
                      <span>Hooaeg {lockedSeasons.join(', ')} on lukus — nende põldude tööd jäetakse vahele.</span>
                    </Alert>
                  )}

                  {unmatchedPerformers.length > 0 && (
                    <>
                      <CheckboxField
                        checked={createPerformers}
                        onCheckedChange={setCreatePerformers}
                        disabled={isSaving}
                        label={`Lisa puuduvad teostajad isikute registrisse töötajana (${unmatchedPerformers.length} inimest)`}
                        hint={unmatchedPerformers.join(', ')}
                      />
                      {!createPerformers && (
                        <p className="text-2xs text-subtle">
                          Märkimata jättes imporditakse nende tegevused ilma teostajata (nimi läheb töö märkusesse).
                        </p>
                      )}
                    </>
                  )}

                  <div className={previewFieldsScrollClass}>
                    {rows.map((row) => (
                      <div key={row.sheetName} className={previewFieldRowClass}>
                        <div>
                          <strong>
                            {row.matched ? '✓' : '✗'} Nr {row.num ?? row.sheetName}
                            {row.fieldName ? ` · ${row.fieldName}` : ''}
                          </strong>
                          <span className={previewCropClass}>
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
            </Card>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Loobu</Button>
          {built && matched.length > 0 && (
            <Button variant="primary" onClick={handleConfirm} disabled={isSaving}>
              {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
              <span>Impordi {matched.length} põllu tööd hooajale {seasonsInFile.join(', ')}</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
