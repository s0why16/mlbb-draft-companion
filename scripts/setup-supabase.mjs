import fs from 'node:fs';
import path from 'node:path';

function readEnv(file) {
  const vars = {};
  if (!fs.existsSync(file)) return vars;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    vars[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return vars;
}

const env = { ...readEnv('.env'), ...readEnv('.env.local') };
const pat = env.SUPABASE_PAT;
const supabaseUrl = env.SUPABASE_URL;
if (!pat || !supabaseUrl) {
  console.error('SUPABASE_PAT and SUPABASE_URL are required in .env');
  process.exit(1);
}

const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
const sql = fs.readFileSync(path.join('supabase', 'schema.sql'), 'utf8');

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${pat}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const text = await response.text();
if (!response.ok) {
  console.error(`Supabase setup failed (${response.status}):`, text);
  process.exit(1);
}
console.log(`Supabase profile schema applied to ${projectRef}.`);
console.log(text.slice(0, 500));

