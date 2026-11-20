// src/components/FieldUploadModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  FileArchive, 
  Check, 
  AlertCircle, 
  RefreshCw
} from 'lucide-react';
import type { FieldCollection } from '../types/field';
import type { RelatedParty } from '../types/party';
import type { MasterField } from '../types/fieldRegister';
import type { FarmingSeason } from '../types/season';
import { planYearReplacement } from '../services/fieldYearReplace';
import { matchImportedFields } from '../services/fieldIdentity';
import { parseShapefileZip } from '../services/shpParser';
import { confirmDialog } from './ConfirmDialog';
import {
  Alert, Badge, Button, Card, Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, CheckboxField, Dropzone, Field, Select,
  dropzoneIconClass, dropzoneStateClass, fileReuploadHintClass, hintTextBlockClass, hintTextClass, previewBoxClass, previewCropClass, previewFieldClass, previewFieldRowClass,
  previewFieldsScrollClass, previewHeaderClass, previewValueClass, uploadFormatListClass,
} from './ui';

// PRIA põldude failis pole hooaja veergu; "muudetud" (pp.kk.aaaa) on põllu
// viimase muutmise kuupäev PRIA-s ja langeb enamasti hooaja aastasse.
// Tagastame kõige sagedasema aasta vihjeks — kasutaja kinnitab.
function detectSeasonYear(collection: FieldCollection): { year: number; count: number; total: number } | null {
  const counts = new Map<number, number>();
  let total = 0;
  for (const f of collection.features) {
    const raw = f.properties.rawProperties || {};
    const key = Object.keys(raw).find((k) => k.toLowerCase() === 'muudetud');
    const match = key ? String(raw[key] ?? '').match(/(\d{4})\s*$/) : null;
    if (!match) continue;
    const y = Number(match[1]);
    counts.set(y, (counts.get(y) || 0) + 1);
    total++;
  }
  let best: { year: number; count: number } | null = null;
  counts.forEach((count, year) => {
    if (!best || count > best.count) best = { year, count };
  });
  return best ? { ...(best as { year: number; count: number }), total } : null;
}

interface FieldUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFieldsImported: (newFields: FieldCollection, replace: boolean, operatorId: string | undefined, year: number) => void;
  parties?: RelatedParty[];
  masterFields?: MasterField[];
  seasons?: FarmingSeason[];
  availableYears?: number[];
  defaultYear: number;
}

