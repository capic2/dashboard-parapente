import preview from '../../../.storybook/preview';
import { expect, fn, screen } from 'storybook/test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { delay, http, HttpResponse } from 'msw';
import { CreateSiteModal } from './CreateSiteModal';

const meta = preview.meta({
  title: 'Components/Forms/CreateSiteModal',
  component: CreateSiteModal,
  decorators: [
    (Story) => {
      // Create a new QueryClient for each story to avoid cache conflicts
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: 0, // Disable cache
            staleTime: 0, // Always consider data stale
          },
        },
      });

      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
});

// Mock geocoding result
const mockGeocodeResult = {
  latitude: 47.238,
  longitude: 6.024,
  display_name: 'Besançon, Doubs, France',
};

/*
// Mock GPX data
const mockGPXData = {
  coordinates: [
    { lat: 47.25, lon: 6.03, elevation: 450, time: '2024-03-15T10:00:00Z' },
    { lat: 47.26, lon: 6.04, elevation: 500, time: '2024-03-15T10:05:00Z' },
  ],
};

// Mock created site
const mockCreatedSite = {
  id: 'new-site-1',
  name: 'Mont Poupet',
  latitude: 47.238,
  longitude: 6.024,
  elevation_m: 450,
  country: 'FR',
};
*/

export const Modal = meta.story({
  name: 'Modal',
  args: {
    isOpen: true,
    onClose: fn(),
    onSiteCreated: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/spots/geocode', () => {
          return HttpResponse.json(mockGeocodeResult);
        }),
      ],
    },
  },
});

Modal.test('The creation button is disabled if no data', async () => {
  await expect(
    screen.getByRole('button', { name: /créer le site/i })
  ).toBeDisabled();
});

Modal.test(
  'It is possible to search for a site',
  async ({ step, userEvent }) => {
    const input = screen.getByPlaceholderText(/Ex: Besançon/);
    await userEvent.type(input, 'Besançon');

    const searchButton = screen.getByText('Rechercher');
    await userEvent.click(searchButton);

    await expect(await screen.findByText(/✓ Trouvé !/)).toBeInTheDocument();

    // Verify the location details are shown
    await expect(
      await screen.findByText(/Besançon, Doubs, France/)
    ).toBeInTheDocument();
    await expect(await screen.findByText(/47.23800/)).toBeInTheDocument();

    await step('it fills the form fields', async () => {
      await expect(
        screen.getByLabelText('Nom du site', { exact: false })
      ).toHaveValue('Besançon');
      await expect(
        screen.getByLabelText('Latitude', { exact: false })
      ).toHaveValue(47.238);
      await expect(
        screen.getByLabelText('Longitude', { exact: false })
      ).toHaveValue(6.024);
      await expect(
        screen.getByLabelText('Altitude', { exact: false })
      ).toHaveValue(null);
    });
  }
);

// Search loading
export const SearchLoading = meta.story({
  name: 'Search Loading',
  args: {
    isOpen: true,
    onClose: fn(),
    onSiteCreated: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/spots/geocode', async () => {
          await delay('infinite');
          return HttpResponse.json(mockGeocodeResult);
        }),
      ],
    },
  },
});

SearchLoading.test('interaction test', async ({ userEvent }) => {
  const input = screen.getByPlaceholderText(/Ex: Besançon/);
  await userEvent.type(input, 'Besançon');

  const searchButton = screen.getByText('Rechercher');
  await userEvent.click(searchButton);
});
