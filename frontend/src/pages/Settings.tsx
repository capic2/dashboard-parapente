export default function Settings() {
  return (
    <div className="py-4">
      <div className="bg-white rounded-xl p-6 shadow-md max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">⚙️ Paramètres</h1>
        <p className="text-gray-600 mb-4">Cette page sera implémentée en Phase 4 - Semaine 2</p>
        <p className="font-semibold text-gray-700 mb-2">Fonctionnalités prévues:</p>
        <ul className="list-disc list-inside space-y-1 text-gray-600">
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
