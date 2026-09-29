// Writes a minimal, well-formed multi-page PDF (with xref) for import testing.
const fs = require('fs');
const N = Number(process.argv[2] || 1);
const objs = [];
objs.push('<</Type/Catalog/Pages 2 0 R>>');
objs.push(null); // pages, filled after
objs.push('<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>');
objs.push('<</Title(Ritual Test PDF)/Author(Test Author)>>');
const kids = [];
for (let i = 1; i <= N; i++) {
  const stream = `BT /F1 24 Tf 40 150 Td (Hello Ritual page ${i}) Tj ET`;
  const contentId = objs.length + 1;
  objs.push(`<</Length ${stream.length}>>stream\n${stream}\nendstream`);
  const pageId = objs.length + 1;
  objs.push(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 300]/Contents ${contentId} 0 R/Resources<</Font<</F1 3 0 R>>>>>>`);
  kids.push(`${pageId} 0 R`);
}
objs[1] = `<</Type/Pages/Kids[${kids.join(' ')}]/Count ${N}>>`;
let out = '%PDF-1.4\n';
const offsets = [];
objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
const xref = out.length;
out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
for (const off of offsets) out += String(off).padStart(10, '0') + ' 00000 n \n';
out += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R/Info 4 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
fs.writeFileSync('.tmp-test-book.pdf', out, 'latin1');
console.log('wrote', out.length, 'bytes,', N, 'pages');
