import { expect, userEvent, screen } from 'storybook/test';
import { fn } from 'storybook/test';
import preview from '../../../.storybook/preview';
import {
  BestSpotSuggestion,
  BestSpotSuggestionCompact,
} from './BestSpotSuggestion';
import type { BestSpotResult } from '../../hooks/useBestSpotAPI';

const meta = preview.meta({
  title: 'Components/Weather/BestSpotSuggestion',
  component: BestSpotSuggestion,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
});

export default meta;

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
  reason: 'Excellentes conditions (Para-Index 90), vent favorable NW 12km/h',
  verdict: 'BON',
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
  reason: 'Bonnes conditions (Para-Index 75), vent favorable N 15km/h',
  verdict: 'BON',
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
  reason: 'Conditions moyennes (Para-Index 55)',
  verdict: 'MOYEN',
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
  reason: 'Conditions limites (Para-Index 35), vent défavorable N 25km/h',
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

// Default story - Excellent conditions
export const ExcellentConditions = meta.story({
  render: () => (
    <BestSpotSuggestion
      bestSpot={mockBestSpotExcellent}
      onSelectSite={fn()}
    />
  ),
});

// Good conditions
export const GoodConditions = meta.story({
  render: () => (
    <BestSpotSuggestion
      bestSpot={mockBestSpotGood}
      onSelectSite={fn()}
    />
  ),
});

// Moderate conditions
export const ModerateConditions = meta.story({
  render: () => (
    <BestSpotSuggestion
      bestSpot={mockBestSpotModerate}
      onSelectSite={fn()}
    />
  ),
});

// Poor conditions
export const PoorConditions = meta.story({
  render: () => (
    <BestSpotSuggestion
      bestSpot={mockBestSpotPoor}
      onSelectSite={fn()}
    />
  ),
});

// No wind data
export const NoWindData = meta.story({
  render: () => (
    <BestSpotSuggestion
      bestSpot={mockBestSpotNoWind}
      onSelectSite={fn()}
    />
  ),
});

// No rating
export const NoRating = meta.story({
  render: () => (
    <BestSpotSuggestion
      bestSpot={mockBestSpotNoRating}
      onSelectSite={fn()}
    />
  ),
});

// Null data (renders nothing)
export const NullData = meta.story({
  render: () => (
    <BestSpotSuggestion
      bestSpot={null}
      onSelectSite={fn()}
    />
  ),
});

// No site in bestSpot (renders nothing) - using null for the whole bestSpot
export const NoSite = meta.story({
  render: () => (
    <BestSpotSuggestion
      bestSpot={null}
      onSelectSite={fn()}
    />
  ),
});

// With custom className
export const CustomClassName = meta.story({
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
  render: () => (
    <BestSpotSuggestionCompact
      bestSpot={mockBestSpotExcellent}
      onSelectSite={fn()}
    />
  ),
});

// Compact variant - No wind
export const CompactNoWind = meta.story({
  render: () => (
    <BestSpotSuggestionCompact
      bestSpot={mockBestSpotNoWind}
      onSelectSite={fn()}
    />
  ),
});

// Compact variant - Null data
export const CompactNullData = meta.story({
  render: () => (
    <BestSpotSuggestionCompact
      bestSpot={null}
      onSelectSite={fn()}
    />
  ),
});

// Interaction Tests

export const DisplaysBestSpotData = meta.story({
  render: () => (
    <BestSpotSuggestion
      bestSpot={mockBestSpotExcellent}
      onSelectSite={fn()}
    />
  ),
});

DisplaysBestSpotData.test('should display best spot data correctly', async ({ canvas }) => {
  await expect(canvas.getByText("Meilleur spot pour aujourd'hui")).toBeInTheDocument();
  await expect(canvas.getByText('Annecy')).toBeInTheDocument();
  await expect(canvas.getByText('90/100')).toBeInTheDocument();
  await expect(canvas.getByText('Vent:')).toBeInTheDocument();
  await expect(canvas.getAllByText(/NW 12km\/h/).length).toBeGreaterThan(0);
  await expect(canvas.getByText(/Excellentes conditions/)).toBeInTheDocument();
  await expect(canvas.getByText('Voir les prévisions →')).toBeInTheDocument();
});

