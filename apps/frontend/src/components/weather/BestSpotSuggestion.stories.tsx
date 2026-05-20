import { fn } from 'storybook/test';
import preview from '../../../.storybook/preview';
import {
  BestSpotSuggestion,
  BestSpotSuggestionCompact,
} from './BestSpotSuggestion';
import type { BestSpotResult } from '../../hooks/weather/useBestSpotAPI';

const meta = preview.meta({
  title: 'Components/Weather/BestSpotSuggestion',
  component: BestSpotSuggestion,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
});

// Mock data - simplified to match API response
const mockBestSpotExcellent: BestSpotResult = {
  site: {
    id: '1',
    code: 'annecy',
    name: 'Annecy',
    orientation: 'NW',
    latitude: 45.9,
    longitude: 6.1,
    rating: 5,
  },
  paraIndex: 90,
  windDirection: 'NW',
  windSpeed: 12,
  windFavorability: 'good',
  score: 90,
  reason:
    'Excellentes conditions (Para-Index 90), 22°C, ciel dégagé, vent favorable NW 12km/h',
  verdict: 'BON',
  flyableSlot: '10h-17h',
  thermalCeiling: 2800,
};

const mockBestSpotGood: BestSpotResult = {
  site: {
    id: '2',
    code: 'chamonix',
    name: 'Chamonix',
    orientation: 'N',
    latitude: 45.9,
    longitude: 6.8,
  },
  paraIndex: 75,
  windDirection: 'N',
  windSpeed: 15,
  windFavorability: 'good',
  score: 75,
  reason:
    'Bonnes conditions (Para-Index 75), 18°C, nuageux 45%, vent favorable N 15km/h',
  verdict: 'BON',
  flyableSlot: '11h-16h',
  thermalCeiling: 2200,
};

const mockBestSpotModerate: BestSpotResult = {
  site: {
    id: '3',
    code: 'talloires',
    name: 'Talloires',
    orientation: 'W',
    latitude: 45.8,
    longitude: 6.2,
  },
  paraIndex: 55,
  windDirection: 'E',
  windSpeed: 18,
  windFavorability: 'moderate',
  score: 55,
  reason: 'Conditions moyennes (Para-Index 55), 15°C, nuageux 52%',
  verdict: 'MOYEN',
  flyableSlot: '12h-15h',
};

const mockBestSpotPoor: BestSpotResult = {
  site: {
    id: '4',
    code: 'col-forclaz',
    name: 'Col de la Forclaz',
    orientation: 'S',
    latitude: 45.8,
    longitude: 6.2,
  },
  paraIndex: 35,
  windDirection: 'N',
  windSpeed: 25,
  windFavorability: 'bad',
  score: 35,
  reason:
    'Conditions limites (Para-Index 35), 12°C, rafales 28km/h, vent défavorable N 25km/h',
  verdict: 'LIMITE',
};

const mockBestSpotNoWind: BestSpotResult = {
  site: {
    id: '5',
    code: 'contamines',
    name: 'Les Contamines',
    orientation: 'E',
    latitude: 45.8,
    longitude: 6.7,
  },
  paraIndex: 80,
  windDirection: undefined,
  windSpeed: undefined,
  windFavorability: 'moderate',
  score: 80,
  reason: 'Excellentes conditions (Para-Index 80)',
  verdict: 'BON',
};

const mockBestSpotNoRating: BestSpotResult = {
  site: {
    id: '6',
    code: 'saint-hilaire',
    name: 'Saint-Hilaire',
    orientation: 'S',
    latitude: 45.3,
    longitude: 5.9,
  },
  paraIndex: 88,
  windDirection: 'S',
  windSpeed: 10,
  windFavorability: 'good',
  score: 88,
  reason: 'Excellentes conditions (Para-Index 88), vent favorable S 10km/h',
  verdict: 'BON',
};

