import preview from '../../../.storybook/preview';
import { expect, fn, screen, userEvent } from 'storybook/test';
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
            gcTime: 0,  // Disable cache
            staleTime: 0,  // Always consider data stale
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

export default meta;

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

Modal.test('It is possible to search for a site', async ({ step }) => {
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
});

// Search loading
export const SearchLoading = meta.story({
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

SearchLoading.test('interaction test', async () => {
  const input = screen.getByPlaceholderText(/Ex: Besançon/);
  await userEvent.type(input, 'Besançon');

  const searchButton = screen.getByText('Rechercher');
  await userEvent.click(searchButton);
});
/*
// Manual entry filled
export const ManualEntryFilled = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onSiteCreated: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('*!/api/sites', () => {
          return HttpResponse.json(mockCreatedSite);
        }),
      ],
    },
  },
});

ManualEntryFilled.test('interaction test', async ({ canvas }) => {
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
});

// Create site loading
export const CreateSiteLoading = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onSiteCreated: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('*!/api/sites', async () => {
          await delay('infinite');
          return HttpResponse.json(mockCreatedSite);
        }),
      ],
    },
  },
});

CreateSiteLoading.test('interaction test', async ({ canvas }) => {
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
});

// Interaction Tests

export const OpensAndClosesModal = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onSiteCreated: fn(),
  },
});

OpensAndClosesModal.test('opens and closes modal', async ({ args, canvas }) => {
  await expect(canvas.getByText('Créer un nouveau site')).toBeInTheDocument();

  const cancelButton = canvas.getByText('Annuler');
  await userEvent.click(cancelButton);

  await expect(args.onClose).toHaveBeenCalled();
});

export const SwitchesBetweenModes = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onSiteCreated: fn(),
  },
});

SwitchesBetweenModes.test(
  'switches between search and manual modes',
  async ({ canvas }) => {
    const user = userEvent.setup();

    // Default is search mode
    await expect(
      canvas.getByPlaceholderText(/Ex: Besançon/)
    ).toBeInTheDocument();

    // Switch to manual mode
    const manualButton = canvas.getByText('Saisie manuelle');
    await user.click(manualButton);

    await expect(
      canvas.getByPlaceholderText(/Ex: Mont Poupet/)
    ).toBeInTheDocument();

    // Switch back to search
    const searchButton = canvas.getByText('Recherche');
    await user.click(searchButton);

    await expect(
      canvas.getByPlaceholderText(/Ex: Besançon/)
    ).toBeInTheDocument();
  }
);

export const SearchesForLocation = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onSiteCreated: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*!/api/spots/geocode', () => {
          return HttpResponse.json(mockGeocodeResult);
        }),
      ],
    },
  },
});

SearchesForLocation.test(
  'searches for location and displays results',
  async ({ canvas }) => {
    const user = userEvent.setup();

    const input = canvas.getByPlaceholderText(/Ex: Besançon/);
    await user.type(input, 'Besançon');

    const searchButton = canvas.getByText('Rechercher');
    await user.click(searchButton);

    await waitFor(() => {
      expect(canvas.getByText(/✓ Trouvé !/)).toBeInTheDocument();
    });

    await expect(
      canvas.getByText(/Besançon, Doubs, France/)
    ).toBeInTheDocument();
  }
);

export const CreatesSiteSuccessfully = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onSiteCreated: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('*!/api/sites', () => {
          return HttpResponse.json(mockCreatedSite);
        }),
      ],
    },
  },
});

CreatesSiteSuccessfully.test(
  'creates site successfully and calls callbacks',
  async ({ args, canvas }) => {
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

    await waitFor(() => {
      expect(args.onSiteCreated).toHaveBeenCalledWith(mockCreatedSite);
    });

    await expect(args.onClose).toHaveBeenCalled();
  }
);

export const DisablesCreateButtonWhenInvalid = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onSiteCreated: fn(),
  },
});

DisablesCreateButtonWhenInvalid.test(
  'disables create button when form is invalid',
  async ({ canvas }) => {
    const user = userEvent.setup();

    const manualButton = canvas.getByText('Saisie manuelle');
    await user.click(manualButton);

    const createButton = canvas.getByText('Créer le site');
    await expect(createButton).toBeDisabled();

    // Add name only
    const nameInput = canvas.getByPlaceholderText(/Ex: Mont Poupet/);
    await user.type(nameInput, 'Mont Poupet');
    await expect(createButton).toBeDisabled();

    // Add coordinates
    const latInput = canvas.getByPlaceholderText('47.238');
    await user.type(latInput, '47.238');

    const lonInput = canvas.getByPlaceholderText('6.024');
    await user.type(lonInput, '6.024');

    // Now should be enabled
    await expect(createButton).not.toBeDisabled();
  }
);

export const ShowsAutoDetectWithFlightId = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onSiteCreated: fn(),
    flightId: 'flight-1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*!/api/flights/:id/gpx', () => {
          return HttpResponse.json(mockGPXData);
        }),
      ],
    },
  },
});

ShowsAutoDetectWithFlightId.test(
  'shows auto-detect mode with flight ID',
  async ({ canvas }) => {
    await waitFor(() => {
      expect(canvas.getByText('Auto-détection')).toBeInTheDocument();
    });
  }
);*/
