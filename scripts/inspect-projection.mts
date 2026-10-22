import { createProfile, emptyDraft } from '../src/lib/storage.ts';
import { evaluateDraft } from '../src/lib/engine.ts';
const p = createProfile('mythic');
p.pools.mid = [
  { heroId: 'eudora', winRate: 58, matches: 200 },
  { heroId: 'selena', winRate: 54, matches: 90 },
  { heroId: 'zetian', winRate: 52, matches: 60 },
  { heroId: 'cyclops' },
  { heroId: 'nana' },
];
const d = emptyDraft(); d.lane='mid'; d.picks.ally=[ 'eudora',null,null,null,null]; d.picks.enemy=['hirara',null,null,null,null];
const e = evaluateDraft(d,p);
console.log('base', e.winRate, e.confidence);
for (const s of e.suggestions) console.log(s.hero.name, s.projectedWinRate.toFixed(2), s.delta.toFixed(2), s.score.toFixed(1));
