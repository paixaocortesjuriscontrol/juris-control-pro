import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFile } from 'node:fs/promises';
const data = new Uint8Array(await readFile('/tmp/djet/trt10.pdf'));
const pdf = await pdfjsLib.getDocument({data, disableFontFace:true, useSystemFonts:false, isEvalSupported:false, disableWorker:true}).promise;
let all='';
for (let i=1;i<=pdf.numPages;i++){
 const page=await pdf.getPage(i); const content=await page.getTextContent();
 all += content.items.map(it => `${it.str||''}${it.hasEOL?'\n':' '}`).join('')+'\n';
}
console.log('pages', pdf.numPages, 'hasCarlos', all.includes('CARLOS'), 'has0000039', all.includes('0000039'), 'len', all.length);
console.log(all.match(/.{0,80}(CARLOS|0000039|ADVOGADO|PAUTA|Sessão Ordinária de Julgamento).{0,120}/g)?.slice(0,20).join('\n---\n') || 'no matches');
