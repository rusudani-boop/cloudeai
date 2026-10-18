// Renders cv-ka.html and cv-en.html to A4 PDFs next to them: node cv/make-pdf.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  for (const [src, out] of [['cv-ka.html', 'Nana_Sanikidze_CV_KA.pdf'], ['cv-en.html', 'Nana_Sanikidze_CV_EN.pdf']]) {
    const page = await browser.newPage();
    await page.goto('file://' + path.join(__dirname, src), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const over = await page.evaluate(() => { const pg = document.querySelector('.page').getBoundingClientRect().bottom; return ['.main > section > .job:last-child', '.side > :last-child'].map(q => Math.round(document.querySelector(q).getBoundingClientRect().bottom - pg)); });
    console.log(src, 'last item bottom vs page bottom, px (must be < 0):', over);
    if (over.some(v => v > 0)) process.exitCode = 1;
    await page.pdf({ path: path.join(__dirname, out), format: 'A4', printBackground: true, preferCSSPageSize: true });
  }
  await browser.close();
})();