const mockHourlyBestSpots = [
  {
    ...mockBestSpotExcellent,
    hour: 10,
    score: 90,
    flyableSlot: '10h',
  },
  {
    ...mockBestSpotGood,
    hour: 11,
    score: 75,
    flyableSlot: '11h',
  },
  {
    ...mockBestSpotModerate,
    hour: 12,
    score: 55,
    flyableSlot: '12h',
  },
  {
    ...mockBestSpotNoRating,
    hour: 13,
    score: 88,
    flyableSlot: '13h',
  },
  {
    ...mockBestSpotExcellent,
    hour: 14,
    score: 82,
    flyableSlot: '14h',
  },
  {
    ...mockBestSpotGood,
    hour: 15,
    score: 68,
    flyableSlot: '15h',
  },
  {
    ...mockBestSpotModerate,
    hour: 16,
    score: 48,
    flyableSlot: '16h',
  },
  {
    ...mockBestSpotPoor,
    hour: 17,
    score: 24,
    flyableSlot: '17h',
  },
];

// Default story - Excellent conditions
export const ExcellentConditions = meta.story({
  name: 'Excellent Conditions',
  render: () => (
    <BestSpotSuggestion bestSpot={mockBestSpotExcellent} onSelectSite={fn()} />
  ),
});

// Good conditions
export const GoodConditions = meta.story({
  name: 'Good Conditions',
  render: () => (
    <BestSpotSuggestion bestSpot={mockBestSpotGood} onSelectSite={fn()} />
  ),
});

// Moderate conditions
export const ModerateConditions = meta.story({
  name: 'Moderate Conditions',
  render: () => (
    <BestSpotSuggestion bestSpot={mockBestSpotModerate} onSelectSite={fn()} />
  ),
});

// Poor conditions
export const PoorConditions = meta.story({
  name: 'Poor Conditions',
  render: () => (
    <BestSpotSuggestion bestSpot={mockBestSpotPoor} onSelectSite={fn()} />
  ),
});

// No wind data
export const NoWindData = meta.story({
  name: 'No Wind Data',
  render: () => (
    <BestSpotSuggestion bestSpot={mockBestSpotNoWind} onSelectSite={fn()} />
  ),
});

// No rating
export const NoRating = meta.story({
  name: 'No Rating',
  render: () => (
    <BestSpotSuggestion bestSpot={mockBestSpotNoRating} onSelectSite={fn()} />
  ),
});

export const HourlyTimeline = meta.story({
  name: 'Hourly Timeline',
  render: () => (
    <BestSpotSuggestion
      bestSpot={mockBestSpotExcellent}
      hourlyBestSpots={mockHourlyBestSpots}
      onSelectSite={fn()}
    />
  ),
});

export const HourlyTimelineSidebarWidth = meta.story({
  name: 'Hourly Timeline Sidebar Width',
  render: () => (
    <div className="w-[420px] max-w-full">
      <BestSpotSuggestion
        bestSpot={mockBestSpotExcellent}
        hourlyBestSpots={mockHourlyBestSpots}
        onSelectSite={fn()}
      />
    </div>
  ),
});

// Null data (renders nothing)
export const NullData = meta.story({
  name: 'Null Data',
  render: () => <BestSpotSuggestion bestSpot={null} onSelectSite={fn()} />,
});

// No site in bestSpot (renders nothing) - using null for the whole bestSpot
export const NoSite = meta.story({
  name: 'No Site',
  render: () => <BestSpotSuggestion bestSpot={null} onSelectSite={fn()} />,
});

// With custom className
export const CustomClassName = meta.story({
  name: 'Custom Class Name',
  render: () => (
    <BestSpotSuggestion
      bestSpot={mockBestSpotExcellent}
      onSelectSite={fn()}
      className="max-w-2xl"
    />
  ),
});

// Compact variant - Excellent
export const CompactExcellent = meta.story({
  name: 'Compact Excellent',
  render: () => (
    <BestSpotSuggestionCompact
      bestSpot={mockBestSpotExcellent}
      onSelectSite={fn()}
    />
  ),
});

