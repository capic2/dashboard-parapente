import type { Meta } from '@storybook/react';
import { expect, within, userEvent, waitFor } from 'storybook/test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, delay } from 'msw';
import { fn } from 'storybook/test';
import { CreateSiteModal } from './CreateSiteModal';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = {
  title: 'Components/Forms/CreateSiteModal',
  component: CreateSiteModal,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CreateSiteModal>;

export default meta;

// Mock geocoding result
const mockGeocodeResult = {
  latitude: 47.238,
  longitude: 6.024,
  display_name: 'Besançon, Doubs, France',
};

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

// Default story - Closed
export const Closed = {
  args: {
    isOpen: false,
    onClose: fn(),
    onSiteCreated: fn(),
  },
};

// Open - Search mode
export const OpenSearchMode = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSiteCreated: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/geocode', () => {
          return HttpResponse.json(mockGeocodeResult);
        }),
      ],
    },
  },
};

// Open - Manual mode
export const OpenManualMode = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSiteCreated: fn(),
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const manualButton = canvas.getByText('Saisie manuelle');
    await userEvent.click(manualButton);
  },
};

// Open - Auto-detect mode (with flight ID and GPX data)
export const OpenAutoDetectMode = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSiteCreated: fn(),
    flightId: 'flight-1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/flights/:id/gpx', () => {
          return HttpResponse.json(mockGPXData);
        }),
      ],
    },
  },
};

// Search success
export const SearchSuccess = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSiteCreated: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/geocode', () => {
          return HttpResponse.json(mockGeocodeResult);
        }),
      ],
    },
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();

    const input = canvas.getByPlaceholderText(/Ex: Besançon/);
    await user.type(input, 'Besançon');

    const searchButton = canvas.getByText('Rechercher');
    await user.click(searchButton);
  },
};

// Search loading
export const SearchLoading = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSiteCreated: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/geocode', async () => {
          await delay('infinite');
          return HttpResponse.json(mockGeocodeResult);
        }),
      ],
    },
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();

    const input = canvas.getByPlaceholderText(/Ex: Besançon/);
    await user.type(input, 'Besançon');

    const searchButton = canvas.getByText('Rechercher');
    await user.click(searchButton);
  },
};

// Manual entry filled
export const ManualEntryFilled = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSiteCreated: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('http://localhost:5000/api/sites', () => {
          return HttpResponse.json(mockCreatedSite);
        }),
      ],
    },
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();

    const manualButton = canvas.getByText('Saisie manuelle');
    await user.click(manualButton);

    const nameInput = canvas.getByPlaceholderText(/Ex: Mont Poupet/);
    await user.type(nameInput, 'Mont Poupet');

    const latInput = canvas.getByPlaceholderText('47.238');
    await user.type(latInput, '47.238');

    const lonInput = canvas.getByPlaceholderText('6.024');
    await user.type(lonInput, '6.024');

    const elevInput = canvas.getByPlaceholderText('450');
    await user.type(elevInput, '450');
  },
};

// Create site loading
export const CreateSiteLoading = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSiteCreated: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('http://localhost:5000/api/sites', async () => {
          await delay('infinite');
          return HttpResponse.json(mockCreatedSite);
        }),
      ],
    },
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();

    const manualButton = canvas.getByText('Saisie manuelle');
    await user.click(manualButton);

    const nameInput = canvas.getByPlaceholderText(/Ex: Mont Poupet/);
    await user.type(nameInput, 'Mont Poupet');

    const latInput = canvas.getByPlaceholderText('47.238');
    await user.type(latInput, '47.238');

    const lonInput = canvas.getByPlaceholderText('6.024');
    await user.type(lonInput, '6.024');

    const createButton = canvas.getByText('Créer le site');
    await user.click(createButton);
  },
};

// Interaction Tests

