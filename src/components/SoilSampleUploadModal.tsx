// src/components/SoilSampleUploadModal.tsx
import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileArchive,
  Check,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import type { SoilSample } from '../types/soilSample';
import { parseSoilSampleShapefileZip } from '../services/soilSampleParser';

interface SoilSampleUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSamplesImported: (samples: SoilSample[]) => void;
}

export const SoilSampleUploadModal: React.FC<SoilSampleUploadModalProps> = ({
  isOpen,
  onClose,
  onSamplesImported
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<SoilSample[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    setError(null);
    setIsProcessing(true);
    try {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        throw new Error('Palun vali .ZIP arhiiv, mis sisaldab mullaproovide .shp, .dbf ja .prj faile.');
      }

      const arrayBuffer = await file.arrayBuffer();
      const samples = await parseSoilSampleShapefileZip(arrayBuffer);

      if (samples.length === 0) {
        throw new Error('ZIP arhiivist ei leitud sobivaid mullaproovi punkte.');
      }

      setParsedPreview(samples);
    } catch (err: any) {
      console.error('Soil sample shapefile parsing error:', err);
      setError(err.message || 'Viga faili töötlemisel. Kontrolli, et tegemist on korrektse punktikujundite Shapefile ZIP arhiiviga.');
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
      onSamplesImported(parsedPreview);
      onClose();
    }
  };

  const distinctFields = parsedPreview ? new Set(parsedPreview.map((s) => s.fieldCode)).size : 0;

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-card animate-scale-up">
        <div className="modal-header">
          <div className="modal-title-group">
            <UploadCloud className="text-emerald" size={24} />
            <div>
              <h3>Impordi Mullaproovide SHP Fail</h3>
              <p className="modal-subtitle">Toetatud on punktikujunditega .ZIP Shapefile arhiivid (WGS84 / EPSG:4326)</p>
            </div>
          </div>
          <button className="icon-btn-ghost" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
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
                <p>Töötlen Shapefile faile...</p>
              </div>
            ) : parsedPreview ? (
              <div className="dropzone-state success">
                <FileArchive size={36} className="text-emerald" />
                <h4>Edukalt parsitud {parsedPreview.length} mullaproovi!</h4>
                <p>{distinctFields} erinevat massiivi</p>
                <span className="file-reupload-hint">Klõpsa siia uue faili valimiseks</span>
              </div>
            ) : (
              <div className="dropzone-state">
                <UploadCloud size={44} className="dropzone-icon" />
                <h4>Lohista mullaproovide .ZIP fail siia</h4>
                <p>või klõpsa faili valimiseks arvutist</p>
                <div className="badge-list">
                  <span className="mini-badge">.SHP</span>
                  <span className="mini-badge">.DBF</span>
                  <span className="mini-badge">.PRJ</span>
                  <span className="mini-badge">WGS84</span>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="alert-box error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {parsedPreview && (
            <div className="parsed-preview-box">
              <div className="preview-header">
                <strong>Leitud proovid ({parsedPreview.length})</strong>
              </div>

              <div className="preview-fields-scroll">
                {parsedPreview.slice(0, 10).map((s, idx) => (
                  <div key={idx} className="preview-field-row">
                    <div className="p-title">
                      <strong>Massiiv {s.fieldCode}</strong>
                      <span className="p-crop">Proov {s.sampleNumber} ({s.year})</span>
                    </div>
                    <div className="p-ha">pH {s.ph ?? '-'}</div>
                  </div>
                ))}
                {parsedPreview.length > 10 && (
                  <div className="preview-more-hint">
                    ...ja veel {parsedPreview.length - 10} proovi
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
              <span>Lisa {parsedPreview.length} mullaproovi</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
