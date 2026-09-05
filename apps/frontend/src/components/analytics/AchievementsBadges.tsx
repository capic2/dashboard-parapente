import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Award,
  Bird,
  Clock3,
  Crown,
  GraduationCap,
  Hourglass,
  MapPinned,
  Medal,
  Mountain,
  MountainSnow,
  Plane,
  Route,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { IconCard } from '@dashboard-parapente/design-system';
import type { FlightStats } from '../../types';

interface AchievementBadge {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  unlocked: boolean;
  progress?: number; // 0-100
  threshold?: number;
}

interface AchievementsBadgesProps {
  stats: FlightStats;
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
export default function AchievementsBadges({ stats }: AchievementsBadgesProps) {
  const { t } = useTranslation();

  const badges = useMemo(() => {
    const totalFlights = stats.total_flights ?? 0;
    const totalHours = stats.total_hours ?? 0;
    const maxAltitude = stats.max_altitude_m ?? 0;
    const totalDistance = stats.total_distance_km ?? 0;
    const totalElevationGain = stats.total_elevation_gain_m ?? 0;
    const averageDuration = stats.avg_duration_minutes ?? 0;

    const allBadges: AchievementBadge[] = [
      // Badges de vols
      {
        id: 'first_flight',
        title: t('achievements.firstFlight'),
        description: t('achievements.firstFlightDesc'),
        icon: <Plane />,
        unlocked: totalFlights >= 1,
      },
      {
        id: 'rookie',
        title: t('achievements.beginner'),
        description: t('achievements.beginnerDesc'),
        icon: <GraduationCap />,
        unlocked: totalFlights >= 5,
        progress: Math.min(100, (totalFlights / 5) * 100),
        threshold: 5,
      },
      {
        id: 'experienced',
        title: t('achievements.experienced'),
        description: t('achievements.experiencedDesc'),
        icon: <Medal />,
        unlocked: totalFlights >= 20,
        progress: Math.min(100, (totalFlights / 20) * 100),
        threshold: 20,
      },
      {
        id: 'veteran',
        title: t('achievements.veteran'),
        description: t('achievements.veteranDesc'),
        icon: <Award />,
        unlocked: totalFlights >= 50,
        progress: Math.min(100, (totalFlights / 50) * 100),
        threshold: 50,
      },
      {
        id: 'master',
        title: t('achievements.skyMaster'),
        description: t('achievements.skyMasterDesc'),
        icon: <Crown />,
        unlocked: totalFlights >= 100,
        progress: Math.min(100, (totalFlights / 100) * 100),
        threshold: 100,
      },

      // Badges d'heures de vol
      {
        id: 'ten_hours',
        title: t('achievements.tenHours'),
        description: t('achievements.tenHoursDesc'),
        icon: <Timer />,
        unlocked: totalHours >= 10,
        progress: Math.min(100, (totalHours / 10) * 100),
        threshold: 10,
      },
      {
        id: 'fifty_hours',
        title: t('achievements.fiftyHours'),
        description: t('achievements.fiftyHoursDesc'),
        icon: <Hourglass />,
        unlocked: totalHours >= 50,
        progress: Math.min(100, (totalHours / 50) * 100),
        threshold: 50,
      },
      {
        id: 'hundred_hours',
        title: t('achievements.centurion'),
        description: t('achievements.centurionDesc'),
        icon: <Clock3 />,
        unlocked: totalHours >= 100,
        progress: Math.min(100, (totalHours / 100) * 100),
        threshold: 100,
      },

      // Badges d'altitude
      {
        id: 'altitude_1000',
        title: t('achievements.climber'),
        description: t('achievements.climberDesc'),
        icon: <Mountain />,
        unlocked: maxAltitude >= 1000,
        progress: Math.min(100, (maxAltitude / 1000) * 100),
        threshold: 1000,
      },
      {
        id: 'altitude_2000',
        title: t('achievements.mountaineer'),
        description: t('achievements.mountaineerDesc'),
        icon: <MountainSnow />,
        unlocked: maxAltitude >= 2000,
        progress: Math.min(100, (maxAltitude / 2000) * 100),
        threshold: 2000,
      },
      {
        id: 'altitude_3000',
        title: t('achievements.eagle'),
        description: t('achievements.eagleDesc'),
        icon: <Bird />,
        unlocked: maxAltitude >= 3000,
        progress: Math.min(100, (maxAltitude / 3000) * 100),
        threshold: 3000,
      },

      // Badges de distance
      {
        id: 'distance_100',
        title: t('achievements.explorer'),
        description: t('achievements.explorerDesc'),
        icon: <Route />,
        unlocked: totalDistance >= 100,
        progress: Math.min(100, (totalDistance / 100) * 100),
        threshold: 100,
      },
      {
        id: 'distance_500',
        title: t('achievements.traveler'),
        description: t('achievements.travelerDesc'),
        icon: <MapPinned />,
        unlocked: totalDistance >= 500,
        progress: Math.min(100, (totalDistance / 500) * 100),
        threshold: 500,
      },

      // Badges de dénivelé positif
      {
        id: 'elevation_10000',
        title: t('achievements.elevationSeeker'),
        description: t('achievements.elevationSeekerDesc'),
        icon: <TrendingUp />,
        unlocked: totalElevationGain >= 10000,
        progress: Math.min(100, (totalElevationGain / 10000) * 100),
        threshold: 10000,
      },
      {
        id: 'elevation_50000',
        title: t('achievements.elevationMaster'),
        description: t('achievements.elevationMasterDesc'),
        icon: <Mountain />,
        unlocked: totalElevationGain >= 50000,
        progress: Math.min(100, (totalElevationGain / 50000) * 100),
        threshold: 50000,
      },

      // Badges d'endurance
      {
        id: 'average_duration_60',
        title: t('achievements.endurance'),
        description: t('achievements.enduranceDesc'),
        icon: <Timer />,
        unlocked: averageDuration >= 60,
        progress: Math.min(100, (averageDuration / 60) * 100),
        threshold: 60,
      },
    ] as const;

    return allBadges;
  }, [stats, t]);

  const unlockedBadges = badges.filter((b) => b.unlocked);
  const lockedBadges = badges.filter((b) => !b.unlocked);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          🏆 {t('achievements.title')}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          {t('achievements.badgesUnlocked', {
            unlocked: unlockedBadges.length,
            total: badges.length,
          })}
        </p>
      </div>

      {/* Unlocked Badges */}
      {unlockedBadges.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {t('achievements.unlocked')}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {unlockedBadges.map((badge) => (
              <IconCard
                key={badge.id}
                icon={badge.icon}
                title={badge.title}
                description={badge.description}
                unlocked={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Locked Badges with Progress */}
      {lockedBadges.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {t('achievements.locked')}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {lockedBadges.map((badge) => (
              <IconCard
                key={badge.id}
                icon={badge.icon}
                title={badge.title}
                description={badge.description}
                unlocked={false}
                progress={badge.progress}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
