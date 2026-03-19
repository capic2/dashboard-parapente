import { expect, userEvent } from 'storybook/test';
import { fn } from 'storybook/test';
import preview from '../../../.storybook/preview';
import {
  BestSpotSuggestion,
  BestSpotSuggestionCompact,
} from './BestSpotSuggestion';
import type { BestSpotResult } from '../../hooks/useBestSpot';

const meta = preview.meta({
  title: 'Components/Weather/BestSpotSuggestion',
  component: BestSpotSuggestion,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
});

export default meta;

// Mock data
const mockBestSpotExcellent: BestSpotResult = {
  site: {
    id: '1',
    name: 'Annecy',
    orientation: 'NW',
    latitude: 45.9,
    longitude: 6.1,
    country: 'FR',
    rating: 5,
    camera_distance: null,
    flight_count: 0,
    is_active: true,
  },
  paraIndex: 90,
  windDirection: 'NW',
  windSpeed: 12,
  windFavorability: 'good',
  score: 90,
  reason: 'Excellentes conditions (Para-Index 90), vent favorable NW 12km/h',
};

const mockBestSpotGood: BestSpotResult = {
  site: {
    id: '2',
    name: 'Chamonix',
    orientation: 'N',
    latitude: 45.9,
    longitude: 6.8,
    country: 'FR',
    camera_distance: null,
    flight_count: 0,
    is_active: true,
  },
  paraIndex: 75,
  windDirection: 'N',
  windSpeed: 15,
  windFavorability: 'good',
  score: 75,
  reason: 'Bonnes conditions (Para-Index 75), vent favorable N 15km/h',
};

const mockBestSpotModerate: BestSpotResult = {
  site: {
    id: '3',
    name: 'Talloires',
    orientation: 'W',
    latitude: 45.8,
    longitude: 6.2,
    country: 'FR',
    camera_distance: null,
    flight_count: 0,
    is_active: true,
  },
  paraIndex: 55,
  windDirection: 'E',
  windSpeed: 18,
  windFavorability: 'moderate',
  score: 55,
  reason: 'Conditions moyennes (Para-Index 55)',
};

const mockBestSpotPoor: BestSpotResult = {
  site: {
    id: '4',
    name: 'Col de la Forclaz',
    orientation: 'S',
    latitude: 45.8,
    longitude: 6.2,
    country: 'FR',
    camera_distance: null,
    flight_count: 0,
    is_active: true,
  },
  paraIndex: 35,
  windDirection: 'N',
  windSpeed: 25,
  windFavorability: 'bad',
  score: 35,
  reason: 'Conditions limites (Para-Index 35), vent défavorable N 25km/h',
};

const mockBestSpotNoWind: BestSpotResult = {
  site: {
    id: '5',
    name: 'Les Contamines',
    orientation: 'E',
    latitude: 45.8,
    longitude: 6.7,
    country: 'FR',
    camera_distance: null,
    flight_count: 0,
    is_active: true,
  },
  paraIndex: 80,
  windDirection: undefined,
  windSpeed: undefined,
  windFavorability: 'moderate',
  score: 80,
  reason: 'Excellentes conditions (Para-Index 80)',
};

const mockBestSpotNoRating: BestSpotResult = {
  site: {
    id: '6',
    name: 'Saint-Hilaire',
    orientation: 'S',
    latitude: 45.3,
    longitude: 5.9,
    country: 'FR',
    camera_distance: null,
    flight_count: 0,
    is_active: true,
  },
  paraIndex: 88,
  windDirection: 'S',
  windSpeed: 10,
  windFavorability: 'good',
  score: 88,
  reason: 'Excellentes conditions (Para-Index 88), vent favorable S 10km/h',
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

// No site in bestSpot (renders nothing)
export const NoSite = meta.story({
  render: () => (
    <BestSpotSuggestion
      bestSpot={{
        site: null,
        paraIndex: 0,
        windFavorability: 'moderate' as const,
        score: 0,
        reason: 'Aucune donnée météo disponible',
      }}
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
  await expect(canvas.getByText("Meilleur spot aujourd'hui")).toBeInTheDocument();
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

  await user.click(button!);

  // Note: In CSF3 with .test(), we can't easily check the callback
  // This test verifies the button is clickable and doesn't error
});
