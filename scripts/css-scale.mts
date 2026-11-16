// scripts/css-scale.mts — viib CSS-faili kirjasuurused, nurgad ja vahed skaalale (src/tooling/cssScale.ts).
// Kasutus: npx tsx scripts/css-scale.mts src/index.css [--dry]
import { readFileSync, writeFileSync } from 'node:fs';
import { rescaleCss } from '../src/tooling/cssScale.ts';

const [file, flag] = process.argv.slice(2);
if (!file) throw new Error('Anna CSS-faili tee');
const before = readFileSync(file, 'utf8');
const { css, manual } = rescaleCss(before);
if (flag !== '--dry') writeFileSync(file, css);
console.log(`${file}: ${before === css ? 'muutusi pole' : 'muudetud'}${flag === '--dry' ? ' (kuiv käivitus)' : ''}`);
if (manual.length) console.log(`Käsitsi (> 32px):\n  ${manual.join('\n  ')}`);
