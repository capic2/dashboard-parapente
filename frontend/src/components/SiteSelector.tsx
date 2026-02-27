
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
        {sites.map((site) => (
          <button
            key={site.id}
            className={`site-tab ${selectedSiteId === site.id ? 'active' : ''}`}
            onClick={() => onSelectSite(site.id)}
          >
            <span className="site-tab-name">{site.name}</span>
            <span className="site-tab-alt">{site.altitude}m</span>
          </button>
        ))}
      </div>
    </div>
  );
}
