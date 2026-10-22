const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const logs = [];
  page.on('console', m => logs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  page.on('requestfailed', r => logs.push('REQFAIL: ' + r.url() + ' ' + (r.failure()?.errorText || '')));
  const res = await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  console.log('status', res.status());
  console.log('text', (await page.locator('body').innerText()).slice(0, 300));
  console.log('logs', logs.slice(0, 20));
  await page.screenshot({ path: 'shots/16-current.png' });
  await browser.close();
})();
