import { LAYER_SWATCH, UNDETERMINED_CROP_COLOR } from '../lib/dataColors';
import React, { useState } from 'react';
import {
  Layers,
  Map as MapIcon,
  Eye,
  EyeOff,
  Grid,
  ChevronUp,
  Maximize2,
  Play,
  Loader2
} from 'lucide-react';
import type { BaseMapLayerId, LayerVisibility } from '../types/map';
import type { SoilSampleMetricKey } from '../types/soilSample';
import type { EnrichedVehicle } from '../types/fleet';
import { SOIL_METRIC_CONFIG, SOIL_LEVEL_COLOR, getSoilMetricColor, AGE_MAX_YEARS } from '../types/soilSample';
import { BASE_MAPS } from '../services/maaAmetLayers';
import { Button, Card, CardButton, CheckboxField, RadioGroup, RadioField, clickOnActivationKey, SectionTitle, LegendItem, cn } from './ui';
import { loadingSpinnerInlineClass, mapPanelTitleClass } from './ui/variants';

interface LayerControlProps {
  visibility: LayerVisibility;
  onToggleLayer: (key: keyof LayerVisibility) => void;
  onSelectBaseMap: (id: BaseMapLayerId) => void;
  onFitAll?: () => void;
  soilSampleCount?: number;
  soilFieldCount?: number;
  soilMetric?: SoilSampleMetricKey;
  onSelectSoilMetric?: (metric: SoilSampleMetricKey) => void;

  // Põllutööd: masinate rajad ja taasesitus
  vehicles?: EnrichedVehicle[];
  simulatedVehicleId?: string | null;
  onToggleVehicleSimulator?: (vehicleId: string) => void;
  trackVehicleIds?: Set<string>;
  isLoadingVehicleTracks?: boolean;
  hiddenTrackVehicleIds?: Set<string>;
  onToggleTrackVisibility?: (vehicleId: string) => void;

  // Litsentsi moodulid: puuduva mooduli kihi rida ei näidata
  modules?: { telemetry: boolean; satellite: boolean; weather: boolean };
}

// Kihi alamvalikud (vana .layer-sub-options) ja alamtekst (.layer-subtext): kasutavad Põllud, Mullaproovid ja Põllutööd; preflighti pole, seega ülejäänud küljed nulli (muidu 3px katkendjoon)
const LAYER_SUB_OPTIONS = 'flex flex-col gap-1.5 border-x-0 border-b-0 border-t border-dashed border-border px-2 pt-1.5 pb-2';
const LAYER_SUBTEXT = 'text-2xs leading-natural text-primary';
// Masina rida: hõljumine, peidetud rada, aktiivne simulaator; hover-klassid selgelt, et olekud võidaksid (vana järjekord)
const VEHICLE_ROW = 'flex items-center justify-between gap-1.5 rounded-sm border border-border bg-card px-1.5 py-1 transition-all duration-150 hover:border-primary/35 hover:bg-muted-hover';
const VEHICLE_ROW_HIDDEN = 'bg-muted opacity-55 hover:bg-muted';
const VEHICLE_ROW_SIM = 'border-primary/60 bg-primary/8 hover:border-primary/60 hover:bg-primary/8';

// Kihirea ühised klassid (vana .layer-item, .layer-label, .soil-metric-radio-item). CheckboxField juurde: `[&>button]:mt-0` nullib märkeruudu ülavahe.
const LAYER_ITEM = 'flex items-center justify-between px-2 py-1.5 text-foreground';
const LAYER_LABEL = 'flex items-center gap-2 text-sm [&>button]:mt-0';
const LAYER_OPTION = 'flex items-center gap-1.5 text-sm [&>button]:mt-0';

// Kihi värvimärk (8px; värv tuleb LAYER_SWATCH-ist)
const LayerDot: React.FC<{ swatch: string }> = ({ swatch }) => (
  <span className="size-2 rounded-sm" style={{ background: swatch }} aria-hidden="true" />
);