// Compact variant - No wind
export const CompactNoWind = meta.story({
  name: 'Compact No Wind',
  render: () => (
    <BestSpotSuggestionCompact
      bestSpot={mockBestSpotNoWind}
      onSelectSite={fn()}
    />
  ),
});

// Compact variant - Null data
export const CompactNullData = meta.story({
  name: 'Compact Null Data',
  render: () => (
    <BestSpotSuggestionCompact bestSpot={null} onSelectSite={fn()} />
  ),
});

// Interaction Tests

export const DisplaysBestSpotData = meta.story({
  name: 'Displays Best Spot Data',
  render: () => (
    <BestSpotSuggestion bestSpot={mockBestSpotExcellent} onSelectSite={fn()} />
  ),
});

export const ShowsRatingStars = meta.story({
  name: 'Shows Rating Stars',
  render: () => (
    <BestSpotSuggestion bestSpot={mockBestSpotExcellent} onSelectSite={fn()} />
  ),
});

export const HidesWindWhenNotAvailable = meta.story({
  name: 'Hides Wind When Not Available',
  render: () => (
    <BestSpotSuggestion bestSpot={mockBestSpotNoWind} onSelectSite={fn()} />
  ),
});

export const CallsOnSelectSiteCallback = meta.story({
  name: 'Calls On Select Site Callback',
  render: () => {
    const onSelectSite = fn();
    return (
      <BestSpotSuggestion
        bestSpot={mockBestSpotExcellent}
        onSelectSite={onSelectSite}
      />
    );
  },
});

export const RendersNothingWhenNull = meta.story({
  name: 'Renders Nothing When Null',
  render: () => <BestSpotSuggestion bestSpot={null} onSelectSite={fn()} />,
});

export const CompactCallsOnSelectSite = meta.story({
  name: 'Compact Calls On Select Site',
  render: () => {
    const onSelectSite = fn();
    return (
      <BestSpotSuggestionCompact
        bestSpot={mockBestSpotExcellent}
        onSelectSite={onSelectSite}
      />
    );
  },
});

// ==========================================
// NEW STORIES - DAY INDEX SUPPORT
// ==========================================

/**
 * Meilleur spot pour aujourd'hui (day 0)
 */
export const Today = meta.story({
  name: 'Today',
  args: {
    bestSpot: mockBestSpotExcellent,
    selectedDayIndex: 0,
    onSelectSite: fn(),
  },
});

/**
 * Meilleur spot pour demain (day 1)
 */
export const Tomorrow = meta.story({
  name: 'Tomorrow',
  args: {
    bestSpot: mockBestSpotGood,
    selectedDayIndex: 1,
    onSelectSite: fn(),
  },
});

/**
 * Meilleur spot pour dans 3 jours (day 3)
 */
export const Day3 = meta.story({
  name: 'Day 3',
  args: {
    bestSpot: mockBestSpotModerate,
    selectedDayIndex: 3,
    onSelectSite: fn(),
  },
});

/**
 * Test de vent favorable (good)
 */
export const FavorableWind = meta.story({
  name: 'Favorable Wind',
  args: {
    bestSpot: {
      ...mockBestSpotExcellent,
      windFavorability: 'good',
      paraIndex: 80,
    },
    selectedDayIndex: 0,
    onSelectSite: fn(),
  },
});

/**
 * Test de vent modéré (moderate)
 */
export const ModerateWind = meta.story({
  name: 'Moderate Wind',
  args: {
    bestSpot: {
      ...mockBestSpotModerate,
      windFavorability: 'moderate',
      paraIndex: 60,
    },
    selectedDayIndex: 0,
    onSelectSite: fn(),
  },
});

/**
 * Test de vent défavorable (bad)
 */
export const BadWind = meta.story({
  name: 'Bad Wind',
  args: {
    bestSpot: {
      ...mockBestSpotPoor,
      windFavorability: 'bad',
      paraIndex: 40,
    },
    selectedDayIndex: 0,
    onSelectSite: fn(),
  },
});
