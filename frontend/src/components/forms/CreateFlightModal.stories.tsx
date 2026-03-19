import preview from '../../../.storybook/preview';
import { expect, userEvent, waitFor, screen } from 'storybook/test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, delay } from 'msw';
import { fn } from 'storybook/test';
import { CreateFlightModal } from './CreateFlightModal';

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

// Mock successful flight creation
const mockFlightResult = {
  flight: {
    id: 'new-flight-1',
    name: 'Vol Mont Poupet',
    flight_date: '2024-03-15',
    site_name: 'Mont Poupet',
    duration_minutes: 65,
    distance_km: 12.5,
    max_altitude_m: 1200,
    avg_speed_kmh: 22.3,
  },
};


export const FlightModal = meta.story({
  args: {
    isOpen: true,
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

FlightModal.test('The upload button is disabled when no file selected', async() => {
  const uploadButton = await screen.getByText('📤 Créer le vol');
  await expect(uploadButton).toBeDisabled()
})

FlightModal.test('It can upload a file', async ({args}) => {
  // Create a mock GPX file
  const file = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test-flight.gpx', {
    type: 'application/gpx+xml',
  });

  // Find the file input
  const input = screen.getByLabelText('Fichier GPX ou IGC') as HTMLInputElement;
  
  // Upload the file
  await userEvent.upload(input, file);
  await expect(await screen.findByText(/test-flight.gpx/)).toBeInTheDocument();

  // Click the upload button
  const uploadButton = await screen.findByText('📤 Créer le vol');
  await userEvent.click(uploadButton);
  
  // Verify success message appears{
  await expect(await screen.findByText('✅ Vol créé avec succès')).toBeInTheDocument();

  await expect(args.onCreateComplete).toHaveBeenCalled()
  await waitFor(async () => {
    await expect(args.onClose).toHaveBeenCalled()
  }, {timeout: 3000})
})

FlightModal.test('it clears the selected file when click on cancel', async () => {
  // Create a mock GPX file
  const file = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test-flight.gpx', {
    type: 'application/gpx+xml',
  });

  // Find the file input
  const input = await screen.findByLabelText('Fichier GPX ou IGC') as HTMLInputElement;

  // Upload the file
  await userEvent.upload(input, file);
  await expect(await screen.findByText(/test-flight.gpx/)).toBeInTheDocument();

  // Click the upload button
  const cancelButton = screen.getByText('Annuler');
  await userEvent.click(cancelButton);

  await expect(screen.queryByText(/test-flight.gpx/)).not.toBeInTheDocument();
})

/*FlightModal.test('It displays uploading state', async () => {
  const file = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test-flight.gpx', {
    type: 'application/gpx+xml',
  });

  const input = await screen.findByLabelText('Fichier GPX ou IGC') as HTMLInputElement;
  await userEvent.upload(input, file);

  const uploadButton = await screen.findByText('📤 Créer le vol');
  await userEvent.click(uploadButton);


    await expect(await screen.findByText(/Création en cours.../)).toBeInTheDocument();
})*/

FlightModal.test('shows error message when upload fails', {parameters: {
    msw: {
      handlers: [
        http.post('*/api/flights/create-from-gpx', async () => {
          await delay(100);
          return new HttpResponse(
              JSON.stringify({
                error: 'Fichier GPX invalide',
                message: 'Le fichier GPX ne contient pas de données de vol valides',
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
  }}, async ({args}) => {
  // Create a mock GPX file
  const file = new File(['<?xml version="1.0"?><gpx></gpx>'], 'invalid-flight.gpx', {
    type: 'application/gpx+xml',
  });

  // Find the file input and upload
  const input = await screen.findByLabelText('Fichier GPX ou IGC') as HTMLInputElement;
  await userEvent.upload(input, file);
  
  // Verify file is selected
  await expect(await screen.findByText(/invalid-flight.gpx/)).toBeInTheDocument();

  // Click the upload button
  const uploadButton = await screen.findByText('📤 Créer le vol');
  await userEvent.click(uploadButton);

  // Wait for error message to appear
  await waitFor(async () => {
    expect(await screen.findByText('❌ Erreur lors de la création')).toBeInTheDocument();
  }, { timeout: 5000 });

  // Verify the error message contains helpful text
  await expect(await screen.findByText(/données de vol valides/i)).toBeInTheDocument();

  // Verify that onCreateComplete was NOT called (since upload failed)
  await expect(args.onCreateComplete).not.toHaveBeenCalled();
  
  // Verify that onClose was NOT called (modal should stay open on error)
  await expect(args.onClose).not.toHaveBeenCalled();
  
  // The success message should NOT appear
  await expect(screen.queryByText('✅ Vol créé avec succès')).not.toBeInTheDocument();
});

FlightModal.test('it calls onClose when click on close button', async ({args}) => {
  await userEvent.click(screen.getByRole('button', {name: /fermer/i}))
  await expect(args.onClose).toHaveBeenCalled()
})