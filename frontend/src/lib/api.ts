import ky from 'ky';

// Instance Ky configurée pour l'API backend
export const api = ky.create({
  prefixUrl: '/api', // Toutes les requêtes préfixées par /api
  timeout: 30000,    // 30 secondes
  retry: {
    limit: 2,        // Retry 2 fois en cas d'échec
    methods: ['get'], // Retry seulement GET
    statusCodes: [408, 413, 429, 500, 502, 503, 504]
  },
  hooks: {
    beforeRequest: [
      request => {
        // Log requêtes en dev
        if (import.meta.env.DEV) {
          console.log(`[API] ${request.method} ${request.url}`);
        }
      }
    ],
    afterResponse: [
      async (request, _options, response) => {
        // Log des erreurs (en dev seulement pour éviter de polluer la console en prod)
        if (!response.ok && import.meta.env.DEV) {
          console.error(`[API Error] ${request.method} ${request.url}:`, response.status);
        }
        return response;
      }
    ]
  }
});

// Helper pour GET avec parsing JSON automatique
export const getJSON = async <T = unknown>(endpoint: string): Promise<T> => {
  return api.get(endpoint).json<T>();
};

// Helper pour POST
export const postJSON = async <T = unknown>(
  endpoint: string, 
  data: Record<string, unknown>
): Promise<T> => {
  return api.post(endpoint, { json: data }).json<T>();
};

// Helper pour PUT
export const putJSON = async <T = unknown>(
  endpoint: string, 
  data: Record<string, unknown>
): Promise<T> => {
  return api.put(endpoint, { json: data }).json<T>();
};

// Helper pour DELETE
export const deleteJSON = async <T = unknown>(endpoint: string): Promise<T> => {
  return api.delete(endpoint).json<T>();
};
