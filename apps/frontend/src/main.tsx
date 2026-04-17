import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import App from './App';
import './App.css';
import { initTheme } from './stores/themeStore';

// Initialiser MSW en mode développement (peut être désactivé via VITE_ENABLE_MSW=false)
async function enableMocking() {
  const enableMSW = import.meta.env.VITE_ENABLE_MSW !== 'false';

  if (import.meta.env.DEV && enableMSW) {
    const { worker } = await import('../mocks/browser');

    // `worker.start()` retourne une Promise qui se résout
    // une fois que le Service Worker est prêt à intercepter les requêtes
    return worker.start({
      onUnhandledRequest: 'bypass', // Ignore les requêtes non mockées
    });
  }
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find the root element');
}

// Initialiser le thème avant le rendu pour éviter le FOUC
initTheme();

// Attendre que MSW soit prêt avant de rendre l'app
enableMocking().then(() => {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
