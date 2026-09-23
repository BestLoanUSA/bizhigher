// OG 이미지 재생성: node src/og/make-og.js  (Playwright 필요) → src/og-image.png
const path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.goto('file://' + path.join(__dirname, 'og.html'), { waitUntil: 'networkidle' });
  await p.screenshot({ path: path.join(__dirname, '..', 'og-image.png') });
  await b.close();
})();
