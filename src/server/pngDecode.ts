// src/server/pngDecode.ts
// Minimaalne PNG dekooder (8-bitine RGBA, RGB, hall ja paletiga, ilma põimimiseta) → RGBA pikslid.
import { inflateSync } from 'zlib';

export interface DecodedPng {
  width: number;
  height: number;
  /** RGBA, rida-realt */
  rgba: Uint8Array;
}

export function decodePng(buf: Buffer): DecodedPng {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Pole PNG');
  let pos = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  let palette: Buffer | null = null;
  let trns: Buffer | null = null;
  const idat: Buffer[] = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  if (bitDepth !== 8 || interlace !== 0) throw new Error(`Toetamata PNG (bitisügavus ${bitDepth}, põimitud ${interlace})`);
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[colorType];
  if (!channels) throw new Error(`Toetamata PNG värvitüüp ${colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rgba = new Uint8Array(width * height * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = new Uint8Array(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let p = 0;
      if (filter === 1) p = a;
      else if (filter === 2) p = b;
      else if (filter === 3) p = (a + b) >> 1;
      else if (filter === 4) {
        const q = a + b - c;
        const pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c);
        p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[x] = (line[x] + p) & 255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (colorType === 6) {
        rgba.set(line.subarray(x * 4, x * 4 + 4), o);
      } else if (colorType === 2) {
        rgba[o] = line[x * 3]; rgba[o + 1] = line[x * 3 + 1]; rgba[o + 2] = line[x * 3 + 2]; rgba[o + 3] = 255;
      } else if (colorType === 3) {
        const k = line[x];
        rgba[o] = palette?.[k * 3] ?? 0; rgba[o + 1] = palette?.[k * 3 + 1] ?? 0; rgba[o + 2] = palette?.[k * 3 + 2] ?? 0;
        rgba[o + 3] = trns && k < trns.length ? trns[k] : 255;
      } else {
        const g = line[x * channels];
        rgba[o] = rgba[o + 1] = rgba[o + 2] = g;
        rgba[o + 3] = colorType === 4 ? line[x * 2 + 1] : 255;
      }
    }
    prev = line;
  }
  return { width, height, rgba };
}
