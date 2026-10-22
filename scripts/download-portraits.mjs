import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const cache = path.join(process.env.TEMP || '', 'mlbb');
const raw = JSON.parse(fs.readFileSync(path.join(cache, 'heroes.json'), 'utf8'));
const heroes = raw.data.filter((h) => h && h.hero_name && h.uid && h.hero_name !== 'None' && h.uid !== 'null');
const outDir = path.join(root, 'public', 'heroes');
fs.mkdirSync(outDir, { recursive: true });

const SPECIAL = {
  sora: 'https://akmweb.youngjoygame.com/web/svnres/img/test/homepage_2_2_16_1232_1/100_4749a1f7fe99cbedfc5ef23fc1287d6c.png',
};

function fallbackSvg(name) {
  const initial = name.slice(0, 1).toUpperCase();
  return Buffer.from(`<svg width="192" height="192" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#16405a"/><stop offset="0.55" stop-color="#0f2233"/><stop offset="1" stop-color="#251638"/>
    </linearGradient></defs>
    <rect width="192" height="192" fill="url(#g)"/>
    <circle cx="96" cy="96" r="62" fill="none" stroke="#62e7ff" stroke-opacity=".22" stroke-width="2"/>
    <text x="96" y="119" text-anchor="middle" font-family="Arial, sans-serif" font-size="74" font-weight="700" fill="#dff9ff" fill-opacity=".9">${initial}</text>
  </svg>`);
}

async function makeCover(input) {
  return sharp(input)
    .resize(192, 192, { fit: 'cover', position: 'north' })
    .webp({ quality: 84, effort: 4 })
    .toBuffer();
}

const queue = heroes.map((h) => ({ ...h, source: SPECIAL[h.uid] || h.portrait }));
let completed = 0;
let failed = 0;

async function worker() {
  while (queue.length) {
    const hero = queue.shift();
    try {
      let buffer;
      if (hero.source) {
        const res = await fetch(hero.source, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
            Referer: 'https://www.mobilelegends.com/',
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const type = res.headers.get('content-type') || '';
        if (!type.startsWith('image/')) throw new Error(`not an image: ${type}`);
        buffer = Buffer.from(await res.arrayBuffer());
      } else {
        throw new Error('no portrait URL');
      }
      const webp = await makeCover(buffer);
      fs.writeFileSync(path.join(outDir, `${hero.uid}.webp`), webp);
      completed++;
    } catch (error) {
      try {
        const webp = await sharp(fallbackSvg(hero.hero_name)).webp({ quality: 82 }).toBuffer();
        fs.writeFileSync(path.join(outDir, `${hero.uid}.webp`), webp);
      } catch {}
      failed++;
      console.log(`fallback ${hero.uid}: ${error.message}`);
    }
  }
}

await Promise.all(Array.from({ length: 6 }, worker));
await sharp(fallbackSvg('?')).webp({ quality: 82 }).toFile(path.join(outDir, '_fallback.webp'));

fs.writeFileSync(
  path.join(outDir, 'ATTRIBUTION.md'),
  `# Hero portraits\n\nPortraits are the property of Moonton / Mobile Legends: Bang Bang, used here for a non-commercial fan companion.\nSource: official Mobile Legends CDN and the MLBB open data community. Images were resized and cropped for this interface.\n\nIf you are a rights holder and would like these removed, open an issue in the repository.\n`,
);

const size = fs.readdirSync(outDir).filter((f) => f.endsWith('.webp')).reduce((n, f) => n + fs.statSync(path.join(outDir, f)).size, 0);
console.log(`Downloaded ${completed} portraits, ${failed} fallbacks. Total: ${(size / 1024 / 1024).toFixed(2)} MB`);
