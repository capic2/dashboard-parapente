
import { useSites } from '../hooks/useSites';
import './SiteSelector.css';

interface SiteSelectorProps {
  selectedSiteId: string;
  onSelectSite: (siteId: string) => void;
}

export default function SiteSelector({ selectedSiteId, onSelectSite }: SiteSelectorProps) {
  const { data: sites, isLoading, error } = useSites();

  if (isLoading) {
    return (
      <div className="site-selector">
        <div className="site-tabs">
          <div className="site-tab loading">Chargement...</div>
        </div>
      </div>
    );
  }

  if (error || !sites) {
    return (
      <div className="site-selector">
        <div className="site-tabs">
          <div className="site-tab error">Erreur de chargement</div>
        </div>
      </div>
    );
  }

  return (
    <div className="site-selector">
      <div className="site-tabs">
        {sites.map((site: any) => {
          // Use 'code' field for API calls (e.g., 'mont-poupet'), not 'id' (e.g., 'site-mont-poupet')
          const siteCode = site.code || site.id
          return (
            <button
              key={site.id}
              className={`site-tab ${selectedSiteId === siteCode ? 'active' : ''}`}
              onClick={() => onSelectSite(siteCode)}
            >
              <span className="site-tab-name">{site.name}</span>
              <span className="site-tab-alt">{site.altitude || site.elevation_m || '?'}m</span>
            </button>
          )
        })}
      </div>
    </div>
  );
}
