import { useMemo } from 'react';
import { useFlights } from '../../hooks/useFlights';
import { useFlightStats } from '../../hooks/useFlights';

/**
 * Badge d'achievement
 */
interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: number; // 0-100
  threshold?: number;
}

/**
 * Système de badges d'achievements
 * 
 * Affiche les accomplissements du pilote basés sur :
 * - Nombre de vols
 * - Heures de vol totales
 * - Records personnels
 * - Consistance (streak)
 */
export default function AchievementsBadges() {
  const { data: flights = [], isLoading: flightsLoading } = useFlights({ limit: 500 });
  const { data: stats, isLoading: statsLoading } = useFlightStats();

  const badges = useMemo(() => {
    if (!stats) return [];

    const totalFlights = stats.total_flights || 0;
    const totalHours = stats.total_hours || 0;
    const maxAltitude = stats.max_altitude_m || 0;

    const allBadges: Badge[] = [
      // Badges de vols
      {
        id: 'first_flight',
        title: 'Premier Vol',
        description: 'Réaliser votre premier vol',
        icon: '🪂',
        unlocked: totalFlights >= 1,
      },
      {
        id: 'rookie',
        title: 'Débutant',
        description: '5 vols réalisés',
        icon: '🎓',
        unlocked: totalFlights >= 5,
        progress: Math.min(100, (totalFlights / 5) * 100),
        threshold: 5,
      },
      {
        id: 'experienced',
        title: 'Expérimenté',
        description: '20 vols réalisés',
        icon: '🎖️',
        unlocked: totalFlights >= 20,
        progress: Math.min(100, (totalFlights / 20) * 100),
        threshold: 20,
      },
      {
        id: 'veteran',
        title: 'Vétéran',
        description: '50 vols réalisés',
        icon: '🏅',
        unlocked: totalFlights >= 50,
        progress: Math.min(100, (totalFlights / 50) * 100),
        threshold: 50,
      },
      {
        id: 'master',
        title: 'Maître du Ciel',
        description: '100 vols réalisés',
        icon: '👑',
        unlocked: totalFlights >= 100,
        progress: Math.min(100, (totalFlights / 100) * 100),
        threshold: 100,
      },

      // Badges d'heures de vol
      {
        id: 'ten_hours',
        title: '10 Heures',
        description: '10 heures de vol cumulées',
        icon: '⏱️',
        unlocked: totalHours >= 10,
        progress: Math.min(100, (totalHours / 10) * 100),
        threshold: 10,
      },
      {
        id: 'fifty_hours',
        title: '50 Heures',
        description: '50 heures de vol cumulées',
        icon: '⌛',
        unlocked: totalHours >= 50,
        progress: Math.min(100, (totalHours / 50) * 100),
        threshold: 50,
      },
      {
        id: 'hundred_hours',
        title: 'Centurion',
        description: '100 heures de vol cumulées',
        icon: '🕐',
        unlocked: totalHours >= 100,
        progress: Math.min(100, (totalHours / 100) * 100),
        threshold: 100,
      },

      // Badges d'altitude
      {
        id: 'altitude_1000',
        title: 'Grimpeur',
        description: 'Atteindre 1000m d\'altitude',
        icon: '⛰️',
        unlocked: maxAltitude >= 1000,
        progress: Math.min(100, (maxAltitude / 1000) * 100),
        threshold: 1000,
      },
      {
        id: 'altitude_2000',
        title: 'Alpiniste',
        description: 'Atteindre 2000m d\'altitude',
        icon: '🏔️',
        unlocked: maxAltitude >= 2000,
        progress: Math.min(100, (maxAltitude / 2000) * 100),
        threshold: 2000,
      },
      {
        id: 'altitude_3000',
        title: 'Aigle',
        description: 'Atteindre 3000m d\'altitude',
        icon: '🦅',
        unlocked: maxAltitude >= 3000,
        progress: Math.min(100, (maxAltitude / 3000) * 100),
        threshold: 3000,
      },
    ];

    return allBadges;
  }, [stats, flights]);

  const unlockedBadges = badges.filter((b) => b.unlocked);
  const lockedBadges = badges.filter((b) => !b.unlocked);

  if (flightsLoading || statsLoading) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-md">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-md">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">🏆 Achievements</h3>
        <p className="text-sm text-gray-600 mt-1">
          {unlockedBadges.length} / {badges.length} badges débloqués
        </p>
      </div>

      {/* Unlocked Badges */}
      {unlockedBadges.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Débloqués</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {unlockedBadges.map((badge) => (
              <div
                key={badge.id}
                className="flex flex-col items-center p-3 bg-gradient-to-br from-sky-50 to-blue-50 border-2 border-sky-300 rounded-lg hover:shadow-md transition-shadow"
              >
                <span className="text-3xl mb-1">{badge.icon}</span>
                <span className="text-xs font-semibold text-gray-800 text-center">
                  {badge.title}
                </span>
                <span className="text-xs text-gray-600 text-center mt-1">
                  {badge.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locked Badges with Progress */}
      {lockedBadges.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">À débloquer</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {lockedBadges.map((badge) => (
              <div
                key={badge.id}
                className="flex flex-col items-center p-3 bg-gray-50 border-2 border-gray-200 rounded-lg relative overflow-hidden"
              >
                {/* Progress bar background */}
                {badge.progress !== undefined && (
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-sky-100 to-transparent opacity-50"
                    style={{ height: `${badge.progress}%`, bottom: 0, top: 'auto' }}
                  ></div>
                )}

                <div className="relative z-10 flex flex-col items-center">
                  <span className="text-3xl mb-1 opacity-40 grayscale">
                    {badge.icon}
                  </span>
                  <span className="text-xs font-semibold text-gray-500 text-center">
                    {badge.title}
                  </span>
                  <span className="text-xs text-gray-400 text-center mt-1">
                    {badge.description}
                  </span>
                  {badge.progress !== undefined && badge.progress > 0 && (
                    <span className="text-xs text-sky-600 font-medium mt-1">
                      {Math.round(badge.progress)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
