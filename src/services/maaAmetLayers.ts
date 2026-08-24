// src/services/maaAmetLayers.ts
import type { BaseMapConfig, BaseMapLayerId } from '../types/map';

export const BASE_MAPS: Record<BaseMapLayerId, BaseMapConfig> = {
  'maaamet-pohikaart': {
    id: 'maaamet-pohikaart',
    name: 'Maa-amet Põhikaart',
    category: 'maaamet',
    url: 'https://tiles.maaamet.ee/tm/tms/1.0.0/kaart@GMC/{z}/{x}/{y}.png',
    tms: true,
    attribution: '&copy; <a href="https://www.maaamet.ee" target="_blank" rel="noreferrer">Maa-amet</a>',
    minZoom: 6,
    maxZoom: 19
  },
  'maaamet-foto': {
    id: 'maaamet-foto',
    name: 'Maa-amet Ortofoto',
    category: 'maaamet',
    url: 'https://tiles.maaamet.ee/tm/tms/1.0.0/foto@GMC/{z}/{x}/{y}.jpg',
    tms: true,
    attribution: '&copy; <a href="https://www.maaamet.ee" target="_blank" rel="noreferrer">Maa-amet</a>',
    minZoom: 6,
    maxZoom: 19
  },
  'maaamet-hybriid': {
    id: 'maaamet-hybriid',
    name: 'Maa-amet Hübriid',
    category: 'maaamet',
    url: 'https://tiles.maaamet.ee/tm/tms/1.0.0/hybriid@GMC/{z}/{x}/{y}.png',
    tms: true,
    attribution: '&copy; <a href="https://www.maaamet.ee" target="_blank" rel="noreferrer">Maa-amet</a>',
    minZoom: 6,
    maxZoom: 19
  },
  'maaamet-hallkaart': {
    id: 'maaamet-hallkaart',
    name: 'Maa-amet Hallkaart',
    category: 'maaamet',
    url: 'https://tiles.maaamet.ee/tm/tms/1.0.0/hallkaart@GMC/{z}/{x}/{y}.png',
    tms: true,
    attribution: '&copy; <a href="https://www.maaamet.ee" target="_blank" rel="noreferrer">Maa-amet</a>',
    minZoom: 6,
    maxZoom: 19
  },
  'osm-standard': {
    id: 'osm-standard',
    name: 'OpenStreetMap',
    category: 'osm',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    tms: false,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    minZoom: 3,
    maxZoom: 19,
    subdomains: ['a', 'b', 'c']
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
