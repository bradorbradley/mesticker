// Combine sheets/*.svg into one 17x11 PDF. Usage: node build_pdf.js <sheets_dir> <img_dir> <out.pdf>
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const [dir, imgDir, out] = process.argv.slice(2);
  const idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json')));
  let html = '<html><head><style>@page{size:17in 11in;margin:0}body{margin:0}svg{width:17in;height:11in;display:block;page-break-after:always}</style></head><body>';
  for (const s of idx) {
    let svg = fs.readFileSync(path.join(dir, s.num + '.svg'), 'utf8');
    svg = svg.replace(/href="img\/([^"]+)"/g, (m, f) => {
      const p = path.join(imgDir, f); if (!fs.existsSync(p)) return m;
      const ext = f.endsWith('.png') ? 'png' : 'jpeg';
      return `href="data:image/${ext};base64,${fs.readFileSync(p).toString('base64')}"`;
    });
    html += svg;
  }
  html += '</body></html>';
  const tmp = path.join(dir, '_all.html'); fs.writeFileSync(tmp, html);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + tmp, { waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.pdf({ path: out, width: '17in', height: '11in', printBackground: true });
  await b.close(); console.log('pdf', out);
})();
