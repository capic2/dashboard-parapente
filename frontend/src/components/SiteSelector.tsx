import { useSites } from '../hooks/useSites';

interface SiteSelectorProps {
  selectedSiteId: string;
  onSelectSite: (siteId: string) => void;
}

export default function SiteSelector({ selectedSiteId, onSelectSite }: SiteSelectorProps) {
  const { data: sites, isLoading, error } = useSites();

  if (isLoading) {
    return (
      <div className="mb-4">
        <div className="flex gap-2 flex-wrap bg-white rounded-xl p-3 shadow-md">
          <div className="flex-1 min-w-[120px] p-3 border-2 border-gray-300 rounded-lg bg-white cursor-not-allowed text-gray-400">
            Chargement...
          </div>
        </div>
      </div>
    );
  }

  if (error || !sites) {
    return (
      <div className="mb-4">
        <div className="flex gap-2 flex-wrap bg-white rounded-xl p-3 shadow-md">
          <div className="flex-1 min-w-[120px] p-3 border-2 border-gray-300 rounded-lg bg-white cursor-not-allowed text-gray-400">
            Erreur de chargement
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex gap-2 flex-wrap bg-white rounded-xl p-3 shadow-md">
        {sites.map((site: any) => {
          // Use 'code' field for API calls (e.g., 'mont-poupet'), not 'id' (e.g., 'site-mont-poupet')
          const siteCode = site.code || site.id;
          const isActive = selectedSiteId === siteCode;
          
          return (
            <button
              key={site.id}
              className={`
                flex-1 min-w-[120px] sm:min-w-[100px] 
                p-3 sm:p-2.5 
                border-2 rounded-lg 
                transition-all 
                flex flex-col items-center gap-1
                ${isActive 
                  ? 'border-purple-600 bg-gradient-to-br from-purple-600 to-purple-800 text-white' 
                  : 'border-gray-200 bg-white hover:border-purple-600 hover:-translate-y-0.5 hover:shadow-md hover:shadow-purple-100'
                }
              `}
              onClick={() => onSelectSite(siteCode)}
            >
              <span className={`text-sm sm:text-xs font-semibold ${isActive ? '' : 'text-gray-900'}`}>
                {site.name}
              </span>
              <span className={`text-xs sm:text-[11px] ${isActive ? 'opacity-90' : 'opacity-80 text-gray-600'}`}>
                {site.altitude || site.elevation_m || '?'}m
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
