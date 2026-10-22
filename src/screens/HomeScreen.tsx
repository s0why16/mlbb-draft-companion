import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CircleDot,
  Crosshair,
  Gauge,
  Layers,
  RotateCcw,
  ScanSearch,
  ShieldBan,
  Sparkles,
  Swords,
  Target,
  Timer,
  WandSparkles,
} from 'lucide-react';
import { HEROES, HERO_BY_ID, PATCH_META } from '../data/heroes';
import { FEATURED_IDS, LANES, PATCH_LABEL, RANK_BY_ID } from '../data/meta';
import { useGame } from '../state/GameContext';
import { comfortForHero, metaGrade } from '../lib/engine';
import { CORE_POOL_SIZE, MAX_POOL_SIZE } from '../lib/pool';
import { Button, Chip, Eyebrow } from '../components/Primitives';
import { HeroPortrait } from '../components/HeroPortrait';
import { LaneIcon } from '../components/LaneIcon';
import { CloudBackupPanel } from '../components/CloudBackupPanel';
import { PatchBadge } from '../components/PatchBadge';

const FEATURES = [
  {
    Icon: BrainCircuit,
    title: 'Mastery-weighted comfort',
    body: 'Win rate is shrunk toward the mean by sample size, so a 2-game 100% does not beat a 300-game 62%.',
    tag: 'Personal model',
  },
  {
    Icon: ShieldBan,
    title: 'Rank-aware smart bans',
    body: 'Epic punishes low skill floors; Mythical Glory punishes flex value. Bans adapt to 3, 4, or 5 per team.',
    tag: 'Ban solver',
  },
  {
    Icon: Gauge,
    title: 'Partial-board projections',
    body: 'One enemy pick is enough. Confidence rises with every lock instead of forcing ten slots before a read.',
    tag: 'Live model',
  },
  {
    Icon: Timer,
    title: 'Five-second pick window',
    body: 'Tap “It’s my turn” at any stage for a two-option verdict, with reasons, risks, and one-click transfer.',
    tag: 'Turn solver',
  },
  {
    Icon: Swords,
    title: 'Opponent-tailored plan',
    body: 'Early, mid, and late-game objectives generated from the enemy’s tags, not a generic checklist.',
    tag: 'Execution',
  },
  {
    Icon: RotateCcw,
    title: 'Replay without reset',
    body: 'Clearing the board preserves your rank and three-core lane pools. The next draft starts in one tap.',
    tag: 'Loop',
  },
];

const STEPS = [
  { n: '01', title: 'Permanent profile', body: 'Pick your rank, then three core heroes for each lane, expandable to eight with optional win rate and match data.', Icon: Layers },
  { n: '02', title: 'Match lane', body: 'Choose the lane you were assigned. The engine isolates that pool and ignores every other lane.', Icon: Crosshair },
  { n: '03', title: 'Ban phase', body: 'One-tap smart bans or type a nickname. Rank decides whether you see 3, 4, or 5 bans per team.', Icon: ShieldBan },
  { n: '04', title: 'Live board', body: 'Log ally and enemy picks as they happen. Projected win rate updates after every lock.', Icon: BarChart3 },
  { n: '05', title: 'It’s my turn', body: 'A five-second evaluation returns your two best options, even from a partial board.', Icon: Timer },
  { n: '06', title: 'Game plan', body: 'Get one-sentence early, mid, and late objectives plus spell and item adjustments.', Icon: Target },
  { n: '07', title: 'Play again', body: 'Clear the draft, keep the profile, and loop straight back into the next ranked lobby.', Icon: RotateCcw },
];

