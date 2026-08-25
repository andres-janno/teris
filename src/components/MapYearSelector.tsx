// src/components/MapYearSelector.tsx
import React, { useState, useMemo } from 'react';
import { Calendar, Sprout, ChevronRight, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import type { FieldCollection } from '../types/field';
import { getCropColor } from '../services/shpParser';

interface MapYearSelectorProps {
  selectedYear: number;
  onSelectYear: (year: number) => void;
  availableYears?: number[];
  fields: FieldCollection;
  totalAreaHa: number;
  selectedCropFilter?: string | null;
  onSelectCropFilter?: (cropName: string | null) => void;
  onOpenFieldsRegister: () => void;
}

interface CropSummary {
  name: string;
  color: string;
  totalHa: number;
  count: number;
  pct: number;
}

export const MapYearSelector: React.FC<MapYearSelectorProps> = ({
  selectedYear,
  onSelectYear,
  availableYears = [2026, 2025, 2024, 2023],
  fields,
  totalAreaHa,
  selectedCropFilter = null,
  onSelectCropFilter,
  onOpenFieldsRegister
}) => {
  const [isLegendOpen, setIsLegendOpen] = useState(true);

  // Calculate crop breakdown with sum ha and counts
  const cropSummaries = useMemo(() => {
    const map = new Map<string, { color: string; totalHa: number; count: number }>();
    let totalHa = 0;

    fields.features.forEach((f) => {
      const p = f.properties;
      const crop = (p.crop || 'Määramata').trim();
      const ha = p.areaHa || 0;
      const color = p.cropColor || getCropColor(crop);

      totalHa += ha;

      if (!map.has(crop)) {
        map.set(crop, { color, totalHa: 0, count: 0 });
      }
      const existing = map.get(crop)!;
      existing.totalHa += ha;
      existing.count += 1;
      if (color && color !== '#3b82f6') {
        existing.color = color;
      }
    });

    const list: CropSummary[] = [];
    map.forEach((val, name) => {
      list.push({
        name,
        color: val.color,
        totalHa: Math.round(val.totalHa * 100) / 100,
        count: val.count,
        pct: totalHa > 0 ? Math.round((val.totalHa / totalHa) * 1000) / 10 : 0
      });
    });

    list.sort((a, b) => b.totalHa - a.totalHa);
    return list;
  }, [fields]);

  return (
    <div className="map-year-floating-widget glass-card">
      {/* Header: Season Title & Stat */}
      <div className="year-widget-header">
        <div className="year-widget-title">
          <Calendar size={15} className="text-emerald" />
          <span>Hooaeg:</span>
        </div>
        <span className="year-widget-stat">
          {fields.features.length} tk &bull; {totalAreaHa.toFixed(1)} ha
        </span>
      </div>

      {/* Season Selection Pills */}
      <div className="year-widget-pills">
        {availableYears.map((year) => {
          const isActive = selectedYear === year;
          return (
            <button
              key={year}
              className={`year-widget-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectYear(year)}
              title={`Vaheta vaade ${year}. aasta põllumassiividele ja kultuuridele`}
            >
              <span className="year-num">{year}</span>
              {isActive && <span className="year-active-tag">Aktiivne</span>}
            </button>
          );
        })}
      </div>

      {/* Integrated Crop Legend Section */}
      <div className="widget-crop-legend-section">
        <div
          className="widget-legend-header"
          onClick={() => setIsLegendOpen(!isLegendOpen)}
          title={isLegendOpen ? 'Ahenda kultuuride legend' : 'Ava kultuuride legend'}
        >
          <div className="widget-legend-title">
            <Sprout size={13} className="text-emerald" />
            <span>Kultuuride jaotus</span>
          </div>
          <button className="icon-btn-ghost-sm" type="button">
            {isLegendOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {isLegendOpen && (
          <div className="widget-legend-content">
            {/* Cumulative Visual Proportion Bar */}
            <div className="cumulative-crop-bar">
              {cropSummaries.map((item) => (
                <div
                  key={item.name}
                  className="crop-bar-segment"
                  style={{
                    width: `${item.pct}%`,
                    backgroundColor: item.color
                  }}
                  title={`${item.name}: ${item.totalHa} ha (${item.pct}%)`}
                />
              ))}
            </div>

            {/* List of Crops with Sum Ha */}
            <div className="crop-list widget-crop-list">
              {cropSummaries.map((item) => {
                const isSelected = selectedCropFilter === item.name;
                return (
                  <div
                    key={item.name}
                    className={`crop-legend-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      if (onSelectCropFilter) {
                        onSelectCropFilter(isSelected ? null : item.name);
                      }
                    }}
                    title={onSelectCropFilter ? `Klõpsa, et filtreerida ${item.name} põlde kaardil` : undefined}
                  >
                    <div className="crop-left-info">
                      <span
                        className="crop-legend-color-dot"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="crop-text-block">
                        <span className="crop-name-label">{item.name}</span>
                        <span className="crop-field-count">{item.count} tk &bull; {item.pct}%</span>
                      </div>
                    </div>

                    <div className="crop-right-info">
                      <span className="crop-total-ha">{item.totalHa.toFixed(2)} ha</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedCropFilter && onSelectCropFilter && (
              <div className="legend-filter-reset">
                <button
                  className="btn btn-secondary btn-xs btn-full"
                  onClick={() => onSelectCropFilter(null)}
                >
                  <Filter size={11} />
                  <span>Näita kõiki kultuure</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: Link to Full Register */}
      <div className="year-widget-footer">
        <button
          className="year-register-link-btn"
          onClick={onOpenFieldsRegister}
          title="Ava põldude ja maakasutuse täielik register"
        >
          <Sprout size={13} className="text-emerald" />
          <span>Põlluraamat & Register</span>
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
};
