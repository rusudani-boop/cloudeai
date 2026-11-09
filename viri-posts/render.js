// Render html/*.html to png/*.png at 1080x1080 and build a contact sheet.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const dir = __dirname;
  const names = JSON.parse(fs.readFileSync(path.join(dir, 'html/index.json')));
  fs.mkdirSync(path.join(dir, 'png'), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
  for (const n of names) {
    await page.goto('file://' + path.join(dir, 'html', n + '.html'));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(dir, 'png', n + '.png') });
    console.log('rendered', n);
  }
  const imgs = names.map(n => `<img src="file://${path.join(dir, 'png', n + '.png')}">`).join('');
  await page.setViewportSize({ width: 1620, height: 1620 });
  await page.setContent(`<style>body{margin:0;background:#000;display:grid;grid-template-columns:repeat(3,540px)}img{width:540px;height:540px;display:block}</style>${imgs}`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(dir, 'grid-preview.png') });
  await browser.close();
})();
