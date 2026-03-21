import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Configuration du serveur MSW pour les tests
export const server = setupServer(...handlers);
