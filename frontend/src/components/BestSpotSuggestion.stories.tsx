import type { Meta } from '@storybook/react';
import { expect, within, userEvent } from 'storybook/test';
import { fn } from 'storybook/test';
import {
  BestSpotSuggestion,
  BestSpotSuggestionCompact,
} from './BestSpotSuggestion';
import type { BestSpotResult } from '../hooks/useBestSpot';

const meta = {
  title: 'Components/Weather/BestSpotSuggestion',
  component: BestSpotSuggestion,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof BestSpotSuggestion>;

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
export const ExcellentConditions = {
  args: {
    bestSpot: mockBestSpotExcellent,
    onSelectSite: fn(),
  },
};

// Good conditions
export const GoodConditions = {
  args: {
    bestSpot: mockBestSpotGood,
    onSelectSite: fn(),
  },
};

// Moderate conditions
export const ModerateConditions = {
  args: {
    bestSpot: mockBestSpotModerate,
    onSelectSite: fn(),
  },
};

// Poor conditions
export const PoorConditions = {
  args: {
    bestSpot: mockBestSpotPoor,
    onSelectSite: fn(),
  },
};

// No wind data
export const NoWindData = {
  args: {
    bestSpot: mockBestSpotNoWind,
    onSelectSite: fn(),
  },
};

// No rating
export const NoRating = {
  args: {
    bestSpot: mockBestSpotNoRating,
    onSelectSite: fn(),
  },
};

// Null data (renders nothing)
export const NullData = {
  args: {
    bestSpot: null,
    onSelectSite: fn(),
  },
};

// No site in bestSpot (renders nothing)
export const NoSite = {
  args: {
    bestSpot: {
      site: null,
      paraIndex: 0,
      windFavorability: 'moderate' as const,
      score: 0,
      reason: 'Aucune donnée météo disponible',
    },
    onSelectSite: fn(),
  },
};

// With custom className
export const CustomClassName = {
  args: {
    bestSpot: mockBestSpotExcellent,
    onSelectSite: fn(),
    className: 'max-w-2xl',
  },
};

// Compact variant - Excellent
export const CompactExcellent = {
  render: (args: any) => <BestSpotSuggestionCompact {...args} />,
  args: {
    bestSpot: mockBestSpotExcellent,
    onSelectSite: fn(),
  },
};

// Compact variant - No wind
export const CompactNoWind = {
  render: (args: any) => <BestSpotSuggestionCompact {...args} />,
  args: {
    bestSpot: mockBestSpotNoWind,
    onSelectSite: fn(),
  },
};

// Compact variant - Null data
export const CompactNullData = {
  render: (args: any) => <BestSpotSuggestionCompact {...args} />,
  args: {
    bestSpot: null,
    onSelectSite: fn(),
  },
};

// Interaction Tests

export const DisplaysBestSpotData = {
  args: {
    bestSpot: mockBestSpotExcellent,
    onSelectSite: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    expect(
      canvasElement.getByText("Meilleur spot aujourd'hui")
    ).toBeInTheDocument();
    expect(canvasElement.getByText('Annecy')).toBeInTheDocument();
    expect(canvasElement.getByText('90/100')).toBeInTheDocument();
    expect(canvasElement.getByText(/NW 12km\/h/)).toBeInTheDocument();
    expect(
      canvasElement.getByText(/Excellentes conditions/)
    ).toBeInTheDocument();
    expect(
      canvasElement.getByText('Voir les prévisions →')
    ).toBeInTheDocument();
  },
};

export const ShowsRatingStars = {
  args: {
    bestSpot: mockBestSpotExcellent,
    onSelectSite: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    // Rating stars should be displayed
    const ratingText = canvasElement.queryByText('⭐⭐⭐⭐⭐');
    expect(ratingText).toBeInTheDocument();
  },
};

export const HidesWindWhenNotAvailable = {
  args: {
    bestSpot: mockBestSpotNoWind,
    onSelectSite: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    expect(canvasElement.getByText('Les Contamines')).toBeInTheDocument();
    expect(canvasElement.getByText('80/100')).toBeInTheDocument();
    expect(canvasElement.queryByText(/Vent:/)).not.toBeInTheDocument();
  },
};

export const CallsOnSelectSiteCallback = {
  args: {
    bestSpot: mockBestSpotExcellent,
    onSelectSite: fn(),
  },
  test: async ({ args, canvas }: { args: any; canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    const user = userEvent.setup();

    const button = canvasElement.getByText('Voir les prévisions →');
    await user.click(button);

    expect(args.onSelectSite).toHaveBeenCalledWith('1');
  },
};

export const RendersNothingWhenNull = {
  args: {
    bestSpot: null,
    onSelectSite: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    expect(
      canvasElement.queryByText("Meilleur spot aujourd'hui")
    ).not.toBeInTheDocument();
  },
};

export const CompactCallsOnSelectSite = {
  render: (args: any) => <BestSpotSuggestionCompact {...args} />,
  args: {
    bestSpot: mockBestSpotExcellent,
    onSelectSite: fn(),
  },
  test: async ({ args, canvas }: { args: any; canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    const user = userEvent.setup();

    const button = canvasElement.getByText('Annecy').closest('button');
    expect(button).toBeInTheDocument();

    await user.click(button!);

    expect(args.onSelectSite).toHaveBeenCalledWith('1');
  },
};