export const FieldUploadModal: React.FC<FieldUploadModalProps> = ({
  isOpen,
  onClose,
  onFieldsImported,
  parties = [],
  masterFields = [],
  seasons = [],
  availableYears = [],
  defaultYear
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<FieldCollection | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [operatorId, setOperatorId] = useState<string>('');
  const [importYear, setImportYear] = useState<number>(defaultYear);
  const [detectedYear, setDetectedYear] = useState<{ year: number; count: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PRIA failis aastat pole (failinimi on allalaadimise kuupäev), seega
  // aasta valitakse igal avamisel uuesti, vaikimisi kaardil valitud aasta.
  useEffect(() => {
    if (isOpen) {
      setImportYear(defaultYear);
      setDetectedYear(null);
    }
  }, [isOpen, defaultYear]);

  const operators = parties.filter((p) => p.roles?.includes('OPERATOR'));

  useEffect(() => {
    if (isOpen && !operatorId && operators.length === 1) {
      setOperatorId(operators[0].id);
    }
  }, [isOpen, operators.length]);

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    setError(null);
    setIsProcessing(true);
    try {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        throw new Error('Palun vali .ZIP arhiiv, mis sisaldab PRIA .shp, .dbf ja .prj faile.');
      }

      const arrayBuffer = await file.arrayBuffer();
      const collection = await parseShapefileZip(arrayBuffer, file.name);

      if (!collection.features || collection.features.length === 0) {
        throw new Error('ZIP arhiivis ei leitud sobivaid polügoongeomeetriaid.');
      }

      setParsedPreview(collection);

      const detected = detectSeasonYear(collection);
      setDetectedYear(detected);
      if (detected) setImportYear(detected.year);
    } catch (err: any) {
      console.error('Shapefile parsing error:', err);
      setError(err.message || 'Viga faili töötlemisel. Kontrolli, et tegemist on korrektse Shapefile ZIP arhiiviga.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  // "Asenda" eelvaade: failis olevate põldude vasted (sama reegel nagu impordil) jäävad,
  // ülejäänud ulatusse jäävad põllud kaotavad valitud aasta kirje; töödega jäetakse alles.
  const importYearLocked = seasons.some((x) => x.year === importYear && x.isLocked);
  const replacePlan = parsedPreview && replaceExisting
    ? planYearReplacement(
        masterFields,
        importYear,
        operatorId || undefined,
        matchImportedFields(masterFields, parsedPreview.features.map((f) => ({ fieldCode: String(f.properties.fieldCode ?? ''), geometry: f.geometry })), importYear)
          .flatMap((m) => (m ? [m.id] : []))
      )
    : null;
  const fieldLabel = (r: { num: string; name: string }) => `${r.num ? `${r.num} ` : ''}${r.name}`;

  const handleConfirmImport = async () => {
    if (parsedPreview) {
      if (replacePlan && importYearLocked) return;
      if (replacePlan && (replacePlan.removed.length || replacePlan.skipped.length)) {
        const text = `Hooajast ${importYear} eemaldatakse ${replacePlan.removed.length} põllu hooaja kirje (põllud ise ja teiste aastate kirjed jäävad alles)`
          + (replacePlan.skipped.length ? `; ${replacePlan.skipped.length} põldu jäetakse alles, sest neil on töid` : '')
          + '.\n\nJätkata?';
        if (!await confirmDialog(text)) return;
      }
      onFieldsImported(parsedPreview, replaceExisting, operatorId || undefined, importYear);
      onClose();
    }
  };

  const previewTotalHa = parsedPreview 
    ? parsedPreview.features.reduce((sum, f) => sum + (f.properties.areaHa || 0), 0)
    : 0;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="md" dismissible={!isProcessing}>
        <DialogHeader
          icon={<UploadCloud size={24} />}
          title="Impordi PRIA Põldude SHP Fail"
          description="Toetatud on PRIA allalaaditud .ZIP Shapefile arhiivid (L-EST97 / EPSG:3301)"
        />
        <DialogBody>
          {/* Dropzone */}
          <Dropzone
            dragging={isDragging}
            hasFile={!!parsedPreview}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".zip" 
              hidden
              onChange={handleFileInput}
            />

            {isProcessing ? (
              <div className={dropzoneStateClass}>
                <RefreshCw size={36} className="animate-spin" />
                <p>Töötlen Shapefile faile ja teisendan L-EST97 koordinaate...</p>
              </div>
            ) : parsedPreview ? (
              <div className={dropzoneStateClass}>
                <FileArchive size={36} />
                <h4>Edukalt pargitud {parsedPreview.features.length} põldu!</h4>
                <p>Kogupindala: {previewTotalHa.toFixed(2)} ha</p>
                <span className={fileReuploadHintClass}>Klõpsa siia uue faili valimiseks</span>
              </div>
            ) : (
              <div className={dropzoneStateClass}>
                <UploadCloud size={44} className={dropzoneIconClass} />
                <h4>Lohista PRIA .ZIP fail siia</h4>
                <p>või klõpsa faili valimiseks arvutist</p>
                <div className={uploadFormatListClass}>
                  <Badge>.SHP</Badge>
                  <Badge>.DBF</Badge>
                  <Badge>.PRJ</Badge>
                  <Badge>L-EST97</Badge>
                </div>
              </div>
            )}
          </Dropzone>

          {/* Error display */}
          {error && (
            <Alert tone="error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </Alert>
          )}

          {/* Preview list */}
          {parsedPreview && (
            <Card variant="tile" padding="sm" className={previewBoxClass}>
              <div className={previewHeaderClass}>
                <strong>Leitud põllud ({parsedPreview.features.length})</strong>
                <CheckboxField checked={replaceExisting} onCheckedChange={setReplaceExisting} label="Asenda olemasolevad põllud" />
              </div>

              <Field label="Hooaeg (aasta), millesse põllud imporditakse *" htmlFor="fu-year" className={previewFieldClass}>
                <Select
                  id="fu-year"
                  value={String(importYear)}
                  onValueChange={(v) => setImportYear(Number(v))}
                  options={(availableYears.includes(importYear) ? availableYears : [...availableYears, importYear].sort((a, b) => a - b)).map((y) => ({ value: String(y), label: String(y) }))}
                />
                {detectedYear && (
                  <span className={hintTextBlockClass}>
                    Failist tuvastatud: {detectedYear.year} ({detectedYear.count}/{detectedYear.total} põllu PRIA muutmiskuupäeva järgi) — kontrolli enne kinnitamist
                  </span>
                )}
              </Field>

              <Field label="Operaator (seotakse kõigi imporditud põldudega)" htmlFor="fu-operator" className={previewFieldClass}>
                <Select
                  id="fu-operator"
                  value={operatorId}
                  onValueChange={setOperatorId}
                  options={[{ value: '', label: '-- Määramata --' }, ...operators.map((p) => ({ value: p.id, label: p.name }))]}
                />
              </Field>

              {replacePlan && (
                <Alert tone={importYearLocked ? 'error' : 'neutral'} className="my-2 flex-col items-stretch gap-1">
                  {importYearLocked ? (
                    <span>Hooaeg {importYear} on lukus — asendamine pole võimalik.</span>
                  ) : (
                    <>
                      <span>
                        Hooaeg {importYear} muutub faili sisuks{operatorId ? ' valitud operaatori põldudel' : ' operaatorita põldudel'}.
                        {' '}Failis puuduvatelt põldudelt eemaldatakse selle aasta kirje: <strong>{replacePlan.removed.length}</strong>
                        {replacePlan.skipped.length > 0 && <>; töödega jäetakse alles: <strong>{replacePlan.skipped.length}</strong></>}
                      </span>
                      {replacePlan.removed.length > 0 && (
                        <span className={hintTextClass}>Eemaldatakse: {replacePlan.removed.map(fieldLabel).join(', ')}</span>
                      )}
                      {replacePlan.skipped.length > 0 && (
                        <span className={hintTextClass}>Jäetakse alles (töid): {replacePlan.skipped.map((r) => `${fieldLabel(r)} (${r.works})`).join(', ')}</span>
                      )}
                    </>
                  )}
                </Alert>
              )}

              <div className={previewFieldsScrollClass}>
                {parsedPreview.features.slice(0, 10).map((f, idx) => (
                  <div key={idx} className={previewFieldRowClass}>
                    <div>
                      <strong>{f.properties.name}</strong>
                      <span className={previewCropClass}>{f.properties.crop}</span>
                    </div>
                    <div className={previewValueClass}>{f.properties.areaHa.toFixed(2)} ha</div>
                  </div>
                ))}
                {parsedPreview.features.length > 10 && (
                  <div>
                    ...ja veel {parsedPreview.features.length - 10} põldu
                  </div>
                )}
              </div>
            </Card>
          )}

        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Loobu</Button>
          {parsedPreview && (
            <Button variant="primary" onClick={handleConfirmImport} disabled={!!replacePlan && importYearLocked}>
              <Check size={16} />
              <span>Lisa {parsedPreview.features.length} põldu hooaega {importYear}</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