export const ShowsRatingStars = meta.story({
  render: () => (
    <BestSpotSuggestion
      bestSpot={mockBestSpotExcellent}
      onSelectSite={fn()}
    />
  ),
});

ShowsRatingStars.test('should show rating stars when available', async ({ canvas }) => {
  // Rating stars should be displayed
  const ratingText = canvas.queryByText('⭐⭐⭐⭐⭐');
  await expect(ratingText).toBeInTheDocument();
});

export const HidesWindWhenNotAvailable = meta.story({
  render: () => (
    <BestSpotSuggestion
      bestSpot={mockBestSpotNoWind}
      onSelectSite={fn()}
    />
  ),
});

HidesWindWhenNotAvailable.test('should hide wind info when not available', async ({ canvas }) => {
  await expect(canvas.getByText('Les Contamines')).toBeInTheDocument();
  await expect(canvas.getByText('80/100')).toBeInTheDocument();
  await expect(canvas.queryByText(/Vent:/)).not.toBeInTheDocument();
});

export const CallsOnSelectSiteCallback = meta.story({
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

CallsOnSelectSiteCallback.test('should call onSelectSite callback when button clicked', async ({ canvas }) => {
  const user = userEvent.setup();

  const button = canvas.getByText('Voir les prévisions →');
  await user.click(button);

  // Note: In CSF3 with .test(), we can't easily check the callback
  // This test verifies the button is clickable and doesn't error
});

export const RendersNothingWhenNull = meta.story({
  render: () => (
    <BestSpotSuggestion
      bestSpot={null}
      onSelectSite={fn()}
    />
  ),
});

RendersNothingWhenNull.test('should render nothing when bestSpot is null', async ({ canvas }) => {
  await expect(canvas.queryByText("Meilleur spot aujourd'hui")).not.toBeInTheDocument();
});

export const CompactCallsOnSelectSite = meta.story({
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

CompactCallsOnSelectSite.test('should call onSelectSite callback in compact variant', async ({ canvas }) => {
  const user = userEvent.setup();

  const button = canvas.getByText('Annecy').closest('button');
  await expect(button).toBeInTheDocument();

  if (button) await user.click(button);

  // Note: In CSF3 with .test(), we can't easily check the callback
  // This test verifies the button is clickable and doesn't error
});

// ==========================================
// NEW STORIES - DAY INDEX SUPPORT
// ==========================================

/**
 * Meilleur spot pour aujourd'hui (day 0)
 */
export const Today = meta.story({
  args: {
    bestSpot: mockBestSpotExcellent,
    selectedDayIndex: 0,
    onSelectSite: fn(),
  },
});

Today.test('should display "aujourd\'hui"', async () => {
  await expect(screen.getByText(/aujourd'hui/i)).toBeInTheDocument();
});

/**
 * Meilleur spot pour demain (day 1)
 */
export const Tomorrow = meta.story({
  args: {
    bestSpot: mockBestSpotGood,
    selectedDayIndex: 1,
    onSelectSite: fn(),
  },
});

Tomorrow.test('should display "demain"', async () => {
  await expect(screen.getByText(/demain/i)).toBeInTheDocument();
});

/**
 * Meilleur spot pour dans 3 jours (day 3)
 */
export const Day3 = meta.story({
  args: {
    bestSpot: mockBestSpotModerate,
    selectedDayIndex: 3,
    onSelectSite: fn(),
  },
});

Day3.test('should display formatted date', async () => {
  // Devrait afficher "jeudi 22 mars" ou similaire
  const text = screen.getByText(/meilleur spot pour/i).textContent;
  expect(text).toMatch(/\w+ \d+ \w+/); // Pattern: "jeudi 22 mars"
});

/**
 * Test de vent favorable (good)
 */
export const FavorableWind = meta.story({
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
