// src/components/CropLegend.tsx
import React, { useState, useMemo } from 'react';
import { Sprout, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import type { FieldCollection } from '../types/field';
import { getCropColor } from '../services/shpParser';

interface CropLegendProps {
  fields: FieldCollection;
  selectedYear: number;
  selectedCropFilter?: string | null;
  onSelectCropFilter?: (cropName: string | null) => void;
}

interface CropSummary {
  name: string;
  color: string;
  totalHa: number;
  count: number;
  pct: number;
}

export const CropLegend: React.FC<CropLegendProps> = ({
  fields,
  selectedYear,
  selectedCropFilter = null,
  onSelectCropFilter
}) => {
  const [isOpen, setIsOpen] = useState(true);

  // Group fields by crop and calculate sum ha and percentages
  const { cropSummaries, totalFarmHa, totalFieldsCount } = useMemo(() => {
    const map = new Map<string, { color: string; totalHa: number; count: number }>();
    let totalHa = 0;
    let count = 0;

    fields.features.forEach((f) => {
      const p = f.properties;
      const crop = (p.crop || 'Määramata').trim();
      const ha = p.areaHa || 0;
      const color = p.cropColor || getCropColor(crop);

      totalHa += ha;
      count += 1;

      if (!map.has(crop)) {
        map.set(crop, { color, totalHa: 0, count: 0 });
      }
      const existing = map.get(crop)!;
      existing.totalHa += ha;
      existing.count += 1;
      // Prefer non-default color if found
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

    // Sort by largest area first
    list.sort((a, b) => b.totalHa - a.totalHa);

    return {
      cropSummaries: list,
      totalFarmHa: Math.round(totalHa * 100) / 100,
      totalFieldsCount: count
    };
  }, [fields]);

  if (!fields.features.length) return null;

  return (
    <div className={`crop-legend-panel glass-card ${isOpen ? 'open' : 'collapsed'}`}>
      <div className="crop-legend-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="legend-title-group">
          <div className="legend-icon-badge">
            <Sprout size={15} className="text-emerald" />
          </div>
          <div>
            <div className="legend-title">Kultuuride Legend ({selectedYear})</div>
            <div className="legend-subtitle">
              {totalFarmHa.toFixed(1)} ha &bull; {totalFieldsCount} põldu
            </div>
          </div>
        </div>
        <button 
          className="icon-btn-ghost" 
          title={isOpen ? 'Ahenda legend' : 'Ava legend'}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
        >
          {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>

      {isOpen && (
        <div className="crop-legend-body">
          {/* Cumulative Crop Bar */}
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

          {/* List of Crops */}
          <div className="crop-list">
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
                  title={onSelectCropFilter ? `Klõpsa, et filtreerida ${item.name} põlde` : undefined}
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
  );
};
