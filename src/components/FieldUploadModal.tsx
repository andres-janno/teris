// src/components/FieldUploadModal.tsx
import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  FileArchive, 
  Check, 
  AlertCircle, 
  Sparkles,
  RefreshCw,
  Info
} from 'lucide-react';
import type { FieldCollection } from '../types/field';
import { parseShapefileZip } from '../services/shpParser';

interface FieldUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFieldsImported: (newFields: FieldCollection, replace: boolean) => void;
  onResetToSample: () => void;
}

export const FieldUploadModal: React.FC<FieldUploadModalProps> = ({
  isOpen,
  onClose,
  onFieldsImported,
  onResetToSample
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<FieldCollection | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleConfirmImport = () => {
    if (parsedPreview) {
      onFieldsImported(parsedPreview, replaceExisting);
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

          {/* Sample quick loader */}
          <div className="sample-loader-box">
            <div className="sample-text">
              <Info size={16} className="text-blue" />
              <span>Pole faili käepärast? Saad laadida Eesti näidispõllud:</span>
            </div>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => {
                onResetToSample();
                onClose();
              }}
            >
              <Sparkles size={14} />
              <span>Laadi näidispõllud (Järvamaa)</span>
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Loobu</button>
          {parsedPreview && (
            <button className="btn btn-primary" onClick={handleConfirmImport}>
              <Check size={16} />
              <span>Lisa {parsedPreview.features.length} põldu kaardile</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
