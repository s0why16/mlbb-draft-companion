import { HEROES } from '../src/data/heroes.ts';
console.log('count', HEROES.length);
console.log(HEROES.filter(h => h.name === 'None').map(h=>h.id));
for (const h of HEROES) {
  console.log([h.name, h.lanes.join('/'), h.roles.join('/'), h.damage, h.tags.join(','), `meta:${h.meta}`, `rank:${h.metaRank}`, `patch:${h.patch?.status ?? '-'}`].join(' | '));
}
