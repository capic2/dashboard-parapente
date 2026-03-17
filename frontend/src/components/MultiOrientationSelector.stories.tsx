import type { Meta } from '@storybook/react';
import { expect, within, userEvent, waitFor } from 'storybook/test';
import { fn } from 'storybook/test';
import { MultiOrientationSelector } from './MultiOrientationSelector';
import type { Site } from '../types';

const meta = {
  title: 'Components/Forms/MultiOrientationSelector',
  component: MultiOrientationSelector,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof MultiOrientationSelector>;

export default meta;

// Mock sites with multiple orientations
const mockSitesMontPoupet: Site[] = [
  {
    id: '1',
    name: 'Mont Poupet Nord',
    orientation: 'N',
    latitude: 46.8,
    longitude: 5.9,
    elevation_m: 850,
    rating: 4,
    country: 'FR',
    is_active: true,
  },
  {
    id: '2',
    name: 'Mont Poupet Sud',
    orientation: 'S',
    is_active: true,
    country: 'FR',
    latitude: 46.8,
    longitude: 5.9,
    elevation_m: 850,
    rating: 5,
  },
  {
    id: '3',
    name: 'Mont Poupet Est',
    orientation: 'E',
    latitude: 46.8,
    longitude: 5.9,
    elevation_m: 850,
    rating: 3,
    country: 'FR',
    is_active: true,
  },
];

const mockSitesAnnecy: Site[] = [
  {
    id: '4',
    name: 'Annecy NW',
    orientation: 'NW',
    latitude: 45.9,
    longitude: 6.1,
    elevation_m: 1200,
    rating: 5,
    is_active: true,
    country: 'FR',
  },
  {
    id: '5',
    name: 'Annecy W',
    orientation: 'W',
    latitude: 45.9,
    longitude: 6.1,
    elevation_m: 1200,
    rating: 4,
    country: 'FR',
    is_active: true,
  },
];

const mockSitesNoRating: Site[] = [
  {
    id: '6',
    name: 'Talloires Nord',
    orientation: 'N',
    latitude: 45.8,
    longitude: 6.2,
    elevation_m: 900,
    is_active: true,
    country: 'FR',
  },
  {
    id: '7',
    name: 'Talloires Sud',
    orientation: 'S',
    latitude: 45.8,
    longitude: 6.2,
    elevation_m: 900,
    is_active: true,
    country: 'FR',
  },
];

const mockWeatherData = new Map([
  ['1', { windDirection: 'N', windSpeed: 12, paraIndex: 85 }],
  ['2', { windDirection: 'N', windSpeed: 12, paraIndex: 40 }],
  ['3', { windDirection: 'N', windSpeed: 12, paraIndex: 60 }],
  ['4', { windDirection: 'NW', windSpeed: 15, paraIndex: 90 }],
  ['5', { windDirection: 'NW', windSpeed: 15, paraIndex: 80 }],
]);

// Default story - Multiple orientations with weather
export const MultipleOrientationsWithWeather = {
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '1',
    onSelectSite: fn(),
    weatherData: mockWeatherData,
  },
};

// Two orientations
export const TwoOrientations = {
  args: {
    sites: mockSitesAnnecy,
    selectedSiteId: '4',
    onSelectSite: fn(),
    weatherData: mockWeatherData,
  },
};

// No weather data
export const NoWeatherData = {
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '2',
    onSelectSite: fn(),
  },
};

// No rating
export const NoRating = {
  args: {
    sites: mockSitesNoRating,
    selectedSiteId: '6',
    onSelectSite: fn(),
  },
};

// Custom base name
export const CustomBaseName = {
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '1',
    onSelectSite: fn(),
    weatherData: mockWeatherData,
    baseName: 'Poupet',
  },
};

// No site selected
export const NoSelection = {
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '',
    onSelectSite: fn(),
    weatherData: mockWeatherData,
  },
};

