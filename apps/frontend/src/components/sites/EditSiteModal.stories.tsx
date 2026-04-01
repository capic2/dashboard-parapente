import {http, HttpResponse} from 'msw';
import preview from '../../../.storybook/preview';
import {expect, fn} from 'storybook/test';
import {EditSiteModal} from './EditSiteModal';
import type {Site} from '@dashboard-parapente/shared-types';

const meta = preview.meta({
  title: 'Components/Forms/EditSiteModal',
  component: EditSiteModal,
  parameters: {
    layout: 'centered',
    msw: {
      handlers: [
        http.get('*/api/sites/:siteId/landings', () => HttpResponse.json([])),
        http.get('*/api/spots', () => HttpResponse.json({ sites: [] })),
      ],
    },
  },
  tags: ['autodocs'],
});



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
export const Closed = meta.story({
  name: 'Closed',
  args: {
    site: null,
    isOpen: false,
    onClose: fn(),
    onSave: fn(),
  },
});

// Edit mode - open
export const EditMode = meta.story({
  name: 'Edit Mode',
  args: {
    site: mockSite,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
});

// Create mode - open
export const CreateMode = meta.story({
  name: 'Create Mode',
  args: {
    site: null,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
});

// Edit with minimal data
export const EditMinimalData = meta.story({
  name: 'Edit Minimal Data',
  args: {
    site: mockSiteMinimal,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
});

// Takeoff only
export const TakeoffOnly = meta.story({
  name: 'Takeoff Only',
  args: {
    site: { ...mockSite, usage_type: 'takeoff' },
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
});

// Landing only
export const LandingOnly = meta.story({
  name: 'Landing Only',
  args: {
    site: { ...mockSite, usage_type: 'landing' },
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
});

// Different orientation
export const OrientationSouth = meta.story({
  name: 'Orientation South',
  args: {
    site: { ...mockSite, orientation: 'S' },
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
});

// Different country
export const CountrySwitzerland = meta.story({
  name: 'Country Switzerland',
  args: {
    site: { ...mockSite, country: 'CH' },
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
});

// Custom camera settings
export const CustomCameraSettings = meta.story({
  name: 'Custom Camera Settings',
  args: {
    site: { ...mockSite, camera_angle: 90, camera_distance: 1500 },
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
});

// Saving state
export const SavingState = meta.story({
  name: 'Saving State',
  args: {
    site: mockSite,
    isOpen: true,
    onClose: fn(),
    onSave: fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }),
  },
});

SavingState.test('interaction test', async ({ canvas, userEvent }) => {
  const saveButton = canvas.getByText('💾 Enregistrer');
  await userEvent.click(saveButton);
});

// Interaction Tests

export const DisplaysSiteData = meta.story({
  name: 'Displays Site Data',
  args: {
    site: mockSite,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
});

export const ShowsCreateModeTitle = meta.story({
  name: 'Shows Create Mode Title',
  args: {
    site: null,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
});

ShowsCreateModeTitle.test('shows create mode title', async ({ canvas }) => {
  await expect(canvas.getByText('Nouveau site')).toBeInTheDocument();
});

export const DisablesCodeInEditMode = meta.story({
  name: 'Disables Code In Edit Mode',
  args: {
    site: mockSite,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
});

/*
DisablesCodeInEditMode.test(
  'disables code field in edit mode',
  async ({ canvas }) => {
    const codeInput = canvas.getByDisplayValue('POUPET');
    await expect(codeInput).toBeDisabled();
    await expect(
      canvas.getByText(/Le code ne peut pas être modifié/)
    ).toBeInTheDocument();
  }
);
*/

/*
export const AllowsCodeInCreateMode = meta.story({
  name: 'Allows Code In Create Mode',
  args: {
    site: null,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
});

AllowsCodeInCreateMode.test('allows code input in create mode', async ({ canvas, userEvent }) => {
  const codeInput = canvas.getByLabelText('Code');
  await expect(codeInput).not.toBeDisabled();

  await userEvent.type(codeInput, 'NEWCODE');
  await expect(canvas.getByDisplayValue('NEWCODE')).toBeInTheDocument();
});
*/

export const EditsNameField = meta.story({
  name: 'Edits Name Field',
  args: {
    site: mockSite,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
});

export const SelectsUsageType = meta.story({
  name: 'Selects Usage Type',
  args: {
    site: mockSite,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
});

SelectsUsageType.test('selects usage type', async ({ canvas, userEvent }) => {
  const takeoffRadio = canvas.getByLabelText('Décollage uniquement');
  await userEvent.click(takeoffRadio);

  await expect(takeoffRadio).toBeChecked();
});

/*
export const ChangesOrientation = meta.story({
  name: 'Changes Orientation',
  args: {
    site: mockSite,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
});

ChangesOrientation.test('changes orientation', async ({ canvas,userEvent }) => {
  const orientationSelect = canvas.getByLabelText('Orientation');
  await userEvent.selectOptions(orientationSelect, 'S');

  await expect(canvas.getByDisplayValue('Sud (S)')).toBeInTheDocument();
});
*/

/*
export const AdjustsCameraAngle = meta.story({
  name: 'Adjusts Camera Angle',
  args: {
    site: mockSite,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
});

AdjustsCameraAngle.test('adjusts camera angle', async ({ canvas,userEvent }) => {
  const angleSlider = canvas.getByLabelText(/Angle: 180°/);
  await userEvent.type(angleSlider, '90');

  await waitFor(() => {
    expect(canvas.getByText(/Angle: /)).toBeInTheDocument();
  });
});
*/

export const CallsOnCloseWhenCancelled = meta.story({
  name: 'Calls On Close When Cancelled',
  args: {
    site: mockSite,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
});

CallsOnCloseWhenCancelled.test(
  'calls onClose when cancelled',
  async ({ args, canvas, userEvent }) => {
    const cancelButton = canvas.getByText('Annuler');
    await userEvent.click(cancelButton);

    await expect(args.onClose).toHaveBeenCalled();
  }
);

/*
export const ValidatesRequiredFields = meta.story({
  name: 'Validates Required Fields',
  args: {
    site: null,
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
  },
});

ValidatesRequiredFields.test('validates required fields', async ({ canvas }) => {
  const user = userEvent.setup();

  const saveButton = canvas.getByText('💾 Enregistrer');
  await userEvent.click(saveButton);

  await waitFor(() => {
    expect(canvas.getByText(/Le nom doit contenir au moins 2 caractères/)).toBeInTheDocument();
  });
});
*/

export const SavesSuccessfully = meta.story({
  name: 'Saves Successfully',
  args: {
    site: mockSite,
    isOpen: true,
    onClose: fn(),
    onSave: fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }),
  },
});

/*SavesSuccessfully.test(
  'saves successfully and closes',
  async ({ args, canvas, userEvent }) => {
    const nameInput = canvas.getByDisplayValue('Mont Poupet');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Nouveau Nom');

    const saveButton = canvas.getByText('💾 Enregistrer');
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(args.onSave).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(args.onClose).toHaveBeenCalled();
    });
  }
);*/

export const ShowsSavingState = meta.story({
  name: 'Shows Saving State',
  args: {
    site: mockSite,
    isOpen: true,
    onClose: fn(),
    onSave: fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }),
  },
});

/*
ShowsSavingState.test('shows saving state', async ({ canvas, userEvent }) => {
  const saveButton = canvas.getByText('💾 Enregistrer');
  await userEvent.click(saveButton);

  await waitFor(() => {
    expect(canvas.getByText('⏳ Enregistrement...')).toBeInTheDocument();
  });
});
*/
