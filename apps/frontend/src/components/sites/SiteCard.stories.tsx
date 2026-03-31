import preview from '../../../.storybook/preview';
import { fn, userEvent, within, expect } from 'storybook/test';
import { SiteCard } from './SiteCard';

const meta = preview.meta({
  title: 'Components/SiteCard',
  component: SiteCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Card component for displaying paragliding site information including location, orientation, elevation, and flight count. Supports different usage types (takeoff, landing, both).',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    site: {
      description: 'Site object with all information',
    },
    flightCount: {
      control: 'number',
      description: 'Number of flights at this site',
    },
    onEdit: {
      action: 'edit-clicked',
      description: 'Callback when edit button is clicked',
    },
    onDelete: {
      action: 'delete-clicked',
      description: 'Callback when delete button is clicked',
    },
    onViewFlights: {
      action: 'view-flights-clicked',
      description: 'Callback when view flights button is clicked',
    },
  },
});

const mockSiteArguel = {
  id: 'site-arguel',
  name: 'Arguel',
  code: 'ARG',
  latitude: 47.2,
  longitude: 6.0,
  elevation_m: 427,
  orientation: 'N,NE,NW',
  region: 'Doubs',
  country: 'FR',
  camera_distance: null,
  flight_count: 0,
  usage_type: 'both' as const,
  description: "Site principal de Besançon, accessible toute l'année",
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// Default site card
export const Default = meta.story({
  args: {
    site: mockSiteArguel,
    flightCount: 15,
    onEdit: fn(),
    onDelete: fn(),
    onViewFlights: fn(),
  },
});

// Test interactions
Default.test(
  'should call callbacks when buttons clicked',
  async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Click edit button
    await userEvent.click(canvas.getByText(/Éditer/i));
    await expect(args.onEdit).toHaveBeenCalledWith(mockSiteArguel);

    // Click view flights button
    await userEvent.click(canvas.getByRole('button', { name: /Vols/i }));
    await expect(args.onViewFlights).toHaveBeenCalledWith(mockSiteArguel);
  }
);

// Takeoff only site
export const TakeoffOnly = meta.story({
  name: 'Usage: Takeoff Only',
  args: {
    site: {
      ...mockSiteArguel,
      id: 'mont-poupet',
      name: 'Mont Poupet',
      code: 'MPT',
      usage_type: 'takeoff' as const,
      elevation_m: 842,
    },
    flightCount: 8,
    onEdit: fn(),
    onDelete: fn(),
    onViewFlights: fn(),
  },
});

// Landing only site
export const LandingOnly = meta.story({
  name: 'Usage: Landing Only',
  args: {
    site: {
      ...mockSiteArguel,
      id: 'landing-besancon',
      name: 'Atterrissage Besançon',
      usage_type: 'landing' as const,
      orientation: 'ALL',
      description: undefined,
    },
    flightCount: 42,
    onEdit: fn(),
    onDelete: fn(),
    onViewFlights: fn(),
  },
});

// Site with no flights
export const NoFlights = meta.story({
  name: 'No Flights',
  args: {
    site: mockSiteArguel,
    flightCount: 0,
    onEdit: fn(),
    onDelete: fn(),
    onViewFlights: fn(),
  },
});

// Site without description
export const NoDescription = meta.story({
  name: 'No Description',
  args: {
    site: {
      ...mockSiteArguel,
      description: undefined,
    },
    flightCount: 5,
    onEdit: fn(),
    onDelete: fn(),
    onViewFlights: fn(),
  },
});

// Site without code
export const NoCode = meta.story({
  name: 'No Code',
  args: {
    site: {
      ...mockSiteArguel,
      code: null,
    },
    flightCount: 3,
    onEdit: fn(),
    onDelete: fn(),
    onViewFlights: fn(),
  },
});

// Long description truncated
export const LongDescription = meta.story({
  name: 'Long Description',
  args: {
    site: {
      ...mockSiteArguel,
      description:
        'Ceci est une très longue description qui devrait être tronquée après 80 caractères pour maintenir une mise en page propre et lisible dans la carte du site.',
    },
    flightCount: 12,
    onEdit: fn(),
    onDelete: fn(),
    onViewFlights: fn(),
  },
});

// Multiple orientations
export const MultipleOrientations = meta.story({
  name: 'Multiple Orientations',
  args: {
    site: {
      ...mockSiteArguel,
      orientation: 'N,NE,E,SE,S',
    },
    flightCount: 28,
    onEdit: fn(),
    onDelete: fn(),
    onViewFlights: fn(),
  },
});

// Grid of site cards
export const GridView = meta.story({
  name: 'Grid View',
  render: () => (
    <div className="grid grid-cols-3 gap-4">
      <SiteCard
        site={{ ...mockSiteArguel }}
        flightCount={15}
        onEdit={fn()}
        onDelete={fn()}
        onViewFlights={fn()}
      />
      <SiteCard
        site={{
          ...mockSiteArguel,
          id: '2',
          name: 'Mont Poupet',
          usage_type: 'takeoff',
          elevation_m: 842,
        }}
        flightCount={8}
        onEdit={fn()}
        onDelete={fn()}
        onViewFlights={fn()}
      />
      <SiteCard
        site={{
          ...mockSiteArguel,
          id: '3',
          name: 'La Côte',
          usage_type: 'landing',
        }}
        flightCount={0}
        onEdit={fn()}
        onDelete={fn()}
        onViewFlights={fn()}
      />
    </div>
  ),
});
