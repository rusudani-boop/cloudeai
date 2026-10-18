// Renders cv-ka.html and cv-en.html to A4 PDFs next to them: node cv/make-pdf.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  for (const [src, out] of [['cv-ka.html', 'Nana_Sanikidze_CV_KA.pdf'], ['cv-en.html', 'Nana_Sanikidze_CV_EN.pdf']]) {
    const page = await browser.newPage();
    await page.goto('file://' + path.join(__dirname, src), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const over = await page.evaluate(() => { const m = document.querySelector('.main'), s = document.querySelector('.side'); return [m.scrollHeight - m.clientHeight, s.scrollHeight - s.clientHeight]; });
    console.log(src, 'overflow main/side px:', over);
    await page.pdf({ path: path.join(__dirname, out), format: 'A4', printBackground: true, preferCSSPageSize: true });
  }
  await browser.close();
})();