// Single site (edge case)
export const SingleSite = {
  args: {
    sites: [mockSitesMontPoupet[0]],
    selectedSiteId: '1',
    onSelectSite: fn(),
  },
};

// No elevation data
export const NoElevation = {
  args: {
    sites: mockSitesMontPoupet.map((site) => ({
      ...site,
      elevation_m: undefined,
    })),
    selectedSiteId: '1',
    onSelectSite: fn(),
  },
};

// Open dropdown initially (for visual testing)
export const DropdownOpen = {
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '1',
    onSelectSite: fn(),
    weatherData: mockWeatherData,
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await userEvent.click(button);
  },
};

// Interaction Tests

export const DisplaysSiteName = {
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '1',
    onSelectSite: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    expect(canvasElement.getByText('Mont Poupet')).toBeInTheDocument();
    expect(canvasElement.getByText('(N)')).toBeInTheDocument();
  },
};

export const OpensDropdownOnClick = {
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '1',
    onSelectSite: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    const user = userEvent.setup();

    const button = canvasElement.getByRole('button');
    await user.click(button);

    await waitFor(() => {
      expect(
        canvasElement.getByText('Choisir un décollage')
      ).toBeInTheDocument();
    });

    expect(canvasElement.getByText('Nord')).toBeInTheDocument();
    expect(canvasElement.getByText('Sud')).toBeInTheDocument();
    expect(canvasElement.getByText('Est')).toBeInTheDocument();
  },
};

export const SelectsSiteFromDropdown = {
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '1',
    onSelectSite: fn(),
  },
  test: async ({ args, canvas }: { args: any; canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    const user = userEvent.setup();

    // Open dropdown
    const button = canvasElement.getByRole('button');
    await user.click(button);

    await waitFor(() => {
      expect(canvasElement.getByText('Sud')).toBeInTheDocument();
    });

    // Click on "Sud" option
    const sudOption = canvasElement.getByText('Sud');
    await user.click(sudOption);

    // Callback should be called with site id '2'
    expect(args.onSelectSite).toHaveBeenCalledWith('2');
  },
};

export const DisplaysWeatherData = {
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '1',
    onSelectSite: fn(),
    weatherData: mockWeatherData,
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    const user = userEvent.setup();

    // Open dropdown
    const button = canvasElement.getByRole('button');
    await user.click(button);

    await waitFor(() => {
      expect(canvasElement.getByText(/Para-Index: 85/)).toBeInTheDocument();
    });
  },
};

export const HighlightsSelectedSite = {
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '2',
    onSelectSite: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    const user = userEvent.setup();

    // Open dropdown
    const button = canvasElement.getByRole('button');
    await user.click(button);

    await waitFor(() => {
      expect(canvasElement.getByText('Sud')).toBeInTheDocument();
    });

    // Check that "Sud" option has selected styles
    const sudOption = canvasElement.getByText('Sud').closest('button');
    expect(sudOption).toHaveClass('bg-blue-50');
  },
};

export const ClosesOnOutsideClick = {
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '1',
    onSelectSite: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    const user = userEvent.setup();

    // Open dropdown
    const button = canvasElement.getByRole('button');
    await user.click(button);

    await waitFor(() => {
      expect(
        canvasElement.getByText('Choisir un décollage')
      ).toBeInTheDocument();
    });

    // Click outside (on document body)
    await user.click(document.body);

    await waitFor(() => {
      expect(
        canvasElement.queryByText('Choisir un décollage')
      ).not.toBeInTheDocument();
    });
  },
};

export const ShowsRatingStars = {
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '1',
    onSelectSite: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    const user = userEvent.setup();

    // Open dropdown
    const button = canvasElement.getByRole('button');
    await user.click(button);

    await waitFor(() => {
      expect(canvasElement.getByText(/⭐⭐⭐⭐⭐/)).toBeInTheDocument(); // 5 stars for Sud
    });
  },
};
