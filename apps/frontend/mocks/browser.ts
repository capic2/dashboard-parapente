import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

// Configuration du service worker MSW pour le navigateur
export const worker = setupWorker(...handlers);
