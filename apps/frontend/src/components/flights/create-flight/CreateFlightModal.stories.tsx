import preview from '../../../../.storybook/preview';
import { expect, userEvent, waitFor, screen } from 'storybook/test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, delay } from 'msw';
import { fn } from 'storybook/test';
import { CreateFlightModal } from './CreateFlightModal';
import type { Site } from '../../../types';

const mockSites: Site[] = [
  {
    id: 'site-mont-poupet',
    name: 'Mont Poupet',
    latitude: 46.98,
    longitude: 5.88,
    country: 'FR',
    region: 'Besançon',
    camera_distance: null,
    flight_count: 1,
    is_active: true,
  },
];

const meta = preview.meta({
  title: 'Components/Forms/CreateFlightModal',
  component: CreateFlightModal,
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

// Mock successful flight creation
const mockFlightResult = {
  flight: {
    id: 'new-flight-1',
    site_id: 'site-mont-poupet',
    name: 'Vol Mont Poupet',
    flight_date: '2024-03-15',
    site_name: 'Mont Poupet',
    duration_minutes: 65,
    distance_km: 12.5,
    max_altitude_m: 1200,
    avg_speed_kmh: 22.3,
  },
};

const mockManualFlight = {
  id: 'manual-flight-1',
  site_id: null,
  site_name: null,
  external_provider: null,
  external_activity_id: null,
  name: 'Vol du soir',
  title: 'Vol du soir',
  description: null,
  flight_date: '2024-03-15',
  departure_time: null,
  duration_minutes: null,
  max_altitude_m: null,
  max_speed_kmh: null,
  distance_km: null,
  elevation_gain_m: null,
  notes: null,
  gpx_file_path: null,
  external_url: null,
};

export const FlightModal = meta.story({
  name: 'Flight Modal',
  args: {
    isOpen: true,
    sites: mockSites,
    onClose: fn(),
    onCreateComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('*/api/flights', () => {
          return HttpResponse.json(mockManualFlight);
        }),
        http.post('*/api/flights/create-from-gpx', () => {
          return HttpResponse.json(mockFlightResult);
        }),
      ],
    },
  },
});

export const FileImport = meta.story({
  name: 'File Import',
  args: {
    isOpen: true,
    sites: mockSites,
    initialMode: 'file',
    onClose: fn(),
    onCreateComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('*/api/flights/create-from-gpx', () => {
          return HttpResponse.json(mockFlightResult);
        }),
      ],
    },
  },
});

FileImport.test('It opens directly on file import', async () => {
  await expect(
    screen.getByRole('tab', { name: /Importer un fichier/u })
  ).toHaveAttribute('aria-selected', 'true');
  await expect(screen.getByLabelText('Fichier GPX ou IGC')).toBeInTheDocument();
});

FlightModal.test(
  'It can create a flight from basic information',
  async ({ args }) => {
    const titleInput = screen.getByLabelText('Titre du vol');
    await userEvent.type(titleInput, 'Vol du soir');

    await userEvent.click(screen.getByRole('button', { name: 'Créer le vol' }));

    await expect(
      await screen.findByText('Vol créé avec succès')
    ).toBeInTheDocument();
    await expect(args.onCreateComplete).toHaveBeenCalled();
  }
);

FlightModal.test(
  'The upload button is disabled when no file selected',
  async () => {
    await userEvent.click(
      screen.getByRole('tab', { name: /Importer un fichier/u })
    );
    const uploadButton = screen.getByRole('button', { name: /Créer le vol/u });
    await expect(uploadButton).toBeDisabled();
  }
);

FlightModal.test('It can upload a file', async ({ args }) => {
  await userEvent.click(
    screen.getByRole('tab', { name: /Importer un fichier/u })
  );

  // Create a mock GPX file
  const file = new File(
    ['<?xml version="1.0"?><gpx></gpx>'],
    'test-flight.gpx',
    {
      type: 'application/gpx+xml',
    }
  );

  // Find the file input
  const input = screen.getByLabelText('Fichier GPX ou IGC') as HTMLInputElement;

  // Upload the file
  await userEvent.upload(input, file);
  await expect(await screen.findByText(/test-flight.gpx/u)).toBeInTheDocument();

  // Click the upload button
  const uploadButton = screen.getByRole('button', { name: /Créer le vol/u });
  await userEvent.click(uploadButton);

  // Verify success message appears
  await expect(
    await screen.findByText('Vol créé avec succès')
  ).toBeInTheDocument();
  await expect(
    await screen.findByText(/Besançon - Mont Poupet/u)
  ).toBeInTheDocument();

  await expect(args.onCreateComplete).toHaveBeenCalled();
});

