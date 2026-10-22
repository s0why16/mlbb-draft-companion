const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const profile = { version: 1, rank: 'mythic', pools: { exp: [{ heroId: 'lukas', winRate: 60, matches: 120 }], gold: [{ heroId: 'obsidia' }], mid: [{ heroId: 'eudora', winRate: 55, matches: 80 }], jungle: [{ heroId: 'hirara' }], roam: [{ heroId: 'belerick' }] }, updatedAt: new Date().toISOString() };
    const draft = { createdAt: new Date().toISOString(), lane: null, bans: { ally: [null,null,null,null,null], enemy: [null,null,null,null,null] }, picks: { ally: [null,null,null,null,null], enemy: [null,null,null,null,null] }, myHeroId: null, mySlot: null };
    localStorage.setItem('mlbb-draft-companion:v1', JSON.stringify({ profile, draft, screen: 'home' }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const cloud = page.locator('.cloud-card');
  await cloud.scrollIntoViewIfNeeded();
  console.log('CLOUD TEXT:', (await cloud.innerText()).slice(0, 500));
  const create = page.getByRole('button', { name: /Create backup/i });
  console.log('CREATE VISIBLE:', await create.isVisible());
  if (await create.isVisible()) {
    await create.click();
    await page.waitForTimeout(2000);
    console.log('AFTER CREATE:', (await cloud.innerText()).slice(0, 500));
  }
  console.log('ERRORS:', errors);
  await page.screenshot({ path: 'shots/15-cloud.png', fullPage: false });
  await browser.close();
})();
