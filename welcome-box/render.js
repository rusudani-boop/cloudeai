// Renders out/*.svg into print PDFs, a dieline preview, 3D textures, and the 3D viewer page.
// Uses the preinstalled Playwright/Chromium.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'out');
const TEX = path.join(OUT, 'tex');
fs.mkdirSync(TEX, { recursive: true });
const read = (p) => fs.readFileSync(p, 'utf8');
const size = (s) => ({ w: parseFloat(s.match(/width="([\d.]+)mm"/)[1]), h: parseFloat(s.match(/height="([\d.]+)mm"/)[1]) });
const PX_PER_MM = 7;

(async () => {
  const browser = await chromium.launch();

  // 1) Print PDFs, 1:1 scale (dielines include 3 mm bleed)
  const svgs = fs.readdirSync(OUT).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4));
  for (const name of svgs.filter((n) => !n.endsWith('-annotated'))) {
    const s = read(path.join(OUT, `${name}.svg`)), { w, h } = size(s);
    const page = await browser.newPage();
    await page.setContent(`<style>@page{size:${w}mm ${h}mm;margin:0}html,body{margin:0}svg{display:block}</style>${s}`);
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: path.join(OUT, `${name}.pdf`), width: `${w}mm`, height: `${h}mm`, printBackground: true });
    await page.close();
  }

  // 2) Rasterise SVGs (dieline preview + 3D textures)
  const raster = async (svgPath, outPath, scale, type) => {
    const s = read(svgPath), { w, h } = size(s);
    const page = await browser.newPage({ viewport: { width: Math.round(w * scale), height: Math.round(h * scale) } });
    await page.setContent(`<style>html,body{margin:0;overflow:hidden}svg{width:100vw;height:100vh;display:block}</style>${s}`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: outPath, type, ...(type === 'jpeg' ? { quality: 90 } : {}) });
    await page.close();
  };
  for (const n of svgs.filter((n) => n.endsWith('-annotated')))
    await raster(path.join(OUT, `${n}.svg`), path.join(OUT, `${n.replace('-annotated', '')}-preview.png`), 5, 'png');
  for (const f of fs.readdirSync(path.join(OUT, 'faces'))) {
    const mask = f.endsWith('-mask.svg');
    await raster(path.join(OUT, 'faces', f), path.join(TEX, f.replace('.svg', mask ? '.png' : '.jpg')), PX_PER_MM, mask ? 'png' : 'jpeg');
  }

  await browser.close();

  // 3) 3D viewer: inline the textures into viewer.template.html
  const tex = {};
  for (const f of fs.readdirSync(TEX)) {
    const mime = f.endsWith('.png') ? 'image/png' : 'image/jpeg';
    tex[f.replace(/\.(png|jpg)$/, '')] = `data:${mime};base64,${fs.readFileSync(path.join(TEX, f)).toString('base64')}`;
  }
  const html = read(path.join(__dirname, 'viewer.template.html')).replace('/*TEXTURES*/{}', JSON.stringify(tex));
  fs.writeFileSync(path.join(OUT, 'box-3d.html'), html);
  console.log('done', (html.length / 1e6).toFixed(2), 'MB viewer');
})();
