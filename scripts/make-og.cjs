const { chromium } = require('@playwright/test');
const sharp = require('sharp');
const fs = require('fs');
(async () => {
  fs.mkdirSync('docs', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/preview.png' });
  const hero = page.locator('.home-hero');
  await hero.screenshot({ path: 'shots/og-raw.png' });
  await sharp('shots/og-raw.png').resize(1200, 630, { fit: 'cover', position: 'centre' }).png({ quality: 90 }).toFile('public/og.png');
  console.log('preview:', fs.statSync('docs/preview.png').size, 'og:', fs.statSync('public/og.png').size);
  await browser.close();
})();
