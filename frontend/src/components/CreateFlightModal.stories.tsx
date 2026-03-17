import type { Meta } from '@storybook/react';
import { expect, within, userEvent, waitFor } from 'storybook/test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, delay } from 'msw';
import { fn } from 'storybook/test';
import { CreateFlightModal } from './CreateFlightModal';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = {
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
} satisfies Meta<typeof CreateFlightModal>;

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
export const Closed = {
  args: {
    isOpen: false,
    onClose: fn(),
    onCreateComplete: fn(),
  },
};

// Open - default state
export const Open = {
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('http://localhost:5000/api/flights/upload', () => {
          return HttpResponse.json(mockFlightResult);
        }),
      ],
    },
  },
};

// With file selected
export const WithFileSelected = {
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('http://localhost:5000/api/flights/upload', () => {
          return HttpResponse.json(mockFlightResult);
        }),
      ],
    },
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    
    // Create a mock GPX file
    const file = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test-flight.gpx', {
      type: 'application/gpx+xml',
    });

    const input = canvas.getByLabelText('Fichier GPX ou IGC') as HTMLInputElement;
    await userEvent.upload(input, file);
  },
};

// Upload in progress
export const UploadInProgress = {
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('http://localhost:5000/api/flights/upload', async () => {
          await delay('infinite');
          return HttpResponse.json(mockFlightResult);
        }),
      ],
    },
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    
    const file = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test-flight.gpx', {
      type: 'application/gpx+xml',
    });

    const input = canvas.getByLabelText('Fichier GPX ou IGC') as HTMLInputElement;
    await userEvent.upload(input, file);

    const uploadButton = canvas.getByText('📤 Créer le vol');
    await userEvent.click(uploadButton);
  },
};

// Upload success
export const UploadSuccess = {
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('http://localhost:5000/api/flights/upload', async () => {
          await delay(500);
          return HttpResponse.json(mockFlightResult);
        }),
      ],
    },
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    
    const file = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test-flight.gpx', {
      type: 'application/gpx+xml',
    });

    const input = canvas.getByLabelText('Fichier GPX ou IGC') as HTMLInputElement;
    await userEvent.upload(input, file);

    const uploadButton = canvas.getByText('📤 Créer le vol');
    await userEvent.click(uploadButton);
  },
};

// IGC file selected
export const IGCFileSelected = {
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('http://localhost:5000/api/flights/upload', () => {
          return HttpResponse.json(mockFlightResult);
        }),
      ],
    },
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    
    const file = new File(['IGCFILE'], 'test-flight.igc', {
      type: 'application/vnd.fai.igc',
    });

    const input = canvas.getByLabelText('Fichier GPX ou IGC') as HTMLInputElement;
    await userEvent.upload(input, file);
  },
};

// Interaction Tests

export const DisplaysModalTitle = {
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    expect(canvasElement.getByText('📤 Créer un vol depuis GPX/IGC')).toBeInTheDocument();
    expect(canvasElement.getByText(/Uploadez un fichier GPX ou IGC/)).toBeInTheDocument();
  },
};

export const AcceptsGPXFile = {
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    
    const file = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test-flight.gpx', {
      type: 'application/gpx+xml',
    });

    const input = canvasElement.getByLabelText('Fichier GPX ou IGC') as HTMLInputElement;
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(canvasElement.getByText(/test-flight.gpx/)).toBeInTheDocument();
    });
  },
};

export const DisablesUploadWithoutFile = {
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    const uploadButton = canvasElement.getByText('📤 Créer le vol');
    expect(uploadButton).toBeDisabled();
  },
};

export const EnablesUploadWithFile = {
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    
    const file = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test-flight.gpx', {
      type: 'application/gpx+xml',
    });

    const input = canvasElement.getByLabelText('Fichier GPX ou IGC') as HTMLInputElement;
    await userEvent.upload(input, file);

    const uploadButton = canvasElement.getByText('📤 Créer le vol');
    expect(uploadButton).not.toBeDisabled();
  },
};

export const ShowsUploadingState = {
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('http://localhost:5000/api/flights/upload', async () => {
          await delay(100);
          return HttpResponse.json(mockFlightResult);
        }),
      ],
    },
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    
    const file = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test-flight.gpx', {
      type: 'application/gpx+xml',
    });

    const input = canvasElement.getByLabelText('Fichier GPX ou IGC') as HTMLInputElement;
    await userEvent.upload(input, file);

    const uploadButton = canvasElement.getByText('📤 Créer le vol');
    await userEvent.click(uploadButton);

    await waitFor(() => {
      expect(canvasElement.getByText(/Création en cours.../)).toBeInTheDocument();
    });
  },
};

export const ShowsSuccessMessage = {
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('http://localhost:5000/api/flights/upload', async () => {
          await delay(100);
          return HttpResponse.json(mockFlightResult);
        }),
      ],
    },
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    
    const file = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test-flight.gpx', {
      type: 'application/gpx+xml',
    });

    const input = canvasElement.getByLabelText('Fichier GPX ou IGC') as HTMLInputElement;
    await userEvent.upload(input, file);

    const uploadButton = canvasElement.getByText('📤 Créer le vol');
    await userEvent.click(uploadButton);

    await waitFor(() => {
      expect(canvasElement.getByText('✅ Vol créé avec succès')).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(canvasElement.getByText(/Vol Mont Poupet/)).toBeInTheDocument();
    expect(canvasElement.getByText(/Mont Poupet/)).toBeInTheDocument();
    expect(canvasElement.getByText(/65 min/)).toBeInTheDocument();
  },
};

export const CallsOnCreateComplete = {
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('http://localhost:5000/api/flights/upload', async () => {
          await delay(100);
          return HttpResponse.json(mockFlightResult);
        }),
      ],
    },
  },
  test: async ({ args, canvas }: { args: any; canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    
    const file = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test-flight.gpx', {
      type: 'application/gpx+xml',
    });

    const input = canvasElement.getByLabelText('Fichier GPX ou IGC') as HTMLInputElement;
    await userEvent.upload(input, file);

    const uploadButton = canvasElement.getByText('📤 Créer le vol');
    await userEvent.click(uploadButton);

    await waitFor(() => {
      expect(args.onCreateComplete).toHaveBeenCalled();
    }, { timeout: 3000 });
  },
};

export const ClosesModalOnCancel = {
  args: {
    isOpen: true,
    onClose: fn(),
    onCreateComplete: fn(),
  },
  test: async ({ args, canvas }: { args: any; canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    const cancelButton = canvasElement.getByText('Annuler');
    await userEvent.click(cancelButton);

    expect(args.onClose).toHaveBeenCalled();
  },
};
