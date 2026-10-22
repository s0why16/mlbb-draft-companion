import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Crosshair,
  Lock,
  Search,
  ShieldBan,
  Sparkles,
  Swords,
  Timer,
  WandSparkles,
  X,
} from 'lucide-react';
import type { Hero, Team } from '../types';
import { HEROES } from '../data/heroes';
import { LANE_BY_ID, PATCH_LABEL, RANK_BY_ID } from '../data/meta';
import { REGION_BY_ID } from '../data/regions';
import { partyLabel } from '../lib/party';
import { useGame } from '../state/GameContext';
import { suggestBans, metaGrade } from '../lib/engine';
import { searchHeroes, usedHeroIds } from '../lib/search';
import { cn } from '../lib/cn';
import { Button, Chip, Eyebrow, Kbd } from '../components/Primitives';
import { HeroPortrait } from '../components/HeroPortrait';
import { HeroPicker } from '../components/HeroPicker';
import { PatchBadge } from '../components/PatchBadge';
import { useToast } from '../components/Toast';

export function BanScreen() {
  const { state, dispatch } = useGame();
  const toast = useToast();
  const profile = state.profile!;
  const rank = RANK_BY_ID[profile.rank];
  const region = REGION_BY_ID[profile.region];
  const partySize = (profile.party?.length ?? 0) + 1;
  const [banTeam, setBanTeam] = useState<Team>('ally');
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState(0);
  const [picker, setPicker] = useState<{ open: boolean; team: Team; index: number }>({ open: false, team: 'ally', index: 0 });
  const searchRef = useRef<HTMLInputElement>(null);

  const used = useMemo(() => usedHeroIds(state.draft), [state.draft]);
  const suggestions = useMemo(() => suggestBans(profile, state.draft, 5), [profile, state.draft]);
  const results = useMemo(() => (query.trim() ? searchHeroes(query, { exclude: used, limit: 6 }) : []), [query, used]);
  const allyBans = state.draft.bans.ally.slice(0, rank.bansPerTeam).filter(Boolean).length;
  const enemyBans = state.draft.bans.enemy.slice(0, rank.bansPerTeam).filter(Boolean).length;
  const allyFull = allyBans >= rank.bansPerTeam;
  const enemyFull = enemyBans >= rank.bansPerTeam;

  const openSlot = (team: Team): number => state.draft.bans[team].slice(0, rank.bansPerTeam).findIndex((id) => !id);
  const activeTeamFull = banTeam === 'ally' ? allyFull : enemyFull;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const placeBan = (team: Team, index: number, heroId: string | null) => {
    dispatch({ type: 'SET_BAN', team, index, heroId });
  };

  const banFromSearch = (hero: Hero) => {
    const slot = openSlot(banTeam);
    if (slot === -1) {
      toast.push(`All ${banTeam} bans are filled`, { tone: 'info', detail: 'Clear a slot with × before adding another ban.' });
      return;
    }
    placeBan(banTeam, slot, hero.id);
    setQuery('');
    setFocus(0);
    toast.push(`${hero.name} banned`, { detail: `${banTeam === 'ally' ? 'Blue' : 'Red'} ban ${slot + 1} · ${rank.bansPerTeam} per team` });
    if (slot + 1 >= rank.bansPerTeam) {
      window.setTimeout(() => {
        if (banTeam === 'ally' && !enemyFull) setBanTeam('enemy');
      }, 320);
    }
  };

  const smartBan = (hero: Hero) => {
    if (banTeam === 'enemy') {
      toast.push('AI bans are blue-side recommendations', { tone: 'info', detail: 'Switch to Blue bans to use the priority list.' });
      return;
    }
    const slot = openSlot('ally');
    if (slot === -1) {
      toast.push('Blue bans are full', { tone: 'info' });
      return;
    }
    placeBan('ally', slot, hero.id);
    toast.push(`${hero.name} prioritised`, { detail: `One-tap blue ban ${slot + 1}. ${hero.patch?.status === 'buff' ? 'Buffed this patch.' : ''}`.trim() });
    if (slot + 1 >= rank.bansPerTeam && !enemyFull) {
      window.setTimeout(() => setBanTeam('enemy'), 250);
    }
  };

  const handleSearchKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocus((value) => Math.min(results.length - 1, value + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocus((value) => Math.max(0, value - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      banFromSearch(results[focus] ?? results[0]);
    }
  };

  const banSlot = (team: Team, index: number, heroId: string | null) => {
    const hero = heroId ? HEROES.find((item) => item.id === heroId) : null;
    return (
      <div key={`${team}-${index}`} className={cn('ban-slot', hero && 'is-filled', team === 'ally' ? 'ban-slot--blue' : 'ban-slot--red')}>
        {hero ? (
          <>
            <HeroPortrait hero={hero} size={56} />
            <button
              type="button"
              className="ban-slot__remove"
              aria-label={`Remove ${hero.name} ban`}
              onClick={() => placeBan(team, index, null)}
            >
              <X size={12} />
            </button>
            <span className="ban-slot__name">{hero.name}</span>
          </>
        ) : (
          <button type="button" className="ban-slot__empty" onClick={() => setPicker({ open: true, team, index })}>
            <Ban size={18} />
            <span>B{index + 1}</span>
            <em>Add</em>
          </button>
        )}
      </div>
    );
  };

  const renderTeamBans = (team: Team) => {
    const filled = team === 'ally' ? allyBans : enemyBans;
    return (
      <div className={cn('ban-team-panel', team === 'ally' ? 'ban-team-panel--blue' : 'ban-team-panel--red')}>
        <div className="ban-team-panel__head">
          <div>
            <span className="eyebrow">{team === 'ally' ? 'Blue side' : 'Red side'}</span>
            <strong>{team === 'ally' ? 'Your bans' : 'Enemy bans'}</strong>
          </div>
          <span>{filled}/{rank.bansPerTeam}</span>
        </div>
        <div className="ban-slots">
          {Array.from({ length: 5 }, (_, index) => {
            const active = index < rank.bansPerTeam;
            if (!active) {
              return (
                <div key={`${team}-locked-${index}`} className="ban-slot ban-slot--locked">
                  <Lock size={12} />
                  <span>Locked</span>
                </div>
              );
            }
            return banSlot(team, index, state.draft.bans[team][index]);
          })}
        </div>
        <button
          type="button"
          className="ban-team-panel__add"
          onClick={() => setPicker({ open: true, team, index: Math.max(0, openSlot(team)) })}
          disabled={filled >= rank.bansPerTeam}
        >
          <Search size={12} /> Search {team === 'ally' ? 'blue' : 'red'} ban
        </button>
      </div>
    );
  };

  return (
    <div className="ban-page">
      <div className="page-head ban-head">
        <div>
          <Eyebrow>Step 3 · Ban phase</Eyebrow>
          <h1>Take their comfort away.</h1>
          <p>
            {rank.label} {rank.range} · {region.short} lens · {partyLabel(partySize)} · {rank.bansPerTeam} bans per team. The list weighs current meta, patch
            direction, flex value, your lane pool, and the rest of the party’s pools.
          </p>
        </div>
        <div className="ban-head__meta">
          <Chip tone="gold"><Timer size={12} /> ~30s in-game</Chip>
          <Chip tone="cyan"><Crosshair size={12} /> {rank.totalBans} total bans</Chip>
          <Chip tone="muted">{region.short} · {PATCH_LABEL}</Chip>
        </div>
      </div>

      <div className="ban-layout">
        <section className={cn('smart-ban-panel', banTeam === 'enemy' && 'is-dimmed')}>
          <div className="panel-head">
            <div>
              <Eyebrow>AI priority list</Eyebrow>
              <h2>Smart bans</h2>
            </div>
            <span className="panel-head__badge"><WandSparkles size={14} /> {rank.label} model</span>
          </div>
          <p className="smart-ban-panel__blurb">
            One tap sends the highest-priority open threat to your next blue ban slot. Heroes from the lane you’re
            playing this match are never suggested.
          </p>

          <div className="smart-ban-list">
            {suggestions.map((suggestion, index) => (
              <article key={suggestion.hero.id} className="smart-ban">
                <span className="smart-ban__rank">{String(index + 1).padStart(2, '0')}</span>
                <HeroPortrait hero={suggestion.hero} size={42} />
                <div className="smart-ban__main">
                  <div className="smart-ban__name">
                    <strong>{suggestion.hero.name}</strong>
                    <span>{metaGrade(suggestion.hero.meta)}</span>
                    {suggestion.hero.patch && <PatchBadge hero={suggestion.hero} compact />}
                  </div>
                  <div className="smart-ban__reasons">
                    {suggestion.reasons.map((reason) => <span key={reason}>{reason}</span>)}
                  </div>
                </div>
                <button
                  type="button"
                  className="smart-ban__action"
                  onClick={() => smartBan(suggestion.hero)}
                  disabled={banTeam === 'enemy' || allyFull}
                  aria-label={`Ban ${suggestion.hero.name}`}
                >
                  <Ban size={13} /> BAN
                </button>
              </article>
            ))}
            {!suggestions.length && <p className="smart-ban__empty">Every priority threat is already banned or in a pool.</p>}
          </div>

          <div className="smart-ban-panel__foot">
            <span><Sparkles size={13} /> Updated live as bans are logged</span>
            {banTeam === 'enemy' && <span className="smart-ban-panel__switch">Switch to Blue to use AI bans</span>}
          </div>
        </section>

        <section className="ban-board">
          <div className="ban-board__top">
            <div className="team-toggle" role="tablist" aria-label="Ban team">
              <button type="button" role="tab" aria-selected={banTeam === 'ally'} className={cn(banTeam === 'ally' && 'is-active')} onClick={() => setBanTeam('ally')}>
                <span className="team-toggle__dot team-toggle__dot--blue" /> Blue bans <em>{allyBans}/{rank.bansPerTeam}</em>
              </button>
              <button type="button" role="tab" aria-selected={banTeam === 'enemy'} className={cn(banTeam === 'enemy' && 'is-active')} onClick={() => setBanTeam('enemy')}>
                <span className="team-toggle__dot team-toggle__dot--red" /> Red bans <em>{enemyBans}/{rank.bansPerTeam}</em>
              </button>
            </div>
            <span className="ban-board__hint"><Kbd>/</Kbd> search · <Kbd>↑↓</Kbd> navigate · <Kbd>↵</Kbd> ban</span>
          </div>

          <div className="ban-search">
            <Search size={18} />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => { setQuery(event.target.value); setFocus(0); }}
              onKeyDown={handleSearchKey}
              placeholder={activeTeamFull ? `All ${banTeam} bans filled — clear a slot to change one` : `Search a hero to ban for ${banTeam === 'ally' ? 'blue' : 'red'}… “Minsi”, “Lance”, “Tig”`}
              aria-label="Search hero to ban"
              disabled={activeTeamFull && !query}
              spellCheck={false}
            />
            <button type="button" className={cn('toggle-pill', banTeam === 'enemy' && 'is-active')} onClick={() => setBanTeam(banTeam === 'ally' ? 'enemy' : 'ally')}>
              {banTeam === 'ally' ? 'Blue' : 'Red'}
            </button>
          </div>

          {query.trim() && (
            <div className="ban-search-results">
              {results.map((hero, index) => (
                <button
                  key={hero.id}
                  type="button"
                  className={cn('ban-result', focus === index && 'is-focused')}
                  onMouseEnter={() => setFocus(index)}
                  onClick={() => banFromSearch(hero)}
                >
                  <HeroPortrait hero={hero} size={38} />
                  <div>
                    <strong>{hero.name}</strong>
                    <span>{hero.lanes.map((lane) => LANE_BY_ID[lane].short).join(' · ')} · {hero.roles.join(' / ')}</span>
                  </div>
                  <span className="ban-result__meta">{metaGrade(hero.meta)}</span>
                  <span className="ban-result__action"><Ban size={12} /> Ban</span>
                </button>
              ))}
              {!results.length && <div className="ban-search-empty">No available hero matches “{query}”.</div>}
            </div>
          )}

          <div className="ban-teams">
            {renderTeamBans('ally')}
            <div className="ban-teams__vs">
              <span>VS</span>
              <em>BAN PHASE</em>
            </div>
            {renderTeamBans('enemy')}
          </div>

          <div className="ban-board__note">
            <ShieldBan size={15} />
            <div>
              <strong>Log both sides for a cleaner read.</strong>
              <span>Enemy bans reveal what they fear; ally bans protect your pool. You can skip this phase at any time.</span>
            </div>
          </div>
        </section>
      </div>

      <div className="phase-footer">
        <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'setup' })}>
          Back to lane
        </Button>
        <div className="phase-footer__center">
          <span className={cn('completion-dot', allyFull && 'is-done')} /> Blue {allyBans}/{rank.bansPerTeam}
          <span className={cn('completion-dot', enemyFull && 'is-done')} /> Red {enemyBans}/{rank.bansPerTeam}
        </div>
        <Button onClick={() => dispatch({ type: 'ENTER_DRAFT' })} icon={<Swords size={16} />} iconRight={<ArrowRight size={15} />}>
          Enter live draft
        </Button>
      </div>

      <HeroPicker
        open={picker.open}
        onClose={() => setPicker((current) => ({ ...current, open: false }))}
        onSelect={(heroId) => {
          placeBan(picker.team, picker.index, heroId);
          setPicker((current) => ({ ...current, open: false }));
          toast.push(`${HEROES.find((hero) => hero.id === heroId)?.name} banned`, { detail: `${picker.team === 'ally' ? 'Blue' : 'Red'} ban ${picker.index + 1}` });
        }}
        title={`${picker.team === 'ally' ? 'Blue' : 'Red'} ban ${picker.index + 1}`}
        subtitle={`${rank.label} · ${rank.bansPerTeam} bans per team. Search by name or nickname.`}
        exclude={used}
      />
    </div>
  );
}
