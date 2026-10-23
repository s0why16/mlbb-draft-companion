import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const sourceDir = path.join(root, 'public', 'heroes');
const sizes = [64, 96];
const files = fs.readdirSync(sourceDir).filter((file) => file.endsWith('.webp') && !file.startsWith('_'));

for (const size of sizes) {
  fs.mkdirSync(path.join(sourceDir, String(size)), { recursive: true });
}

let cursor = 0;
let completed = 0;

async function worker() {
  while (cursor < files.length) {
    const file = files[cursor++];
    const input = path.join(sourceDir, file);
    for (const size of sizes) {
      await sharp(input)
        .resize(size, size, { fit: 'cover' })
        .webp({ quality: 80, effort: 4 })
        .toFile(path.join(sourceDir, String(size), file));
    }
    completed++;
  }
}

await Promise.all(Array.from({ length: 6 }, worker));

const total = sizes.reduce((sum, size) => {
  const dir = path.join(sourceDir, String(size));
  return sum + fs.readdirSync(dir).filter((file) => file.endsWith('.webp')).reduce((bytes, file) => bytes + fs.statSync(path.join(dir, file)).size, 0);
}, 0);

console.log(`Built ${completed} portraits at ${sizes.join('px and ')}px. Total: ${(total / 1024 / 1024).toFixed(2)} MB`);