export function HomeScreen() {
  const { state, dispatch } = useGame();
  const profile = state.profile;
  const featured = FEATURED_IDS.map((id) => HERO_BY_ID.get(id)).filter(Boolean);
  const bluePreview = ['hirara', 'lukas', 'belerick'].map((id) => HERO_BY_ID.get(id)).filter(Boolean);
  const redPreview = ['obsidia', 'marcel', 'zetian'].map((id) => HERO_BY_ID.get(id)).filter(Boolean);
  const changed = ['hirara', 'lukas', 'kalea', 'marcel']
    .map((id) => HERO_BY_ID.get(id))
    .filter((hero): hero is NonNullable<typeof hero> => Boolean(hero && hero.patch));
  const totalPool = profile ? Object.values(profile.pools).reduce((sum, pool) => sum + pool.length, 0) : 0;
  const corePool = profile ? Object.values(profile.pools).reduce((sum, pool) => sum + Math.min(CORE_POOL_SIZE, pool.length), 0) : 0;
  const optionalPool = totalPool - corePool;

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero__copy">
          <Eyebrow>
            <span className="live-dot" /> Season 42 · {PATCH_LABEL} · Ranked draft lab
          </Eyebrow>
          <h1>
            Draft like you <em>already know</em> the enemy.
          </h1>
          <p>
            Your hero pool, the live patch, and the enemy’s tags — read in one board. Built for the 30 seconds between
            “your turn” and lock-in.
          </p>
          <div className="home-hero__actions">
            {profile ? (
              <Button size="lg" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'setup' })} icon={<Swords size={18} />} iconRight={<ArrowRight size={16} />}>
                Start ranked draft
              </Button>
            ) : (
              <Button size="lg" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'onboarding' })} icon={<Crosshair size={18} />} iconRight={<ArrowRight size={16} />}>
                Build my hero pool
              </Button>
            )}
            <Button size="lg" variant="ghost" icon={<ScanSearch size={17} />} onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>
              See the 7-step flow
            </Button>
          </div>
          <div className="home-hero__stats">
            <div>
              <strong>{HEROES.length}</strong>
              <span>heroes modelled</span>
            </div>
            <div>
              <strong>{PATCH_META.changed}</strong>
              <span>patch changes</span>
            </div>
            <div>
              <strong>5</strong>
              <span>lane pools</span>
            </div>
            <div>
              <strong>0</strong>
              <span>network calls per solve</span>
            </div>
          </div>
        </div>

        <div className="home-hero__visual" aria-label="Draft board preview">
          <div className="orb orb--cyan" />
          <div className="orb orb--red" />
          <div className="preview-shell">
            <div className="preview-top">
              <span className="preview-top__live"><span className="live-dot" /> LIVE DRAFT</span>
              <Chip tone="gold">MYTHICAL GLORY · 5 BANS</Chip>
              <span className="preview-top__timer">00:24</span>
            </div>
            <div className="preview-bans">
              <span>BANS</span>
              {['fanny', 'kalea', 'zhuxin', 'sora'].map((id) => {
                const hero = HERO_BY_ID.get(id);
                return hero ? (
                  <span key={id} className="preview-ban">
                    <HeroPortrait hero={hero} size={30} />
                    <i>×</i>
                  </span>
                ) : null;
              })}
              <em>+6</em>
            </div>
            <div className="preview-board">
              <div className="preview-team preview-team--blue">
                <div className="preview-team__label">BLUE · YOU</div>
                {bluePreview.map((hero, index) =>
                  hero ? (
                    <div key={hero.id} className="preview-pick">
                      <span className="preview-pick__slot">S{index + 1}</span>
                      <HeroPortrait hero={hero} size={38} />
                      <div>
                        <strong>{hero.name}</strong>
                        <span>{hero.lanes[0]?.toUpperCase()} · {metaGrade(hero.meta)}</span>
                      </div>
                    </div>
                  ) : null,
                )}
                <div className="preview-pick preview-pick--empty">
                  <span className="preview-pick__slot">S4</span>
                  <span className="preview-empty-dot">+</span>
                  <div>
                    <strong>Your turn</strong>
                    <span>AI reading live</span>
                  </div>
                </div>
              </div>

              <div className="preview-mid">
                <span className="eyebrow">Projected</span>
                <strong>56.4<span>%</span></strong>
                <span className="preview-mid__delta">+4.7 blue edge</span>
                <div className="preview-mid__bar">
                  <span />
                </div>
                <div className="preview-verdict">
                  <WandSparkles size={14} />
                  <div>
                    <span>AI verdict</span>
                    <strong>Lock Hirara</strong>
                  </div>
                </div>
              </div>

              <div className="preview-team preview-team--red">
                <div className="preview-team__label">RED · ENEMY</div>
                {redPreview.map((hero, index) =>
                  hero ? (
                    <div key={hero.id} className="preview-pick">
                      <span className="preview-pick__slot">S{index + 1}</span>
                      <HeroPortrait hero={hero} size={38} />
                      <div>
                        <strong>{hero.name}</strong>
                        <span>{hero.lanes[0]?.toUpperCase()} · {metaGrade(hero.meta)}</span>
                      </div>
                    </div>
                  ) : null,
                )}
                <div className="preview-pick preview-pick--empty">
                  <span className="preview-pick__slot">S4</span>
                  <span className="preview-empty-dot">?</span>
                  <div>
                    <strong>Waiting</strong>
                    <span>Add enemy pick</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="preview-foot">
              <span><CircleDot size={12} /> Comfort · Patch · Counters · Composition</span>
              <strong>2 options ready</strong>
            </div>
          </div>

          <div className="float-card float-card--one">
            <span className="float-card__avatar"><HeroPortrait hero={featured[0]!} size={34} /></span>
            <div>
              <span>Patch verdict</span>
              <strong>Hirara · NERFED</strong>
            </div>
            <span className="float-card__tone float-card__tone--red">↓</span>
          </div>
          <div className="float-card float-card--two">
            <span className="float-card__icon"><BrainCircuit size={16} /></span>
            <div>
              <span>Comfort index</span>
              <strong>62.4% · 184 games</strong>
            </div>
          </div>
        </div>
      </section>

      {profile && (
        <section className="profile-strip">
          <div className="profile-strip__rank">
            <span className="eyebrow">Active profile</span>
            <strong style={{ color: RANK_BY_ID[profile.rank].accent }}>{RANK_BY_ID[profile.rank].label}</strong>
            <span>{RANK_BY_ID[profile.rank].bansPerTeam} bans per team · {corePool}/{CORE_POOL_SIZE * LANES.length} core{optionalPool ? ` · +${optionalPool} optional` : ''}</span>
          </div>
          <div className="profile-strip__lanes">
            {LANES.map((lane) => {
              const pool = profile.pools[lane.id];
              const best = pool[0] ? comfortForHero(pool[0]) : null;
              return (
                <div key={lane.id} className="profile-lane">
                  <span className="profile-lane__icon" style={{ color: lane.color }}><LaneIcon lane={lane.id} size={15} /></span>
                  <div>
                    <strong>{lane.short}</strong>
                    <span>{pool.length}/{MAX_POOL_SIZE} · {best ? `${Math.round(best.score)} comfort` : 'no stats'}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="profile-strip__actions">
            <Button size="sm" variant="secondary" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'onboarding' })}>
              Edit pool
            </Button>
            <Button size="sm" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'setup' })} iconRight={<ArrowRight size={14} />}>
              Quick draft
            </Button>
          </div>
        </section>
      )}

      <section className="home-section">
        <div className="section-heading">
          <div>
            <Eyebrow>The edge is in the details</Eyebrow>
            <h2>Not another tier list.</h2>
          </div>
          <p>
            Every recommendation is a transparent combination of comfort, patch direction, counters, synergies, and the
            five picks on the board.
          </p>
        </div>
        <div className="feature-grid">
          {FEATURES.map(({ Icon, title, body, tag }) => (
            <article key={title} className="feature-card">
              <span className="feature-card__icon"><Icon size={20} /></span>
              <span className="feature-card__tag">{tag}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section" id="how-it-works">
        <div className="section-heading">
          <div>
            <Eyebrow>Seven steps, zero dead time</Eyebrow>
            <h2>From lobby to game plan.</h2>
          </div>
          <p>The entire flow was built around MLBB’s ban and pick timers. Nothing here requires a full board.</p>
        </div>
        <div className="steps-grid">
          {STEPS.map(({ n, title, body, Icon }, index) => (
            <article key={n} className={`step-card ${index === 4 ? 'step-card--accent' : ''}`}>
              <div className="step-card__top">
                <span className="step-card__n">{n}</span>
                <Icon size={17} />
              </div>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section patch-section" id="patch">
        <div className="section-heading">
          <div>
            <Eyebrow>Balance snapshot · {PATCH_META.released}</Eyebrow>
            <h2>Patch 2.2.16a live.</h2>
          </div>
          <div className="patch-section__meta">
            <Chip tone="cyan">{PATCH_META.changed} hero changes</Chip>
            <Chip tone="muted">Updated {PATCH_META.updated}</Chip>
          </div>
        </div>
        <div className="patch-grid">
          {changed.map((hero) => (
            <article key={hero.id} className={`patch-card patch-card--${hero.patch?.status}`}>
              <div className="patch-card__hero">
                <HeroPortrait hero={hero} size={58} />
                <div>
                  <strong>{hero.name}</strong>
                  <span>{metaGrade(hero.meta)} tier · {hero.roles.join(' / ')}</span>
                </div>
                <PatchBadge hero={hero} />
              </div>
              <p>{hero.patch?.note}</p>
              <div className="patch-card__foot">
                <span>Patch {hero.patch?.patch}</span>
                <span>{hero.winRate != null ? `${hero.winRate.toFixed(1)}% ranked WR` : 'No WR data'}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {profile && (
        <section className="home-section home-section--cloud">
          <CloudBackupPanel
            profile={profile}
            compact
            onRestored={(restored) => {
              dispatch({ type: 'SAVE_PROFILE', profile: restored });
              dispatch({ type: 'SET_SCREEN', screen: 'setup' });
            }}
          />
        </section>
      )}

      <section className="home-cta">
        <div className="home-cta__inner">
          <Eyebrow>No sign-up · local-first · Supabase backup</Eyebrow>
          <h2>{profile ? 'Your next lobby is one tap away.' : 'Build the pool once. Draft faster forever.'}</h2>
          <p>
            {profile
              ? 'Your permanent profile is ready. Pick a lane and let the companion handle the clock.'
              : 'Set your rank and three core heroes per lane, expandable to eight. The profile stays on your device and loops into every match.'}
          </p>
          <Button
            size="lg"
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: profile ? 'setup' : 'onboarding' })}
            icon={profile ? <Swords size={18} /> : <Sparkles size={18} />}
            iconRight={<ArrowRight size={16} />}
          >
            {profile ? 'Enter match setup' : 'Start onboarding'}
          </Button>
        </div>
      </section>

      <footer className="home-footer">
        <div>
          <span className="home-footer__brand">DRAFT COMPANION</span>
          <p>Unofficial fan project. Hero portraits and game data belong to Moonton / Mobile Legends: Bang Bang.</p>
        </div>
        <div className="home-footer__meta">
          <span>Patch {PATCH_LABEL} · {PATCH_META.updated}</span>
          <span>Meta snapshot: ranked play, Oct 2026</span>
        </div>
      </footer>
    </div>
  );
}
