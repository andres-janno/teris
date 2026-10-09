export type BaseMapLayerId = 'maaamet-pohikaart' | 'maaamet-foto';

export interface BaseMapConfig {
  id: BaseMapLayerId;
  name: string;
  category: 'maaamet' | 'osm';
  url: string;
  attribution: string;
  maxZoom: number;
  minZoom: number;
  tms?: boolean;
  isWms?: boolean;
  layers?: string;
  subdomains?: string[];
  wmsParams?: Record<string, string | number | boolean>;
}

export interface LayerVisibility {
  baseMap: BaseMapLayerId;
  cadastre: boolean;        // Maa-ameti katastripiirid
  fields: boolean;          // PRIA põllud
  vehicles: boolean;        // Masinapark / tehnika
  cultivation: boolean;     // Põllutööd: masinate rajad ja haritud ala (telemeetria)
  poi: boolean;             // Muud asukohad (kuivati, vesi jne)
  fieldLabels: boolean;     // Põldude nimed/numbrid kaardil
  swathTrails: boolean;     // Töötrajektoori joonekesed
  soilSamples: boolean;     // Mullaproovide punktid
  weatherRadar: boolean;    // Sajuradar (Keskkonnaagentuur, KAIA)
}

export type VehicleDisplayFilter = 'active' | 'all';

