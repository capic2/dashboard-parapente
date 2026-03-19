import { useEffect, useState } from 'react';

/**
 * Composant de test pour vérifier que MSW fonctionne
 *
 * Usage:
 * 1. Importer ce composant dans App.tsx
 * 2. L'ajouter temporairement dans le render
 * 3. Lancer npm run dev
 * 4. Vérifier dans la console du navigateur
 * 5. Supprimer le composant une fois les tests OK
 */
export function TestMSW() {
  const [testResults, setTestResults] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function runTests() {
      const results: any = {};

      try {
        // Test 1: GET /api/spots
        console.log('🧪 Test 1: GET /api/spots');
        const spotsRes = await fetch('/api/spots');
        results.spots = await spotsRes.json();
        console.log('✅ Sites:', results.spots.sites.length, 'sites récupérés');

        // Test 2: GET /api/flights
        console.log('🧪 Test 2: GET /api/flights');
        const flightsRes = await fetch('/api/flights?limit=6');
        results.flights = await flightsRes.json();
        console.log(
          '✅ Vols:',
          results.flights.flights.length,
          'vols récupérés'
        );

        // Test 3: GET /api/flights/stats
        console.log('🧪 Test 3: GET /api/flights/stats');
        const statsRes = await fetch('/api/flights/stats');
        results.stats = await statsRes.json();
        console.log('✅ Stats:', results.stats);

        // Test 4: GET /api/weather/:spot_id
        console.log('🧪 Test 4: GET /api/weather/site-arguel');
        const weatherRes = await fetch('/api/weather/site-arguel');
        results.weather = await weatherRes.json();
        console.log('✅ Météo Arguel:', results.weather);

        // Test 5: GET /api/flights/:id/gpx-data
        const firstFlightId = results.flights.flights[0]?.id;
        if (firstFlightId) {
          console.log(
            '🧪 Test 5: GET /api/flights/' + firstFlightId + '/gpx-data'
          );
          const gpxRes = await fetch(`/api/flights/${firstFlightId}/gpx-data`);
          results.gpx = await gpxRes.json();
          console.log('✅ GPX data:', results.gpx.stats);
        }

        console.log('\n🎉 Tous les tests MSW ont réussi!\n');
        console.log('Résumé:', {
          sites: results.spots.sites.length,
          flights: results.flights.flights.length,
          totalFlights: results.stats.total_flights,
          weather: results.weather.verdict,
          gpxPoints: results.gpx?.coordinates?.length,
        });

        setTestResults(results);
      } catch (error) {
        console.error('❌ Erreur pendant les tests MSW:', error);
        results.error = error;
        setTestResults(results);
      } finally {
        setLoading(false);
      }
    }

    runTests();
  }, []);

  if (loading) {
    return (
      <div
        style={{ padding: '20px', border: '2px solid blue', margin: '20px' }}
      >
        <h2>🧪 Tests MSW en cours...</h2>
        <p>Ouvrez la console pour voir les résultats</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', border: '2px solid green', margin: '20px' }}>
      <h2>✅ Tests MSW terminés</h2>
      <p>Vérifiez la console pour les détails</p>

      {testResults.error && (
        <div style={{ color: 'red' }}>
          <strong>Erreur:</strong> {String(testResults.error)}
        </div>
      )}

      <details>
        <summary>Voir les résultats bruts</summary>
        <pre
          style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}
        >
          {JSON.stringify(testResults, null, 2)}
        </pre>
      </details>

      <button
        onClick={() => window.location.reload()}
        style={{ marginTop: '10px', padding: '10px 20px' }}
      >
        🔄 Relancer les tests
      </button>
    </div>
  );
}

export default TestMSW;
