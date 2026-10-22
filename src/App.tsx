import { useEffect } from 'react';
import { useGame } from './state/GameContext';
import { useTheme } from './state/ThemeContext';
import { TopBar } from './components/TopBar';
import { RankCrest } from './components/RankCrest';
import { RANK_BY_ID } from './data/meta';
import { HomeScreen } from './screens/HomeScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { SetupScreen } from './screens/SetupScreen';
import { BanScreen } from './screens/BanScreen';
import { DraftScreen } from './screens/DraftScreen';
import { StrategyScreen } from './screens/StrategyScreen';
import type { Screen } from './types';

export default function App() {
  const { state, dispatch } = useGame();
  const { theme } = useTheme();
  const { screen, profile, draft, rankPreview } = state;
  const rank = rankPreview ?? profile?.rank ?? 'legend';
  const rankMeta = RANK_BY_ID[rank];

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.rank = rank;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', theme === 'light' ? rankMeta.themeColorLight : rankMeta.themeColor);
    }
    return () => {
      delete root.dataset.rank;
    };
  }, [rank, rankMeta.themeColor, rankMeta.themeColorLight, theme]);

  useEffect(() => {
    if (!profile && screen !== 'home' && screen !== 'onboarding') {
      dispatch({ type: 'SET_SCREEN', screen: 'home' });
    }
  }, [profile, screen, dispatch]);

  useEffect(() => {
    if (profile && screen === 'ban' && !draft.lane) {
      dispatch({ type: 'SET_SCREEN', screen: 'setup' });
    }
    if (profile && screen === 'draft' && !draft.lane) {
      dispatch({ type: 'SET_SCREEN', screen: 'setup' });
    }
  }, [profile, screen, draft.lane, dispatch]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.classList.contains('skip-link')) active.blur();
  }, [screen]);

  const effective: Screen =
    !profile && screen !== 'home' && screen !== 'onboarding'
      ? 'home'
      : profile && (screen === 'ban' || screen === 'draft') && !draft.lane
        ? 'setup'
        : screen;

  const renderScreen = () => {
    switch (effective) {
      case 'onboarding':
        return <OnboardingScreen />;
      case 'setup':
        return profile ? <SetupScreen /> : <HomeScreen />;
      case 'ban':
        return profile ? <BanScreen /> : <HomeScreen />;
      case 'draft':
        return profile ? <DraftScreen /> : <HomeScreen />;
      case 'strategy':
        return profile ? <StrategyScreen /> : <HomeScreen />;
      default:
        return <HomeScreen />;
    }
  };

  return (
    <div className="app-shell" data-rank={rank}>
      <a href="#main" className="skip-link">Skip to content</a>
      <div className="app-bg" aria-hidden="true">
        <span className="app-bg__grid" />
        <span className="app-bg__glow app-bg__glow--one" />
        <span className="app-bg__glow app-bg__glow--two" />
        <span className="app-bg__glow app-bg__glow--three" />
        <span className="app-bg__rank">{rankMeta.label}</span>
        <RankCrest rank={rank} className="app-bg__crest" />
        <span className="app-bg__noise" />
      </div>
      <TopBar />
      <main id="main" className="app-main" key={effective}>
        {renderScreen()}
      </main>
    </div>
  );
}