export const OpensAndClosesModal = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSiteCreated: fn(),
  },
  test: async ({ args, canvas }: { args: any; canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    expect(canvasElement.getByText('Créer un nouveau site')).toBeInTheDocument();

    const cancelButton = canvasElement.getByText('Annuler');
    await userEvent.click(cancelButton);

    expect(args.onClose).toHaveBeenCalled();
  },
};

export const SwitchesBetweenModes = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSiteCreated: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    const user = userEvent.setup();

    // Default is search mode
    expect(canvasElement.getByPlaceholderText(/Ex: Besançon/)).toBeInTheDocument();

    // Switch to manual mode
    const manualButton = canvasElement.getByText('Saisie manuelle');
    await user.click(manualButton);

    expect(canvasElement.getByPlaceholderText(/Ex: Mont Poupet/)).toBeInTheDocument();

    // Switch back to search
    const searchButton = canvasElement.getByText('Recherche');
    await user.click(searchButton);

    expect(canvasElement.getByPlaceholderText(/Ex: Besançon/)).toBeInTheDocument();
  },
};

export const SearchesForLocation = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSiteCreated: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/geocode', () => {
          return HttpResponse.json(mockGeocodeResult);
        }),
      ],
    },
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    const user = userEvent.setup();

    const input = canvasElement.getByPlaceholderText(/Ex: Besançon/);
    await user.type(input, 'Besançon');

    const searchButton = canvasElement.getByText('Rechercher');
    await user.click(searchButton);

    await waitFor(() => {
      expect(canvasElement.getByText(/✓ Trouvé !/)).toBeInTheDocument();
    });

    expect(canvasElement.getByText(/Besançon, Doubs, France/)).toBeInTheDocument();
  },
};

export const CreatesSiteSuccessfully = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSiteCreated: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('http://localhost:5000/api/sites', () => {
          return HttpResponse.json(mockCreatedSite);
        }),
      ],
    },
  },
  test: async ({ args, canvas }: { args: any; canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    const user = userEvent.setup();

    const manualButton = canvasElement.getByText('Saisie manuelle');
    await user.click(manualButton);

    const nameInput = canvasElement.getByPlaceholderText(/Ex: Mont Poupet/);
    await user.type(nameInput, 'Mont Poupet');

    const latInput = canvasElement.getByPlaceholderText('47.238');
    await user.type(latInput, '47.238');

    const lonInput = canvasElement.getByPlaceholderText('6.024');
    await user.type(lonInput, '6.024');

    const createButton = canvasElement.getByText('Créer le site');
    await user.click(createButton);

    await waitFor(() => {
      expect(args.onSiteCreated).toHaveBeenCalledWith(mockCreatedSite);
    });

    expect(args.onClose).toHaveBeenCalled();
  },
};

export const DisablesCreateButtonWhenInvalid = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSiteCreated: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    const user = userEvent.setup();

    const manualButton = canvasElement.getByText('Saisie manuelle');
    await user.click(manualButton);

    const createButton = canvasElement.getByText('Créer le site');
    expect(createButton).toBeDisabled();

    // Add name only
    const nameInput = canvasElement.getByPlaceholderText(/Ex: Mont Poupet/);
    await user.type(nameInput, 'Mont Poupet');
    expect(createButton).toBeDisabled();

    // Add coordinates
    const latInput = canvasElement.getByPlaceholderText('47.238');
    await user.type(latInput, '47.238');

    const lonInput = canvasElement.getByPlaceholderText('6.024');
    await user.type(lonInput, '6.024');

    // Now should be enabled
    expect(createButton).not.toBeDisabled();
  },
};

export const ShowsAutoDetectWithFlightId = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSiteCreated: fn(),
    flightId: 'flight-1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/flights/:id/gpx', () => {
          return HttpResponse.json(mockGPXData);
        }),
      ],
    },
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    await waitFor(() => {
      expect(canvasElement.getByText('Auto-détection')).toBeInTheDocument();
    });
  },
};
