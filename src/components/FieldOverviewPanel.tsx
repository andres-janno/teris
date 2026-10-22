// src/components/FieldOverviewPanel.tsx — põllu üldandmed (statistika, katastrid, piirid, mullaproovid, NDVI, märkmed).
// Tõstetud FieldDetailsDrawer'ist; kasutab FieldFullView vasak veerg.
import React, { useState } from 'react';
import {
  ExternalLink,
  Activity,
  MapPin,
  Coins,
  ChevronDown,
  ChevronUp,
  Landmark,
  Compass,
  Layers
} from 'lucide-react';
import type { FieldFeature } from '../types/field';
import type { FieldCadastralLink } from '../types/cadastre';
import type { SoilSample } from '../types/soilSample';
import { getGeometryCoordinatesList, getGeometryPerimeterMeters } from '../services/geometryEngine';
import { SoilSamplesSection } from './SoilSamplesSection';
import { FieldNdviSection } from './FieldNdviSection';

interface FieldOverviewPanelProps {
  shown: FieldFeature;
  soilSamples: SoilSample[];
  satelliteDate: string | null;
}

export const FieldOverviewPanel: React.FC<FieldOverviewPanelProps> = ({ shown, soilSamples, satelliteDate }) => {
  const [showCoordsList, setShowCoordsList] = useState(false);
  const props = shown.properties;
  const progress = props.workProgress || 0;
  const raw = props.rawProperties || {};
  const cadastralParcels: FieldCadastralLink[] = raw.cadastralParcels || [];

  const perimeterMeters = props.perimeterM || getGeometryPerimeterMeters(shown.geometry);
  const coordsList = showCoordsList ? getGeometryCoordinatesList(shown.geometry) : [];
  const pointsCount = raw.pointsCount || coordsList.length || 0;

  // Põllu katastriüksuste maamaks ja rent kokku
  const totalTax = cadastralParcels.reduce((sum, c) => sum + (c.landTaxEurYear || 0), 0);
  const totalRent = cadastralParcels.reduce((sum, c) => sum + (c.rentFeeEurYear || 0), 0);

  return (
    <div className="field-overview">
      {/* Main stats card */}
      <div className="field-stats-grid">
        <div className="field-stat-item">
          <span className="stat-label">Pindala {props.year}</span><br />
          <strong className="stat-value">{props.areaHa} ha</strong>
        </div>
        <div className="field-stat-item">
          <span className="stat-label">Kultuur & Sort</span><br />
          <strong className="stat-value">
            {props.crop || 'Määramata'}
            {props.cropVariety ? ` (${props.cropVariety})` : ''}
          </strong>
        </div>
        <div className="field-stat-item">
          <span className="stat-label">Haritud</span><br />
          <strong className="stat-value text-emerald">{(props.workedAreaHa || 0).toFixed(2)} ha</strong>
        </div>
        <div className="field-stat-item">
          <span className="stat-label">Staatus</span>
          <strong className="stat-value">
            {progress >= 100 ? '✅ Valmis' : (progress > 0 ? '🔄 Töös' : '⏳ Alustamata')}
          </strong>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="field-progress-container">
        <div className="progress-labels">
          <span>Põllu harimise progress</span>
          <strong>{progress}%</strong>
        </div>
        <div className="drawer-progress-track">
          <div
            className="drawer-progress-fill"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Seasonal Area & Geography Notes */}
      {props.areaChangeReason && (
        <div className="drawer-note-badge">
          <Compass size={13} className="text-amber" />
          <span><strong>Pindala muutus:</strong> {props.areaChangeReason}</span>
        </div>
      )}

      {/* Cadastral Units Breakdown (Katastriüksused) */}
      <div className="detail-section">
        <div className="section-subtitle">
          <Landmark size={14} />
          <span>Katastriüksused ja maakasutus ({cadastralParcels.length || 1})</span>
        </div>

        {cadastralParcels.length > 0 ? (
          <div className="cadastre-parcels-list">
            {cadastralParcels.map((cad, idx) => {
              const isOwned = cad.ownershipType === 'OWNED';
              return (
                <div key={cad.cadastralCode + idx} className="cadastre-parcel-item">
                  <div className="cad-parcel-top">
                    <div className="cad-code-group">
                      <code className="cad-code">{cad.cadastralCode}</code>
                      {cad.parcelName && <span className="cad-name">({cad.parcelName})</span>}
                    </div>
                    <span className={`tenure-pill ${isOwned ? 'owned' : 'rented'}`}>
                      {isOwned ? '🏛️ Oma maa' : '🤝 Renditud'}
                    </span>
                  </div>

                  <div className="cad-parcel-details">
                    <div className="cad-detail-row">
                      <span className="lbl">Põllu osa katastrist:</span>
                      <strong>{cad.fieldAreaHa} ha</strong>
                    </div>
                    <div className="cad-detail-row">
                      <span className="lbl">Omanik:</span>
                      <span>{cad.ownerName}</span>
                    </div>
                    {isOwned && (cad.landTaxEurHa !== undefined || cad.landTaxEurYear !== undefined) && (
                      <div className="cad-detail-row">
                        <span className="lbl">Maamaks:</span>
                        <span className="text-emerald font-semibold">
                          {cad.landTaxEurHa !== undefined ? `${cad.landTaxEurHa} €/ha` : ''}
                          {cad.landTaxEurHa !== undefined && cad.landTaxEurYear !== undefined ? ' · ' : ''}
                          {cad.landTaxEurYear !== undefined ? `kokku ${cad.landTaxEurYear.toFixed(2)} €/a` : ''}
                        </span>
                      </div>
                    )}
                    {!isOwned && (cad.rentFeeEurHa !== undefined || cad.rentFeeEurYear !== undefined) && (
                      <div className="cad-detail-row">
                        <span className="lbl">Renditasu:</span>
                        <span className="text-blue font-semibold">
                          {cad.rentFeeEurHa !== undefined ? `${cad.rentFeeEurHa} €/ha` : ''}
                          {cad.rentFeeEurHa !== undefined && cad.rentFeeEurYear !== undefined ? ' · ' : ''}
                          {cad.rentFeeEurYear !== undefined ? `kokku ${cad.rentFeeEurYear.toFixed(2)} €/a` : ''}
                        </span>
                      </div>
                    )}
                    {cad.notes && (
                      <div className="cad-note-line">
                        <span>{cad.notes}</span>
                      </div>
                    )}
                  </div>

                  <a
                    href={`https://xgis.maaamet.ee/ky/FindKYByTunnus.aspx?ky=${cad.cadastralCode}`}
                    target="_blank"
                    rel="noreferrer"
                    className="cadastre-link"
                  >
                    <span>Maa-ameti X-GIS</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              );
            })}

            {/* Total Financial Summary for Field */}
            {(totalTax > 0 || totalRent > 0) && (
              <div className="cadastre-financial-summary">
                <div className="fin-item">
                  <Coins size={13} className="text-amber" />
                  <span>Maamaks kokku: <strong>{totalTax.toFixed(2)} €/a</strong></span>
                </div>
                <div className="fin-item">
                  <Coins size={13} className="text-blue" />
                  <span>Rendikulu kokku: <strong>{totalRent.toFixed(2)} €/a</strong></span>
                </div>
              </div>
            )}
          </div>
        ) : props.cadastralCode ? (
          <div className="cadastre-box">
            <div className="cadastre-row">
              <span>Katastritunnus:</span>
              <code>{props.cadastralCode}</code>
            </div>
            <a
              href={`https://xgis.maaamet.ee/ky/FindKYByTunnus.aspx?ky=${props.cadastralCode}`}
              target="_blank"
              rel="noreferrer"
              className="cadastre-link"
            >
              <span>Ava Maa-ameti X-GIS kaardil</span>
              <ExternalLink size={12} />
            </a>
          </div>
        ) : null}
      </div>

      {/* Geometry & Geographic Points Section */}
      <div className="detail-section">
        <div className="section-subtitle">
          <Layers size={14} />
          <span>Hooaja {props.year} geograafia ja piirid</span>
        </div>

        <div className="geometry-info-box">
          <div className="geom-stat-row">
            <span>Piiripunktide arv:</span>
            <strong>{pointsCount || 'Tuvastamisel'} tippu</strong>
          </div>
          {perimeterMeters > 0 && (
            <div className="geom-stat-row">
              <span>Põllu perimeeter:</span>
              <strong>{(perimeterMeters / 1000).toFixed(2)} km ({perimeterMeters} m)</strong>
            </div>
          )}
          {props.eligibleAreaHa && (
            <div className="geom-stat-row">
              <span>PRIA toetusõiguslik pind:</span>
              <strong>{props.eligibleAreaHa} ha</strong>
            </div>
          )}

          <button
            type="button"
            className="btn btn-ghost btn-xs btn-coords-toggle"
            onClick={() => setShowCoordsList(!showCoordsList)}
          >
            <MapPin size={12} />
            <span>{showCoordsList ? 'Peida GPS koordinaatide loend' : 'Kuva GPS koordinaatide loend'}</span>
            {showCoordsList ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showCoordsList && coordsList.length > 0 && (
            <div className="coords-table-wrap">
              <table className="coords-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Laiuskraad (Lat)</th>
                    <th>Pikkuskraad (Lng)</th>
                  </tr>
                </thead>
                <tbody>
                  {coordsList.slice(0, 30).map((pt) => (
                    <tr key={pt.index}>
                      <td>{pt.index}</td>
                      <td><code>{pt.lat.toFixed(6)}</code></td>
                      <td><code>{pt.lng.toFixed(6)}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {coordsList.length > 30 && (
                <div className="coords-more-note">
                  ...ja veel {coordsList.length - 30} piiripunkti
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {satelliteDate && <FieldNdviSection geometry={shown.geometry} date={satelliteDate} />}

      <SoilSamplesSection geometry={shown.geometry} samples={soilSamples} />

      {/* Notes */}
      {props.notes && (
        <div className="detail-section">
          <div className="section-subtitle">
            <Activity size={14} />
            <span>Märkmed ja agrotehnika</span>
          </div>
          <p className="notes-text">{props.notes}</p>
        </div>
      )}
    </div>
  );
};
