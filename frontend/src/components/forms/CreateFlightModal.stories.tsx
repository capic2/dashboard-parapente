import preview from '../../../.storybook/preview';
import { expect, userEvent, waitFor } from 'storybook/test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, delay } from 'msw';
import { fn } from 'storybook/test';
import { CreateFlightModal } from './CreateFlightModal';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = preview.meta({
  title: 'Components/Forms/CreateFlightModal',
  component: CreateFlightModal,
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

// Closed state
export const Closed = meta.story({
  args: {
    isOpen: false,
    onClose: fn(),
    onCreateComplete: fn(),
  },
});

// Open - default state
export const Open = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('*/api/flights/upload*', () => {
          return HttpResponse.json(mockFlightResult);
        }),
      ],
    },
  },
});

// With file selected
export const WithFileSelected = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('*/api/flights/upload*', () => {
          return HttpResponse.json(mockFlightResult);
        }),
      ],
    },
  },
});

WithFileSelected.play = async ({ canvas }) => {
  // Create a mock GPX file
  const file = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test-flight.gpx', {
    type: 'application/gpx+xml',
  });

  const input = canvas.getByLabelText('Fichier GPX ou IGC') as HTMLInputElement;
  await userEvent.upload(input, file);
};

// Upload in progress
export const UploadInProgress = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('*/api/flights/upload*', async () => {
          await delay('infinite');
          return HttpResponse.json(mockFlightResult);
        }),
      ],
    },
  },
});

UploadInProgress.play = async ({ canvas }) => {
  const file = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test-flight.gpx', {
    type: 'application/gpx+xml',
  });

  const input = canvas.getByLabelText('Fichier GPX ou IGC') as HTMLInputElement;
  await userEvent.upload(input, file);

  const uploadButton = canvas.getByText('📤 Créer le vol');
  await userEvent.click(uploadButton);
};

// Upload success
export const UploadSuccess = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('*/api/flights/upload*', async () => {
          await delay(500);
          return HttpResponse.json(mockFlightResult);
        }),
      ],
    },
  },
});

UploadSuccess.play = async ({ canvas }) => {
  const file = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test-flight.gpx', {
    type: 'application/gpx+xml',
  });

  const input = canvas.getByLabelText('Fichier GPX ou IGC') as HTMLInputElement;
  await userEvent.upload(input, file);

  const uploadButton = canvas.getByText('📤 Créer le vol');
  await userEvent.click(uploadButton);
};

// IGC file selected
export const IGCFileSelected = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('*/api/flights/upload*', () => {
          return HttpResponse.json(mockFlightResult);
        }),
      ],
    },
  },
});

IGCFileSelected.play = async ({ canvas }) => {
  const file = new File(['IGCFILE'], 'test-flight.igc', {
    type: 'application/vnd.fai.igc',
  });

  const input = canvas.getByLabelText('Fichier GPX ou IGC') as HTMLInputElement;
  await userEvent.upload(input, file);
};

// Interaction Tests

export const DisplaysModalTitle = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
});

DisplaysModalTitle.test('displays modal title and instructions', async ({ canvas }) => {
  await expect(canvas.getByText('📤 Créer un vol depuis GPX/IGC')).toBeInTheDocument();
  await expect(canvas.getByText(/Uploadez un fichier GPX ou IGC/)).toBeInTheDocument();
});

export const AcceptsGPXFile = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
});

AcceptsGPXFile.test('accepts GPX file upload', async ({ canvas }) => {
  const file = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test-flight.gpx', {
    type: 'application/gpx+xml',
  });

  const input = canvas.getByLabelText('Fichier GPX ou IGC') as HTMLInputElement;
  await userEvent.upload(input, file);

  await waitFor(() => {
    expect(canvas.getByText(/test-flight.gpx/)).toBeInTheDocument();
  });
});

export const DisablesUploadWithoutFile = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
});

DisablesUploadWithoutFile.test('disables upload button without file', async ({ canvas }) => {
  const uploadButton = canvas.getByText('📤 Créer le vol');
  await expect(uploadButton).toBeDisabled();
});

export const EnablesUploadWithFile = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
});

EnablesUploadWithFile.test('enables upload button with file', async ({ canvas }) => {
  const file = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test-flight.gpx', {
    type: 'application/gpx+xml',
  });

  const input = canvas.getByLabelText('Fichier GPX ou IGC') as HTMLInputElement;
  await userEvent.upload(input, file);

  const uploadButton = canvas.getByText('📤 Créer le vol');
  await expect(uploadButton).not.toBeDisabled();
});

export const ShowsUploadingState = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('*/api/flights/upload*', async () => {
          await delay(100);
          return HttpResponse.json(mockFlightResult);
        }),
      ],
    },
  },
});

ShowsUploadingState.test('shows uploading state during upload', async ({ canvas }) => {
  const file = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test-flight.gpx', {
    type: 'application/gpx+xml',
  });

  const input = canvas.getByLabelText('Fichier GPX ou IGC') as HTMLInputElement;
  await userEvent.upload(input, file);

  const uploadButton = canvas.getByText('📤 Créer le vol');
  await userEvent.click(uploadButton);

  await waitFor(() => {
    expect(canvas.getByText(/Création en cours.../)).toBeInTheDocument();
  });
});

export const ShowsSuccessMessage = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('*/api/flights/upload*', async () => {
          await delay(100);
          return HttpResponse.json(mockFlightResult);
        }),
      ],
    },
  },
});

ShowsSuccessMessage.test('shows success message after upload', async ({ canvas }) => {
  const file = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test-flight.gpx', {
    type: 'application/gpx+xml',
  });

  const input = canvas.getByLabelText('Fichier GPX ou IGC') as HTMLInputElement;
  await userEvent.upload(input, file);

  const uploadButton = canvas.getByText('📤 Créer le vol');
  await userEvent.click(uploadButton);

  await waitFor(() => {
    expect(canvas.getByText('✅ Vol créé avec succès')).toBeInTheDocument();
  }, { timeout: 3000 });

  await expect(canvas.getByText(/Vol Mont Poupet/)).toBeInTheDocument();
  await expect(canvas.getByText(/Mont Poupet/)).toBeInTheDocument();
  await expect(canvas.getByText(/65 min/)).toBeInTheDocument();
});

export const CallsOnCreateComplete = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('*/api/flights/upload*', async () => {
          await delay(100);
          return HttpResponse.json(mockFlightResult);
        }),
      ],
    },
  },
});

CallsOnCreateComplete.test('calls onCreateComplete callback', async ({ args, canvas }) => {
  const file = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test-flight.gpx', {
    type: 'application/gpx+xml',
  });

  const input = canvas.getByLabelText('Fichier GPX ou IGC') as HTMLInputElement;
  await userEvent.upload(input, file);

  const uploadButton = canvas.getByText('📤 Créer le vol');
  await userEvent.click(uploadButton);

  await waitFor(() => {
    expect(args.onCreateComplete).toHaveBeenCalled();
  }, { timeout: 3000 });
});

export const ClosesModalOnCancel = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
});

ClosesModalOnCancel.test('closes modal on cancel click', async ({ args, canvas }) => {
  const cancelButton = canvas.getByText('Annuler');
  await userEvent.click(cancelButton);

  await expect(args.onClose).toHaveBeenCalled();
});
