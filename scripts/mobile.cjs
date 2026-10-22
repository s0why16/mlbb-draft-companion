const { chromium } = require('@playwright/test');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  const profile = { version: 1, rank: 'mythic', pools: {
    exp: [{ heroId: 'lukas', winRate: 58, matches: 140 }, { heroId: 'sora' }, { heroId: 'argus' }, { heroId: 'masha' }, { heroId: 'phoveus' }],
    gold: [{ heroId: 'obsidia', winRate: 61, matches: 95 }, { heroId: 'hanabi' }, { heroId: 'miya' }, { heroId: 'melissa' }, { heroId: 'bruno' }],
    mid: [{ heroId: 'eudora', winRate: 57, matches: 200 }, { heroId: 'selena', winRate: 54, matches: 90 }, { heroId: 'zetian' }, { heroId: 'cyclops' }, { heroId: 'nana' }],
    jungle: [{ heroId: 'hirara', winRate: 64, matches: 70 }, { heroId: 'lukas' }, { heroId: 'joy' }, { heroId: 'nolan' }, { heroId: 'suyou' }],
    roam: [{ heroId: 'belerick', winRate: 60, matches: 160 }, { heroId: 'khufra' }, { heroId: 'kalea' }, { heroId: 'minotaur' }, { heroId: 'chip' }]
  }, updatedAt: new Date().toISOString() };
  const draft = { createdAt: new Date().toISOString(), lane: 'mid', bans: { ally: ['fanny','kalea','zhuxin','sora',null], enemy: ['lukas','belerick','obsidia',null,null] }, picks: { ally: ['eudora', null, null, null, null], enemy: ['hirara', null, null, null, null] }, myHeroId: 'eudora', mySlot: 0 };
  async function seed(screen, d = draft) {
    await page.evaluate(({ profile, draft, screen }) => {
      localStorage.setItem('mlbb-draft-companion:v1', JSON.stringify({ profile, draft, screen }));
    }, { profile, draft: d, screen });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
  }
  async function audit(name) {
    const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, bw: document.body.scrollWidth }));
    console.log(name, overflow);
    if (overflow.sw > overflow.iw + 1) {
      const offenders = await page.evaluate(() => [...document.querySelectorAll('*')].filter(el => el.getBoundingClientRect().right > innerWidth + 2).slice(0, 8).map(el => el.className || el.tagName));
      console.log('OFFENDERS', offenders);
    }
    await page.screenshot({ path: `shots/m-${name}.png`, fullPage: true });
  }
  await seed('setup');
  await audit('setup');
  await seed('ban');
  await audit('ban');
  await seed('draft');
  await audit('draft');
  await page.getByRole('button', { name: /My turn/i }).first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'shots/m-turn-scan.png' });
  await page.getByRole('button', { name: /Reveal now/i }).click();
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  console.log('turn-results', overflow);
  await page.screenshot({ path: 'shots/m-turn-results.png' });
  await page.getByRole('button', { name: /Lock & transfer/i }).first().click();
  await page.waitForTimeout(500);
  const fullDraft = await page.evaluate(() => JSON.parse(localStorage.getItem('mlbb-draft-companion:v1')).draft);
  fullDraft.picks = { ally: ['eudora','tigreal','claude','khufra','ling'], enemy: ['fanny','estes','atlas','wanwan','paquito'] };
  fullDraft.myHeroId = 'eudora';
  fullDraft.mySlot = 0;
  await seed('strategy', fullDraft);
  await audit('strategy');
  console.log('ERRORS', errors);
  await browser.close();
})();