FlightModal.test(
  'it clears the selected file when click on cancel',
  async () => {
    await userEvent.click(
      screen.getByRole('tab', { name: /Importer un fichier/u })
    );

    // Create a mock GPX file
    const file = new File(
      ['<?xml version="1.0"?><gpx></gpx>'],
      'test-flight.gpx',
      {
        type: 'application/gpx+xml',
      }
    );

    // Find the file input
    const input = (await screen.findByLabelText(
      'Fichier GPX ou IGC'
    )) as HTMLInputElement;

    // Upload the file
    await userEvent.upload(input, file);
    await expect(
      await screen.findByText(/test-flight.gpx/u)
    ).toBeInTheDocument();

    // Click the upload button
    const cancelButton = screen.getByText('Annuler');
    await userEvent.click(cancelButton);

    await expect(
      screen.queryByText(/test-flight.gpx/u)
    ).not.toBeInTheDocument();
  }
);

/*FlightModal.test('It displays uploading state', async () => {
  const file = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test-flight.gpx', {
    type: 'application/gpx+xml',
  });

  const input = await screen.findByLabelText('Fichier GPX ou IGC') as HTMLInputElement;
  await userEvent.upload(input, file);

  const uploadButton = await screen.findByText('📤 Créer le vol');
  await userEvent.click(uploadButton);


    await expect(await screen.findByText(/Création en cours.../u)).toBeInTheDocument();
})*/

FlightModal.test(
  'shows error message when upload fails',
  {
    parameters: {
      msw: {
        handlers: [
          http.post('*/api/flights/create-from-gpx', async () => {
            await delay(100);
            return new HttpResponse(
              JSON.stringify({
                error: 'Fichier GPX invalide',
                message:
                  'Le fichier GPX ne contient pas de données de vol valides',
              }),
              {
                status: 400,
                headers: {
                  'Content-Type': 'application/json',
                },
              }
            );
          }),
        ],
      },
    },
  },
  async ({ args }) => {
    await userEvent.click(
      screen.getByRole('tab', { name: /Importer un fichier/u })
    );

    // Create a mock GPX file
    const file = new File(
      ['<?xml version="1.0"?><gpx></gpx>'],
      'invalid-flight.gpx',
      {
        type: 'application/gpx+xml',
      }
    );

    // Find the file input and upload
    const input = (await screen.findByLabelText(
      'Fichier GPX ou IGC'
    )) as HTMLInputElement;
    await userEvent.upload(input, file);

    // Verify file is selected
    await expect(
      await screen.findByText(/invalid-flight.gpx/u)
    ).toBeInTheDocument();

    // Click the upload button
    const uploadButton = screen.getByRole('button', { name: /Créer le vol/u });
    await userEvent.click(uploadButton);

    // Wait for error message to appear
    await waitFor(
      async () => {
        await expect(
          await screen.findByText('Erreur lors de la création')
        ).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Verify the error message contains helpful text
    await expect(
      await screen.findByText(
        'Le fichier GPX ne contient pas de données de vol valides'
      )
    ).toBeInTheDocument();

    // Verify that onCreateComplete was NOT called (since upload failed)
    await expect(args.onCreateComplete).not.toHaveBeenCalled();

    // Verify that onClose was NOT called (modal should stay open on error)
    await expect(args.onClose).not.toHaveBeenCalled();

    // The success message should NOT appear
    await expect(
      screen.queryByText('Vol créé avec succès')
    ).not.toBeInTheDocument();
  }
);

FlightModal.test(
  'it calls onClose when click on close button',
  async ({ args }) => {
    await userEvent.click(screen.getByRole('button', { name: /fermer/iu }));
    await expect(args.onClose).toHaveBeenCalled();
  }
);
