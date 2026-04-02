import preview from '../../../.storybook/preview';
import AchievementsBadges from './AchievementsBadges';

const meta = preview.meta({
  title: 'Components/Stats/AchievementsBadges',
  component: AchievementsBadges,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
});

export const baseStats = {
  total_flights: 0,
  total_hours: 0,
  total_duration_minutes: 0,
  total_distance_km: 0,
  total_elevation_gain_m: 0,
  avg_duration_minutes: 0,
  avg_distance_km: 0,
  max_altitude_m: 0,
  favorite_spot: null,
  favorite_site: null,
  last_flight_date: null,
};

export const noBadgesStats = {};

export const partialProgressStats = {
  total_flights: 25,
  total_hours: 50,
  max_altitude_m: 2500,
  total_distance_km: 250,
};

export const allUnlockedStats = {
  total_flights: 100,
  total_hours: 100,
  max_altitude_m: 3000,
  total_distance_km: 500,
};

export const NoBadges = meta.story({
  name: 'No Badges',
  args: {
    stats: { ...baseStats, ...noBadgesStats },
  },
});

export const PartialProgress = meta.story({
  name: 'Partial Progress',
  args: {
    stats: { ...baseStats, ...partialProgressStats },
  },
});

export const AllUnlocked = meta.story({
  name: 'All Unlocked',
  args: {
    stats: { ...baseStats, ...allUnlockedStats },
  },
});
