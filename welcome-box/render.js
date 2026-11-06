// Renders out/*.svg into print PDFs and preview PNGs (uses the preinstalled Playwright/Chromium).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'out');
const svg = (n) => fs.readFileSync(path.join(OUT, n), 'utf8');
const mm = (s) => parseFloat(s);

function size(s) {
  const w = s.match(/width="([\d.]+)mm"/)[1], h = s.match(/height="([\d.]+)mm"/)[1];
  return { w: mm(w), h: mm(h) };
}

(async () => {
  const browser = await chromium.launch();

  // 1) Print PDFs — 1:1 scale, page = trim + 3 mm bleed
  for (const name of ['lid-dieline', 'base-dieline']) {
    const s = svg(`${name}.svg`), { w, h } = size(s);
    const page = await browser.newPage();
    await page.setContent(`<style>@page{size:${w}mm ${h}mm;margin:0}html,body{margin:0}svg{display:block}</style>${s}`);
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: path.join(OUT, `${name}.pdf`), width: `${w}mm`, height: `${h}mm`, printBackground: true });
    await page.close();
  }

  // 2) Annotated dieline preview PNG
  {
    const s = svg('lid-dieline-annotated.svg'), { w, h } = size(s);
    const page = await browser.newPage({ viewport: { width: Math.round(w * 4), height: Math.round(h * 4) }, deviceScaleFactor: 2 });
    await page.setContent(`<style>html,body{margin:0}svg{width:100vw;height:100vh;display:block}</style>${s}`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT, 'lid-dieline-preview.png') });
    await page.close();
  }

  // 3) 3D mockup
  {
    const k = 3.6, L = 243 * k, W = 80 * k, H = 39 * k;
    const top = 'data:image/svg+xml;base64,' + Buffer.from(svg('_top.svg')).toString('base64');
    const front = 'data:image/svg+xml;base64,' + Buffer.from(svg('_front.svg')).toString('base64');
    const html = `<style>
      html,body{margin:0;height:100%}
      body{background:radial-gradient(ellipse at 50% 35%,#f4f5f7 0%,#dfe2e7 70%,#cfd3da 100%);display:grid;place-items:center;overflow:hidden}
      .scene{perspective:2200px;width:${L}px;height:${W}px}
      .box{position:relative;width:${L}px;height:${W}px;transform-style:preserve-3d;transform:rotateX(56deg) rotateZ(-22deg) translateZ(${H / 2}px)}
      .f{position:absolute;background-size:100% 100%;backface-visibility:hidden}
      .top{width:${L}px;height:${W}px;background-image:url(${top});transform:translateZ(${H / 2}px);
           box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}
      .top::after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.13),rgba(255,255,255,0) 45%,rgba(0,0,0,.12))}
      .front{width:${L}px;height:${H}px;background-image:url(${front});transform-origin:top;transform:translateY(${W}px) translateZ(${H / 2}px) rotateX(-90deg)}
      .front::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.28))}
      .right{width:${H}px;height:${W}px;background:#0e1f3a;transform-origin:left;transform:translateX(${L}px) translateZ(${H / 2}px) rotateY(90deg)}
      .left{width:${H}px;height:${W}px;background:#0b1a33;transform-origin:left;transform:translateZ(${H / 2}px) rotateY(90deg)}
      .shadow{position:absolute;width:${L}px;height:${W}px;transform:translateZ(${-H / 2}px);background:rgba(0,0,0,.45);filter:blur(26px)}
      .seam{position:absolute;left:0;right:0;bottom:7px;height:1px;background:rgba(0,0,0,.35)}
    </style>
    <div class="scene"><div class="box">
      <div class="shadow"></div>
      <div class="f front"><div class="seam"></div></div>
      <div class="f right"></div>
      <div class="f left"></div>
      <div class="f top"></div>
    </div></div>`;
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
    await page.setContent(html);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, 'mockup.png') });
    // flat top view
    await page.setContent(`<style>html,body{margin:0;background:#e6e8ec;display:grid;place-items:center;height:100%}
      img{width:1150px;box-shadow:0 30px 60px rgba(0,0,0,.3);border-radius:3px}</style><img src="${top}">`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, 'top-view.png') });
    await page.close();
  }
  await browser.close();
  for (const f of fs.readdirSync(OUT).filter((f) => f.startsWith('_'))) fs.unlinkSync(path.join(OUT, f));
  console.log(fs.readdirSync(OUT).join('\n'));
})();
