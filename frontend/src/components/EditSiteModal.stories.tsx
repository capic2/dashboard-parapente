import type { Meta } from '@storybook/react';
import { expect, within, userEvent, waitFor } from 'storybook/test';
import { fn } from 'storybook/test';
import { EditSiteModal } from './EditSiteModal';
import type { Site } from '../schemas';

const meta = {
  title: 'Components/Forms/EditSiteModal',
  component: EditSiteModal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof EditSiteModal>;

export default meta;

// Mock site data
const mockSite: Site = {
  id: '1',
  name: 'Mont Poupet',
  code: 'POUPET',
  latitude: 47.238,
  longitude: 6.024,
  elevation_m: 450,
  region: 'Franche-Comté',
  country: 'FR',
  orientation: 'NW',
  camera_angle: 180,
  camera_distance: 500,
  flight_count: 0,
  usage_type: 'both',
  description: 'Magnifique site de vol',
  is_active: true,
};

const mockSiteMinimal: Site = {
  id: '2',
  name: 'Site Simple',
  code: 'SIMPLE',
  latitude: 45.0,
  longitude: 6.0,
  elevation_m: 300,
  country: 'FR',
  camera_distance: null,
  flight_count: 0,
  usage_type: 'both',
  is_active: true,
};

// Closed state
export const Closed = {
  args: {
    site: null,
    isOpen: false,
    onClose: fn(),
    onSave: fn(),
  },
};

// Edit mode - open
export const EditMode = {
  args: {
    site: mockSite,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
};

// Create mode - open
export const CreateMode = {
  args: {
    site: null,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
};

// Edit with minimal data
export const EditMinimalData = {
  args: {
    site: mockSiteMinimal,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
};

// Takeoff only
export const TakeoffOnly = {
  args: {
    site: { ...mockSite, usage_type: 'takeoff' },
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
};

// Landing only
export const LandingOnly = {
  args: {
    site: { ...mockSite, usage_type: 'landing' },
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
};

// Different orientation
export const OrientationSouth = {
  args: {
    site: { ...mockSite, orientation: 'S' },
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
};

// Different country
export const CountrySwitzerland = {
  args: {
    site: { ...mockSite, country: 'CH' },
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
};

// Custom camera settings
export const CustomCameraSettings = {
  args: {
    site: { ...mockSite, camera_angle: 90, camera_distance: 1500 },
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
};

// Saving state
export const SavingState = {
  args: {
    site: mockSite,
    isOpen: true,
    onClose: fn(),
    onSave: fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 10000));
    }),
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const saveButton = canvas.getByText('💾 Enregistrer');
    await userEvent.click(saveButton);
  },
};

// Interaction Tests

export const DisplaysSiteData = {
  args: {
    site: mockSite,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    expect(canvasElement.getByText('Modifier Mont Poupet')).toBeInTheDocument();
    expect(canvasElement.getByDisplayValue('Mont Poupet')).toBeInTheDocument();
    expect(canvasElement.getByDisplayValue('POUPET')).toBeInTheDocument();
    expect(canvasElement.getByDisplayValue('47.238')).toBeInTheDocument();
    expect(canvasElement.getByDisplayValue('6.024')).toBeInTheDocument();
  },
};

export const ShowsCreateModeTitle = {
  args: {
    site: null,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    expect(canvasElement.getByText('Nouveau site')).toBeInTheDocument();
  },
};

export const DisablesCodeInEditMode = {
  args: {
    site: mockSite,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    const codeInput = canvasElement.getByDisplayValue('POUPET');
    expect(codeInput).toBeDisabled();
    expect(canvasElement.getByText(/Le code ne peut pas être modifié/)).toBeInTheDocument();
  },
};

export const AllowsCodeInCreateMode = {
  args: {
    site: null,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    const user = userEvent.setup();

    const codeInput = canvasElement.getByLabelText('Code');
    expect(codeInput).not.toBeDisabled();

    await user.type(codeInput, 'NEWCODE');
    expect(canvasElement.getByDisplayValue('NEWCODE')).toBeInTheDocument();
  },
};

export const EditsNameField = {
  args: {
    site: mockSite,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    const user = userEvent.setup();

    const nameInput = canvasElement.getByDisplayValue('Mont Poupet');
    await user.clear(nameInput);
    await user.type(nameInput, 'Nouveau Nom');

    expect(canvasElement.getByDisplayValue('Nouveau Nom')).toBeInTheDocument();
  },
};

export const SelectsUsageType = {
  args: {
    site: mockSite,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    const user = userEvent.setup();

    const takeoffRadio = canvasElement.getByLabelText('Décollage uniquement');
    await user.click(takeoffRadio);

    expect(takeoffRadio).toBeChecked();
  },
};

export const ChangesOrientation = {
  args: {
    site: mockSite,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    const user = userEvent.setup();

    const orientationSelect = canvasElement.getByLabelText('Orientation');
    await user.selectOptions(orientationSelect, 'S');

    expect(canvasElement.getByDisplayValue('Sud (S)')).toBeInTheDocument();
  },
};

export const AdjustsCameraAngle = {
  args: {
    site: mockSite,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    const user = userEvent.setup();

    const angleSlider = canvasElement.getByLabelText(/Angle: 180°/);
    await user.type(angleSlider, '90');

    await waitFor(() => {
      expect(canvasElement.getByText(/Angle: /)).toBeInTheDocument();
    });
  },
};

export const CallsOnCloseWhenCancelled = {
  args: {
    site: mockSite,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
  test: async ({ args, canvas }: { args: any; canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    const user = userEvent.setup();

    const cancelButton = canvasElement.getByText('Annuler');
    await user.click(cancelButton);

    expect(args.onClose).toHaveBeenCalled();
  },
};

export const ValidatesRequiredFields = {
  args: {
    site: null,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    const user = userEvent.setup();

    const saveButton = canvasElement.getByText('💾 Enregistrer');
    await user.click(saveButton);

    await waitFor(() => {
      expect(canvasElement.getByText(/Le nom doit contenir au moins 2 caractères/)).toBeInTheDocument();
    });
  },
};

export const SavesSuccessfully = {
  args: {
    site: mockSite,
    isOpen: true,
    onClose: fn(),
    onSave: fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    }),
  },
  test: async ({ args, canvas }: { args: any; canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    const user = userEvent.setup();

    const nameInput = canvasElement.getByDisplayValue('Mont Poupet');
    await user.clear(nameInput);
    await user.type(nameInput, 'Nouveau Nom');

    const saveButton = canvasElement.getByText('💾 Enregistrer');
    await user.click(saveButton);

    await waitFor(() => {
      expect(args.onSave).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(args.onClose).toHaveBeenCalled();
    });
  },
};

export const ShowsSavingState = {
  args: {
    site: mockSite,
    isOpen: true,
    onClose: fn(),
    onSave: fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    }),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    const user = userEvent.setup();

    const saveButton = canvasElement.getByText('💾 Enregistrer');
    await user.click(saveButton);

    await waitFor(() => {
      expect(canvasElement.getByText('⏳ Enregistrement...')).toBeInTheDocument();
    });
  },
};
