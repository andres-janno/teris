import React, { useState, useMemo } from 'react';
import { Calendar, Sprout, ChevronDown, ChevronUp, Filter, Lock } from 'lucide-react';
import type { FieldCollection } from '../types/field';
import type { FarmingSeason } from '../types/season';
import { DEFAULT_FIELD_COLOR } from '../lib/dataColors';
import { getCropColor } from '../services/cropColors';
import { Badge, Card, CardButton, Button, ChipButton, ToggleGroup, ToggleGroupItem, clickOnActivationKey, cn } from './ui';
import { mapPanelTitleClass } from './ui/variants';

interface MapYearSelectorProps {
  selectedYear: number;
  onSelectYear: (year: number) => void;
  availableYears?: number[];
  fields: FieldCollection;
  totalAreaHa: number;
  selectedCropFilter?: string | null;
  onSelectCropFilter?: (cropName: string | null) => void;
  seasons?: FarmingSeason[];
}

interface CropSummary {
  name: string;
  color: string;
  totalHa: number;
  count: number;
  pct: number;
}

// Kultuuri rida (ChipButton tint): vana .crop-legend-item !important → cn tühistab kiibi vaikeklassid; valitud olek jääb index.css-i
const CROP_ROW = 'flex w-full text-left items-center justify-between border border-transparent py-1 pr-2 pl-2.5 text-base leading-natural transition-all duration-150 hover:translate-x-0.5';

export const MapYearSelector: React.FC<MapYearSelectorProps> = ({
  selectedYear,
  onSelectYear,
  availableYears = [2023, 2024, 2025, 2026],
  fields,
  totalAreaHa,
  selectedCropFilter = null,
  onSelectCropFilter,
  seasons = []
}) => {
  const [isOpen, setIsOpen] = useState(true);
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
      if (color && color !== DEFAULT_FIELD_COLOR) {
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

  if (!isOpen) {
    return (
      <CardButton
        variant="floating"
        padding="none"
        className="flex size-10 shrink-0 items-center justify-center self-start text-foreground transition-all duration-150 hover:text-primary"
        onClick={() => setIsOpen(true)}
        title={`Hooaeg: ${selectedYear} (ava hooaja paneel)`}
        aria-label={`Hooaeg: ${selectedYear} (ava hooaja paneel)`}
      >
        <Calendar size={20} />
      </CardButton>
    );
  }

  return (
    <Card variant="floating" padding="sm" className="flex w-full flex-col gap-2.5">
      {/* Header: Season Title, Stat & Collapse Button */}
      <div className="flex items-center justify-between">
        <div
          className={cn(mapPanelTitleClass, 'cursor-pointer select-none gap-1.5')}
          onClick={() => setIsOpen(false)}
          title="Ahenda hooaja paneel"
        >
          <Calendar size={15} />
          <span>Hooaeg:</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge className="num tabular-nums">
            {fields.features.length} põldu &bull; {totalAreaHa.toFixed(1)} ha
          </Badge>
          <Button
            variant="ghost"
            size="icon-xs"
            type="button"
            onClick={() => setIsOpen(false)}
            title="Ahenda hooaja paneel"
          >
            <ChevronUp size={14} />
          </Button>
        </div>
      </div>

      {/* Season Selection Pills */}
      <ToggleGroup className="self-start" variant="pills" aria-label="Hooaasta" value={String(selectedYear)} onValueChange={(v) => onSelectYear(Number(v))}>
        {availableYears.map((year) => {
          const isLocked = seasons.find((s) => s.year === year)?.isLocked ?? false;
          return (
            <ToggleGroupItem
              key={year}
              value={String(year)}
              title={`${year}. a hooaeg ${isLocked ? '(Suletud muudatusteks)' : '(Aktiivne)'}`}
            >
              {year}
              {isLocked && <Lock size={10} />}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>

      {/* Integrated Crop Legend Section */}
      <div className="flex flex-col gap-2 border-t border-border pt-2">
        <div
          className="flex cursor-pointer select-none items-center justify-between rounded-sm px-1 py-0.5 transition-colors hover:bg-muted-hover"
          role="button"
          tabIndex={0}
          aria-expanded={isLegendOpen}
          onKeyDown={clickOnActivationKey}
          onClick={() => setIsLegendOpen(!isLegendOpen)}
          title={isLegendOpen ? 'Ahenda kultuuride legend' : 'Ava kultuuride legend'}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold leading-natural text-foreground">
            <Sprout size={13} />
            <span>Kultuuride jaotus</span>
          </div>
          <Button variant="ghost" size="icon-xs" type="button">
            {isLegendOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
        </div>

        {isLegendOpen && (
          <div className="flex flex-col gap-2">
            {/* Cumulative Visual Proportion Bar */}
            <div className="flex h-1.5 w-full overflow-hidden rounded-sm bg-muted inset-shadow-xs">
              {cropSummaries.map((item) => (
                <div
                  key={item.name}
                  className="h-full transition-[width] duration-300"
                  style={{
                    width: `${item.pct}%`,
                    backgroundColor: item.color
                  }}
                  title={`${item.name}: ${item.totalHa} ha (${item.pct}%)`}
                />
              ))}
            </div>

            {/* List of Crops with Sum Ha */}
            <div className="flex max-h-110 flex-col gap-1 overflow-y-auto pr-0.5">
              {cropSummaries.map((item) => {
                const isSelected = selectedCropFilter === item.name;
                return (
                  <ChipButton
                    key={item.name}
                    variant="tint"
                    accent={item.color}
                    selected={isSelected}
                    className={cn('crop-legend-item', CROP_ROW)}
                    onClick={() => {
                      if (onSelectCropFilter) {
                        onSelectCropFilter(isSelected ? null : item.name);
                      }
                    }}
                    title={onSelectCropFilter ? `Klõpsa, et filtreerida ${item.name} põlde kaardil` : undefined}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex min-w-0 flex-col">
                        <span className="max-w-38.75 truncate text-xs font-medium leading-natural text-foreground">{item.name}</span>
                        <span className="text-2xs leading-natural text-muted-foreground">{item.count} {item.count === 1 ? 'põld' : 'põldu'} &bull; {item.pct}%</span>
                      </span>
                    </span>

                    <span className="flex shrink-0 items-center gap-1">
                      <span className="text-sm font-semibold leading-natural tabular-nums text-foreground">{item.totalHa.toFixed(2)} ha</span>
                    </span>
                  </ChipButton>
                );
              })}
            </div>

            {selectedCropFilter && onSelectCropFilter && (
              <div className="mt-1">
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => onSelectCropFilter(null)}
                >
                  <Filter size={11} />
                  <span>Näita kõiki kultuure</span>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
