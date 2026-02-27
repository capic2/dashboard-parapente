
import './Settings.css';

export default function Settings() {
  return (
    <div className="settings">
      <div className="card">
        <h1>⚙️ Paramètres</h1>
        <p className="placeholder">Cette page sera implémentée en Phase 4 - Semaine 2</p>
        <p className="features-list">
          Fonctionnalités prévues:
        </p>
        <ul>
          <li>Gestion des sites favoris</li>
          <li>Configuration des alertes météo</li>
          <li>Préférences d'affichage (unités, langue)</li>
          <li>Synchronisation des données GPX</li>
          <li>Export/Import de la configuration</li>
        </ul>
      </div>
    </div>
  );
}
