import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { GameProvider } from './state/GameContext';
import { ThemeProvider } from './state/ThemeContext';
import { VoiceProvider } from './state/VoiceContext';
import { ToastProvider } from './components/Toast';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <GameProvider>
          <VoiceProvider>
            <App />
          </VoiceProvider>
        </GameProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);
