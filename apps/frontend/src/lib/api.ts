import ky from 'ky';

// Instance Ky configurée pour l'API backend
export const api = ky.create({
  prefixUrl: '/api', // Toutes les requêtes préfixées par /api
  timeout: 30000, // 30 secondes
  retry: {
    limit: 2, // Retry 2 fois en cas d'échec
    methods: ['get'], // Retry seulement GET
    statusCodes: [408, 413, 429, 500, 502, 503, 504],
  },
  hooks: {
    beforeRequest: [
      (request) => {
        // Log requêtes en dev
        if (import.meta.env.DEV) {
          console.log(`[API] ${request.method} ${request.url}`);
        }
      },
    ],
    afterResponse: [
      async (request, _options, response) => {
        // Log des erreurs (en dev seulement pour éviter de polluer la console en prod)
        if (!response.ok && import.meta.env.DEV) {
          console.error(
            `[API Error] ${request.method} ${request.url}:`,
            response.status
          );
        }
        return response;
      },
    ],
  },
});
