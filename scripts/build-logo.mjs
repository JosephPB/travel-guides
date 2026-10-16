import opentype from 'opentype.js';
import { writeFileSync, readFileSync } from 'node:fs';
// Outline the lettering so the browser never needs the source font.
const font = opentype.parse(Uint8Array.from(readFileSync(process.argv[2] || '/System/Library/Fonts/Supplemental/Arial Bold.ttf')).buffer);
const lines = [['never a', 67, 128], ['lonely planet', 104, 253], ['with you', 67, 361]];
for (const [name, color] of [['logo-lowercase.svg','#12365a'],['logo-white-lowercase.svg','#ffffff']]) {
 const lettering = lines.map(([text,size,y]) => { const width = font.getAdvanceWidth(text,size); return font.getPath(text,(960-width)/2,y,size).toPathData(2); });
 const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 460" role="img" aria-labelledby="title"><title id="title">never a lonely planet with you</title><circle cx="480" cy="230" r="209" fill="none" stroke="${color}" stroke-width="5"/><g fill="${color}">${lettering.map(d=>`<path d="${d}"/>`).join('')}</g></svg>`;
 writeFileSync(`public/assets/${name}`,svg);
}
