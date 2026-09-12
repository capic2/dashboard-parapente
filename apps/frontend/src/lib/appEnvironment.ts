const isStaging = import.meta.env.BASE_URL.startsWith('/staging');

export const appTitle = isStaging
  ? '[staging] Dashboard Parapente'
  : 'Dashboard Parapente';
