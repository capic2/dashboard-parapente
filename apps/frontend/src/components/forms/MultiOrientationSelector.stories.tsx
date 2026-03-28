import preview from '../../../.storybook/preview';
import { expect, userEvent, waitFor } from 'storybook/test';
import { fn } from 'storybook/test';
import { MultiOrientationSelector } from './MultiOrientationSelector';
import type {Site} from "@dashboard-parapente/shared-types";


const meta = preview.meta({
  title: 'Components/Forms/MultiOrientationSelector',
  component: MultiOrientationSelector,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
});

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
    camera_distance: null,
    flight_count: 0,
    is_active: true,
  },
  {
    id: '2',
    name: 'Mont Poupet Sud',
    orientation: 'S',
    latitude: 46.8,
    longitude: 5.9,
    elevation_m: 850,
    rating: 5,
    country: 'FR',
    camera_distance: null,
    flight_count: 0,
    is_active: true,
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
    camera_distance: null,
    flight_count: 0,
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
    country: 'FR',
    camera_distance: null,
    flight_count: 0,
    is_active: true,
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
    camera_distance: null,
    flight_count: 0,
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
    country: 'FR',
    camera_distance: null,
    flight_count: 0,
    is_active: true,
  },
  {
    id: '7',
    name: 'Talloires Sud',
    orientation: 'S',
    latitude: 45.8,
    longitude: 6.2,
    elevation_m: 900,
    country: 'FR',
    camera_distance: null,
    flight_count: 0,
    is_active: true,
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
export const MultipleOrientationsWithWeather = meta.story({
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '1',
    onSelectSite: fn(),
    weatherData: mockWeatherData,
  },
});

// Two orientations
export const TwoOrientations = meta.story({
  args: {
    sites: mockSitesAnnecy,
    selectedSiteId: '4',
    onSelectSite: fn(),
    weatherData: mockWeatherData,
  },
});

// No weather data
export const NoWeatherData = meta.story({
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '2',
    onSelectSite: fn(),
  },
});

// No rating
export const NoRating = meta.story({
  args: {
    sites: mockSitesNoRating,
    selectedSiteId: '6',
    onSelectSite: fn(),
  },
});

// Custom base name
export const CustomBaseName = meta.story({
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '1',
    onSelectSite: fn(),
    weatherData: mockWeatherData,
    baseName: 'Poupet',
  },
});

// No site selected
export const NoSelection = meta.story({
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '',
    onSelectSite: fn(),
    weatherData: mockWeatherData,
  },
});

// Single site (edge case)
export const SingleSite = meta.story({
  args: {
    sites: [mockSitesMontPoupet[0]],
    selectedSiteId: '1',
    onSelectSite: fn(),
  },
});

// No elevation data
export const NoElevation = meta.story({
  args: {
    sites: mockSitesMontPoupet.map((site) => ({
      ...site,
      elevation_m: undefined,
    })),
    selectedSiteId: '1',
    onSelectSite: fn(),
  },
});

// Open dropdown initially (for visual testing)
export const DropdownOpen = meta.story({
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '1',
    onSelectSite: fn(),
    weatherData: mockWeatherData,
  },
});

DropdownOpen.test("interaction test", async ({ canvas }) => {
  const button = canvas.getByRole('button');
  await userEvent.click(button);
});

// Interaction Tests

export const DisplaysSiteName = meta.story({
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '1',
    onSelectSite: fn(),
  },
});

DisplaysSiteName.test('displays site name and orientation', async ({ canvas }) => {
  await expect(canvas.getByText('Mont Poupet')).toBeInTheDocument();
  await expect(canvas.getByText('(N)')).toBeInTheDocument();
});

export const OpensDropdownOnClick = meta.story({
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '1',
    onSelectSite: fn(),
  },
});

OpensDropdownOnClick.test('opens dropdown on click', async ({ canvas }) => {
  const user = userEvent.setup();

  const button = canvas.getByRole('button');
  await user.click(button);

  await waitFor(() => {
    expect(
      canvas.getByText('Choisir un décollage')
    ).toBeInTheDocument();
  });

  await expect(canvas.getByText('Nord')).toBeInTheDocument();
  await expect(canvas.getByText('Sud')).toBeInTheDocument();
  await expect(canvas.getByText('Est')).toBeInTheDocument();
});

export const SelectsSiteFromDropdown = meta.story({
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '1',
    onSelectSite: fn(),
  },
});

SelectsSiteFromDropdown.test('selects site from dropdown', async ({ args, canvas }) => {
  const user = userEvent.setup();

  // Open dropdown
  const button = canvas.getByRole('button');
  await user.click(button);

  await waitFor(() => {
    expect(canvas.getByText('Sud')).toBeInTheDocument();
  });

  // Click on "Sud" option
  const sudOption = canvas.getByText('Sud');
  await user.click(sudOption);

  // Callback should be called with site id '2'
  await expect(args.onSelectSite).toHaveBeenCalledWith('2');
});

export const DisplaysWeatherData = meta.story({
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '1',
    onSelectSite: fn(),
    weatherData: mockWeatherData,
  },
});

DisplaysWeatherData.test('displays weather data in dropdown', async ({ canvas }) => {
  const user = userEvent.setup();

  // Open dropdown
  const button = canvas.getByRole('button');
  await user.click(button);

  await waitFor(() => {
    expect(canvas.getByText(/Para-Index: 85/)).toBeInTheDocument();
  });
});

export const HighlightsSelectedSite = meta.story({
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '2',
    onSelectSite: fn(),
  },
});

HighlightsSelectedSite.test('highlights selected site', async ({ canvas }) => {
  const user = userEvent.setup();

  // Open dropdown
  const button = canvas.getByRole('button');
  await user.click(button);

  await waitFor(() => {
    expect(canvas.getByText('Sud')).toBeInTheDocument();
  });

  // Check that "Sud" option has selected styles
  const sudOption = canvas.getByText('Sud').closest('button');
  await expect(sudOption).toHaveClass('bg-blue-50');
});

export const ClosesOnOutsideClick = meta.story({
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '1',
    onSelectSite: fn(),
  },
});

ClosesOnOutsideClick.test('closes dropdown on outside click', async ({ canvas }) => {
  const user = userEvent.setup();

  // Open dropdown
  const button = canvas.getByRole('button');
  await user.click(button);

  await waitFor(() => {
    expect(
      canvas.getByText('Choisir un décollage')
    ).toBeInTheDocument();
  });

  // Click outside (on document body)
  await user.click(document.body);

  await waitFor(() => {
    expect(
      canvas.queryByText('Choisir un décollage')
    ).not.toBeInTheDocument();
  });
});

export const ShowsRatingStars = meta.story({
  args: {
    sites: mockSitesMontPoupet,
    selectedSiteId: '1',
    onSelectSite: fn(),
  },
});

ShowsRatingStars.test('shows rating stars for sites', async ({ canvas }) => {
  const user = userEvent.setup();

  // Open dropdown
  const button = canvas.getByRole('button');
  await user.click(button);

  await waitFor(() => {
    expect(canvas.getByText(/⭐⭐⭐⭐⭐/)).toBeInTheDocument(); // 5 stars for Sud
  });
});
