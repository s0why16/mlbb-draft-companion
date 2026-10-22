const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'shots/home-1440.png', fullPage: true });
  console.log('TITLE:', await page.title());
  console.log('URL:', page.url());
  console.log('TEXT:', (await page.locator('body').innerText()).slice(0, 700));
  console.log('ERRORS:', errors);
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await mobile.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await mobile.screenshot({ path: 'shots/home-390.png', fullPage: true });
  await browser.close();
})();