// Kihirida: märkeruut + värvimärk + nimi, silma nupp paremal; alamvalikud lastena (näidatakse ainult sisselülitatud kihil)
const LayerRow: React.FC<{
  swatch: string; label: string; checked: boolean; onToggle: () => void; adornment?: React.ReactNode; children?: React.ReactNode;
}> = ({ swatch, label, checked, onToggle, adornment, children }) => (
  <Card variant="tile" padding="none" className="flex flex-col overflow-hidden">
    <div className={LAYER_ITEM}>
      <CheckboxField
        className={LAYER_LABEL}
        checked={checked}
        onCheckedChange={onToggle}
        label={
          <span className="flex items-center gap-2">
            <LayerDot swatch={swatch} />
            <span>{label}</span>
            {adornment}
          </span>
        }
      />
      <Button variant="ghost" size="icon-xs" onClick={onToggle} title={checked ? 'Peida' : 'Näita'}>
        {checked ? <Eye size={15} /> : <EyeOff size={15} />}
      </Button>
    </div>
    {children}
  </Card>
);

export const LayerControl: React.FC<LayerControlProps> = ({
  visibility,
  onToggleLayer,
  onSelectBaseMap,
  onFitAll,
  soilSampleCount = 0,
  soilFieldCount = 0,
  soilMetric = 'ph',
  onSelectSoilMetric,
  vehicles = [],
  simulatedVehicleId,
  onToggleVehicleSimulator,
  trackVehicleIds,
  isLoadingVehicleTracks = false,
  hiddenTrackVehicleIds,
  onToggleTrackVisibility,
  modules = { telemetry: true, satellite: true, weather: true }
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const isAgeMetric = soilMetric === 'age';

  const soilLegendItems = !isAgeMetric
    ? (SOIL_METRIC_CONFIG[soilMetric].thresholds || []).map((t, idx, arr) => {
      const prevMax = idx > 0 ? arr[idx - 1].max : null;
      const unit = SOIL_METRIC_CONFIG[soilMetric].unit;
      let label: string;
      if (t.max === Infinity) {
        label = `> ${prevMax}${unit ? ` ${unit}` : ''}`;
      } else if (prevMax === null) {
        label = `≤ ${t.max}${unit ? ` ${unit}` : ''}`;
      } else {
        label = `${prevMax} – ${t.max}${unit ? ` ${unit}` : ''}`;
      }
      return { color: SOIL_LEVEL_COLOR[t.level], label };
    })
    : [];

  const ageGradientCss = `linear-gradient(to right, ${Array.from(
    { length: AGE_MAX_YEARS + 2 },
    (_, i) => getSoilMetricColor('age', i)
  ).join(', ')})`;

  if (!isOpen) {
    return (
      <CardButton
        variant="floating"
        padding="none"
        className="flex size-10 shrink-0 items-center justify-center self-end text-foreground transition-all duration-150 hover:text-primary"
        onClick={() => setIsOpen(true)}
        title="Ava kaardikihid"
        aria-label="Ava kaardikihid"
      >
        <Layers size={20} />
      </CardButton>
    );
  }

  return (
    <Card variant="floating" className="w-full flex-none">
      <div
        className="flex cursor-pointer items-center justify-between"
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onKeyDown={clickOnActivationKey}
        onClick={() => setIsOpen(false)}
      >
        <div className={mapPanelTitleClass}>
          <Layers size={18} />
          <span>Kaardikihid</span>
        </div>
        <Button variant="ghost" size="icon-sm" title="Ahenda kaardikihid" type="button" tabIndex={-1}>
          <ChevronUp size={16} />
        </Button>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {/* Base Maps Selection */}
        <div>
          <SectionTitle>
            <MapIcon size={14} />
            <span>Aluskaart</span>
          </SectionTitle>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(BASE_MAPS) as BaseMapLayerId[]).map((id) => {
              const mapConfig = BASE_MAPS[id];
              const isActive = visibility.baseMap === id;
              return (
                <Button size="sm" className="justify-between" aria-pressed={isActive}
                  key={id}
                  onClick={() => onSelectBaseMap(id)}
                >
                  <span>{mapConfig.name}</span>
                  {isActive && <span className="size-1.5 rounded-full bg-primary" />}
                </Button>
              );
            })}
          </div>
          <CheckboxField
            className={cn(LAYER_LABEL, 'mt-2.5 px-1')}
            checked={visibility.cadastre}
            onCheckedChange={() => onToggleLayer('cadastre')}
            label={
              <span className="flex items-center gap-2">
                <LayerDot swatch={LAYER_SWATCH.cadastre} />
                <span>Katastripiirid</span>
              </span>
            }
          />
        </div>

        {/* Overlays / Thematic Layers */}
        <div>
          <SectionTitle>
            <Grid size={14} />
            <span>Teemakihid</span>
          </SectionTitle>
          <div className="flex flex-col gap-1.5">
            {/* Fields Layer */}
            <LayerRow swatch={LAYER_SWATCH.fields} label="Põllud" checked={visibility.fields} onToggle={() => onToggleLayer('fields')}>
              {visibility.fields && (
                <div className={LAYER_SUB_OPTIONS}>
                  <CheckboxField className={LAYER_OPTION} checked={visibility.fieldLabels} onCheckedChange={() => onToggleLayer('fieldLabels')} label="Põllunumbrid" />
                  <CheckboxField className={LAYER_OPTION} checked={visibility.blockLabels} onCheckedChange={() => onToggleLayer('blockLabels')} label="Massiivi numbrid" />
                </div>
              )}
            </LayerRow>

            {/* Soil Samples — linnutamata lihtne rida, linnutatuna statistika ja näitaja valik */}
            <LayerRow swatch={LAYER_SWATCH.soil} label="Mullaproovid" checked={visibility.soilSamples} onToggle={() => onToggleLayer('soilSamples')}>
              {visibility.soilSamples && onSelectSoilMetric && (
                <div className={LAYER_SUB_OPTIONS}>
                  <span className={LAYER_SUBTEXT}>{soilSampleCount} punkti kokku, {soilFieldCount} massiivil</span>
                  <div className="flex items-center gap-1 rounded-sm border border-border bg-card p-0.5">
                    <RadioGroup
                      className="gap-1"
                      orientation="vertical"
                      value={soilMetric}
                      onValueChange={(v) => onSelectSoilMetric(v as SoilSampleMetricKey)}
                      aria-label="Mullaproovi näitaja"
                    >
                      {(Object.keys(SOIL_METRIC_CONFIG) as SoilSampleMetricKey[]).map((key) => (
                        <RadioField key={key} value={key} label={SOIL_METRIC_CONFIG[key].label} labelClassName="gap-1.5" />
                      ))}
                    </RadioGroup>

                    <div className="mt-1.5 flex flex-col gap-1 border-t border-border pt-1.5">
                      {isAgeMetric ? (
                        <div className="mb-0.5 flex flex-col gap-0.5">
                          <div className="h-2 rounded-sm" style={{ backgroundImage: ageGradientCss }}></div>
                          <div className="flex justify-between text-2xs leading-natural text-muted-foreground">
                            <span>0 a</span>
                            <span>&gt; {AGE_MAX_YEARS} a</span>
                          </div>
                        </div>
                      ) : (
                        soilLegendItems.map((item) => (
                          <LegendItem key={item.label} color={item.color} label={item.label} />
                        ))
                      )}
                      <LegendItem color={UNDETERMINED_CROP_COLOR} label="Andmed puuduvad" />
                    </div>
                  </div>
                </div>
              )}
            </LayerRow>

            {/* Machinery / Vehicles — masinate viimased teadaolevad asukohad */}
            {modules.telemetry && (
              <LayerRow swatch={LAYER_SWATCH.vehicles} label="Masinapark" checked={visibility.vehicles} onToggle={() => onToggleLayer('vehicles')} />
            )}

            {/* Põllutööd — linnutatuna kõigi masinate rajad kaardil, masinate kaupa peitmine ja taasesitus */}
            {modules.telemetry && (
              <LayerRow
                swatch={LAYER_SWATCH.cultivation}
                label="Põllutööd"
                checked={visibility.cultivation}
                onToggle={() => onToggleLayer('cultivation')}
                adornment={visibility.cultivation && isLoadingVehicleTracks && (
                  <Loader2 size={14} className={loadingSpinnerInlineClass} aria-label="Radade laadimine" />
                )}
              >
                {visibility.cultivation && (
                  <div className={LAYER_SUB_OPTIONS}>
                    {isLoadingVehicleTracks ? (
                      <div className="flex flex-col gap-1" role="status">
                        <span className={LAYER_SUBTEXT}>Masinate radade laadimine ja arvutamine…</span>
                        <div className="layer-loading-bar relative h-0.75 overflow-hidden rounded-sm bg-border" />
                      </div>
                    ) : (
                      <span className={LAYER_SUBTEXT}>{trackVehicleIds?.size ?? 0} masina rajad</span>
                    )}
                    {vehicles.length > 0 && (
                      <div className="flex max-h-50 flex-col gap-1 overflow-y-auto">
                        {vehicles.map((v) => {
                          const isSimActive = simulatedVehicleId === v.id;
                          const hasTrack = trackVehicleIds?.has(v.id) ?? false;
                          const isTrackVisible = hasTrack && !hiddenTrackVehicleIds?.has(v.id);
                          const iconEmoji = v.type === 'combine' ? '🌾' : (v.type === 'sprayer' ? '🚿' : (v.type === 'truck' ? '🚛' : '🚜'));
                          const deviceLabel = v.telemetry?.deviceId && v.telemetry.deviceId !== 'PAIGALDAMATA'
                            ? v.telemetry.deviceId
                            : (v.id.includes('demo') || v.name.toLowerCase().includes('demo') ? 'Demorežiim' : 'Seade puudub');

                          return (
                            <div
                              key={v.id}
                              className={cn(VEHICLE_ROW, hasTrack && !isTrackVisible && VEHICLE_ROW_HIDDEN, isSimActive && VEHICLE_ROW_SIM)}
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-1.5" title={`${v.name} (${deviceLabel})`}>
                                <span className="shrink-0 text-base leading-none">{iconEmoji}</span>
                                <div className="flex min-w-0 flex-col">
                                  <span className="truncate text-xs font-semibold leading-3.5 text-foreground">{v.name}</span>
                                  <span className="truncate text-2xs leading-3 text-subtle">{deviceLabel}</span>
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-1">
                                {onToggleVehicleSimulator && (
                                  <Button size="xs" aria-pressed={isSimActive}
                                    title={isSimActive ? 'Lülita simulaator välja' : `Käivita simulaator (${v.name})`}
                                    onClick={() => onToggleVehicleSimulator(v.id)}
                                  >
                                    <Play size={10} fill={isSimActive ? 'currentColor' : 'none'} />
                                    <span>Sim</span>
                                  </Button>
                                )}

                                {onToggleTrackVisibility && (
                                  <Button variant="ghost" size="icon-xs" aria-pressed={isTrackVisible}
                                    title={!hasTrack
                                      ? (isLoadingVehicleTracks ? 'Rada laaditakse…' : 'GPS-rada puudub')
                                      : (isTrackVisible ? `Peida ${v.name} rada` : `Kuva ${v.name} rada`)}
                                    onClick={() => onToggleTrackVisibility(v.id)}
                                    disabled={!hasTrack}
                                  >
                                    {isTrackVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </LayerRow>
            )}

            {/* POI / Infrastructure */}
            <LayerRow swatch={LAYER_SWATCH.poi} label="Muud asukohad" checked={visibility.poi} onToggle={() => onToggleLayer('poi')} />

            {/* Sajuradar — Keskkonnaagentuuri radarite koondpilt, uueneb iga 5 min */}
            {modules.weather && (
              <LayerRow swatch={LAYER_SWATCH.weather} label="Sajuradar" checked={visibility.weatherRadar} onToggle={() => onToggleLayer('weatherRadar')} />
            )}

            {/* Satelliidipilt — Maa- ja Ruumiameti Satiladu (Sentinel-2), kuupäeva valik kaardil */}
            {modules.satellite && (
              <LayerRow swatch={LAYER_SWATCH.satellite} label="Satelliidipilt" checked={visibility.satellite} onToggle={() => onToggleLayer('satellite')} />
            )}
          </div>
        </div>

        {/* Quick Fit Action */}
        {onFitAll && (
          <div className="mt-1 border-t border-border pt-2.5">
            <Button
              size="sm"
              className="w-full"
              onClick={onFitAll}
              title="Kohanda kaardi vaade kõigi aktiivsete kihtide elementide mahutamiseks"
            >
              <Maximize2 size={14} />
              <span>Mahuta valitud kihid ekraanile</span>
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};
