// src/services/maaAmetLayers.ts
import type { BaseMapConfig, BaseMapLayerId } from '../types/map';

export const BASE_MAPS: Record<BaseMapLayerId, BaseMapConfig> = {
  'maaamet-pohikaart': {
    id: 'maaamet-pohikaart',
    name: 'Põhikaart',
    category: 'maaamet',
    url: 'https://tiles.maaamet.ee/tm/tms/1.0.0/kaart@GMC/{z}/{x}/{y}.png',
    tms: true,
    attribution: '&copy; <a href="https://www.maaamet.ee" target="_blank" rel="noreferrer">Maa-amet</a>',
    minZoom: 6,
    maxZoom: 19
  },
  'maaamet-foto': {
    id: 'maaamet-foto',
    name: 'Ortofoto',
    category: 'maaamet',
    url: 'https://tiles.maaamet.ee/tm/tms/1.0.0/foto@GMC/{z}/{x}/{y}.jpg',
    tms: true,
    attribution: '&copy; <a href="https://www.maaamet.ee" target="_blank" rel="noreferrer">Maa-amet</a>',
    minZoom: 6,
    maxZoom: 19
  }
};

export const MAAAMET_CADASTRE_WMS = {
  url: 'https://gsavalik.envir.ee/geoserver/kataster/wms',
  layers: 'kataster:ky_kehtiv,kataster:ky_aadress',
  format: 'image/png',
  transparent: true,
  version: '1.1.1',
  maxZoom: 20,
  minZoom: 10,
  attribution: '&copy; <a href="https://geoportaal.maaruum.ee" target="_blank" rel="noreferrer">Maa- ja Ruumiamet (Kataster)</a>'
};
