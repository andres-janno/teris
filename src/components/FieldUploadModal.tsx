// src/components/FieldUploadModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  UploadCloud, 
  FileArchive, 
  Check, 
  AlertCircle, 
  RefreshCw
} from 'lucide-react';
import type { FieldCollection } from '../types/field';
import type { RelatedParty } from '../types/party';
import { parseShapefileZip } from '../services/shpParser';
import { confirmDialog } from './ConfirmDialog';

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
  availableYears?: number[];
  defaultYear: number;
}

export const FieldUploadModal: React.FC<FieldUploadModalProps> = ({
  isOpen,
  onClose,
  onFieldsImported,
  parties = [],
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

  const handleConfirmImport = async () => {
    if (parsedPreview) {
      if (replaceExisting && !await confirmDialog('Valitud on „Asenda olemasolevad põllud“: registris kuvatakse pärast importi ainult faili põllud.\n\nJätkata?')) return;
      onFieldsImported(parsedPreview, replaceExisting, operatorId || undefined, importYear);
      onClose();
    }
  };

  const previewTotalHa = parsedPreview 
    ? parsedPreview.features.reduce((sum, f) => sum + (f.properties.areaHa || 0), 0)
    : 0;

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-card animate-scale-up">
        <div className="modal-header">
          <div className="modal-title-group">
            <UploadCloud className="text-emerald" size={24} />
            <div>
              <h3>Impordi PRIA Põldude SHP Fail</h3>
              <p className="modal-subtitle">Toetatud on PRIA allalaaditud .ZIP Shapefile arhiivid (L-EST97 / EPSG:3301)</p>
            </div>
          </div>
          <button className="icon-btn-ghost" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Dropzone */}
          <div 
            className={`dropzone ${isDragging ? 'dragging' : ''} ${parsedPreview ? 'has-file' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              ref={fileInputRef} 
              type="file" 
              accept=".zip" 
              style={{ display: 'none' }} 
              onChange={handleFileInput}
            />

            {isProcessing ? (
              <div className="dropzone-state">
                <RefreshCw size={36} className="animate-spin text-emerald" />
                <p>Töötlen Shapefile faile ja teisendan L-EST97 koordinaate...</p>
              </div>
            ) : parsedPreview ? (
              <div className="dropzone-state success">
                <FileArchive size={36} className="text-emerald" />
                <h4>Edukalt pargitud {parsedPreview.features.length} põldu!</h4>
                <p>Kogupindala: {previewTotalHa.toFixed(2)} ha</p>
                <span className="file-reupload-hint">Klõpsa siia uue faili valimiseks</span>
              </div>
            ) : (
              <div className="dropzone-state">
                <UploadCloud size={44} className="dropzone-icon" />
                <h4>Lohista PRIA .ZIP fail siia</h4>
                <p>või klõpsa faili valimiseks arvutist</p>
                <div className="badge-list">
                  <span className="mini-badge">.SHP</span>
                  <span className="mini-badge">.DBF</span>
                  <span className="mini-badge">.PRJ</span>
                  <span className="mini-badge">L-EST97</span>
                </div>
              </div>
            )}
          </div>

          {/* Error display */}
          {error && (
            <div className="alert-box error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Preview list */}
          {parsedPreview && (
            <div className="parsed-preview-box">
              <div className="preview-header">
                <strong>Leitud põllud ({parsedPreview.features.length})</strong>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                  />
                  <span>Asenda olemasolevad põllud</span>
                </label>
              </div>

              <div className="form-group" style={{ margin: '8px 0' }}>
                <label>Hooaeg (aasta), millesse põllud imporditakse *</label>
                <select
                  className="form-input"
                  value={importYear}
                  onChange={(e) => setImportYear(Number(e.target.value))}
                >
                  {(availableYears.includes(importYear) ? availableYears : [...availableYears, importYear].sort((a, b) => a - b)).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                {detectedYear && (
                  <span className="modal-subtitle" style={{ display: 'block', marginTop: '4px' }}>
                    Failist tuvastatud: {detectedYear.year} ({detectedYear.count}/{detectedYear.total} põllu PRIA muutmiskuupäeva järgi) — kontrolli enne kinnitamist
                  </span>
                )}
              </div>

              <div className="form-group" style={{ margin: '8px 0' }}>
                <label>Operaator (seotakse kõigi imporditud põldudega)</label>
                <select
                  className="form-input"
                  value={operatorId}
                  onChange={(e) => setOperatorId(e.target.value)}
                >
                  <option value="">-- Määramata --</option>
                  {operators.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="preview-fields-scroll">
                {parsedPreview.features.slice(0, 10).map((f, idx) => (
                  <div key={idx} className="preview-field-row">
                    <div className="p-title">
                      <strong>{f.properties.name}</strong>
                      <span className="p-crop">{f.properties.crop}</span>
                    </div>
                    <div className="p-ha">{f.properties.areaHa.toFixed(2)} ha</div>
                  </div>
                ))}
                {parsedPreview.features.length > 10 && (
                  <div className="preview-more-hint">
                    ...ja veel {parsedPreview.features.length - 10} põldu
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Loobu</button>
          {parsedPreview && (
            <button className="btn btn-primary" onClick={handleConfirmImport}>
              <Check size={16} />
              <span>Lisa {parsedPreview.features.length} põldu hooaega {importYear}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
