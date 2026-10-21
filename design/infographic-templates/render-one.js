// 사용: node render-one.js <입력.html> <출력.png>   (1200x675, 한글 웹폰트 로드 대기)
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const [, , src, out] = process.argv;
  if (!src || !out) { console.error('usage: node render-one.js in.html out.png'); process.exit(1); }
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const p = await b.newPage({ viewport: { width: 1200, height: 675 } });
  await p.goto('file://' + path.resolve(src));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  await p.screenshot({ path: out });
  await b.close();
})();
