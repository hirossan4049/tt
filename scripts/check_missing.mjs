import { readFileSync } from 'fs';

const manifestCode = readFileSync('src/lib/img-manifest.ts', 'utf8');
const manifestJson = manifestCode.replace(/^[\s\S]*?export const IMG_MANIFEST[\s\S]*?=\s*/, '').replace(/;\s*$/m, '');
const manifest = JSON.parse(manifestJson);

const dataCode = readFileSync('src/lib/data.ts', 'utf8');
const imgMatch = dataCode.match(/export const IMG: Record<string, string> = (\{[\s\S]*?\n\});/m);
const img = eval('(' + imgMatch[1] + ')');

const json = JSON.parse(readFileSync('tomorrowland_tl26th_w1.json', 'utf8'));
const performers = [...new Set(json.performances.map(p => p.name))];

const missingFromManifest = performers.filter(n => !manifest[n]);
const inImgNotManifest = Object.keys(img).filter(k => !manifest[k]);

console.log('Performers not in manifest:', missingFromManifest.length);
missingFromManifest.forEach(n => console.log(' -', n));
console.log('\nIMG entries not in manifest:', inImgNotManifest.length);
inImgNotManifest.forEach(n => console.log(' -', n, img[n]));
