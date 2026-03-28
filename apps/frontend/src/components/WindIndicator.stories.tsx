import preview from '../../.storybook/preview';
import { WindIndicator, WindIndicatorCompact } from './WindIndicator';

const meta = preview.meta({
  title: 'Components/WindIndicator',
  component: WindIndicator,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Wind indicator component that shows visual feedback (🟢/🟡/🔴) based on wind favorability for a specific takeoff orientation.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    windDirection: {
      control: 'text',
      description: 'Wind direction (e.g., N, NE, E, SE, S, SW, W, NW)',
    },
    siteOrientation: {
      control: 'text',
      description:
        'Takeoff site orientation (e.g., N, NE, E, SE, S, SW, W, NW)',
    },
    windSpeed: {
      control: 'number',
      description: 'Wind speed in km/h',
    },
    showLabel: {
      control: 'boolean',
      description: 'Show text label and wind details',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Component size',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
});

/**
 * Perfect conditions: Wind direction matches site orientation exactly
 */
export const Perfect = meta.story({
  name: 'Perfect Conditions',
  args: {
    windDirection: 'N',
    siteOrientation: 'N',
    windSpeed: 15,
    showLabel: true,
    size: 'md',
  },
});

/**
 * Good conditions: Wind direction is close to site orientation
 */
export const Good = meta.story({
  name: 'Good Conditions',
  args: {
    windDirection: 'NE',
    siteOrientation: 'N',
    windSpeed: 12,
    showLabel: true,
    size: 'md',
  },
});

/**
 * Acceptable conditions: Wind direction is acceptable but not ideal
 */
export const Acceptable = meta.story({
  name: 'Acceptable Conditions',
  args: {
    windDirection: 'E',
    siteOrientation: 'N',
    windSpeed: 10,
    showLabel: true,
    size: 'md',
  },
});

/**
 * Unfavorable conditions: Wind direction is not suitable
 */
export const Unfavorable = meta.story({
  name: 'Unfavorable Conditions',
  args: {
    windDirection: 'S',
    siteOrientation: 'N',
    windSpeed: 20,
    showLabel: true,
    size: 'md',
  },
});

/**
 * Wind too strong: Even with good direction, wind is too strong
 */
export const TooStrong = meta.story({
  name: 'Wind Too Strong',
  args: {
    windDirection: 'N',
    siteOrientation: 'N',
    windSpeed: 35,
    showLabel: true,
    size: 'md',
  },
});

/**
 * Wind too weak: Wind speed is too low for safe flying
 */
export const TooWeak = meta.story({
  name: 'Wind Too Weak',
  args: {
    windDirection: 'N',
    siteOrientation: 'N',
    windSpeed: 3,
    showLabel: true,
    size: 'md',
  },
});

/**
 * No wind data available
 */
export const NoData = meta.story({
  name: 'No Wind Data',
  args: {
    windDirection: undefined,
    siteOrientation: 'N',
    windSpeed: undefined,
    showLabel: true,
    size: 'md',
  },
});

/**
 * Without label: Only showing the emoji indicator
 */
export const WithoutLabel = meta.story({
  name: 'Without Label',
  args: {
    windDirection: 'N',
    siteOrientation: 'N',
    windSpeed: 15,
    showLabel: false,
    size: 'md',
  },
});

/**
 * Small size variant
 */
export const SmallSize = meta.story({
  name: 'Small Size',
  args: {
    windDirection: 'NE',
    siteOrientation: 'N',
    windSpeed: 12,
    showLabel: true,
    size: 'sm',
  },
});

/**
 * Large size variant
 */
export const LargeSize = meta.story({
  name: 'Large Size',
  args: {
    windDirection: 'N',
    siteOrientation: 'N',
    windSpeed: 15,
    showLabel: true,
    size: 'lg',
  },
});

/**
 * All states comparison: Shows different wind favorability states
 */
export const AllStates = meta.story({
  name: 'All States Comparison',
  render: () => (
    <div className="flex flex-col gap-4 p-4">
      <WindIndicator
        windDirection="N"
        siteOrientation="N"
        windSpeed={15}
        showLabel={true}
      />
      <WindIndicator
        windDirection="NE"
        siteOrientation="N"
        windSpeed={12}
        showLabel={true}
      />
      <WindIndicator
        windDirection="E"
        siteOrientation="N"
        windSpeed={10}
        showLabel={true}
      />
      <WindIndicator
        windDirection="S"
        siteOrientation="N"
        windSpeed={20}
        showLabel={true}
      />
      <WindIndicator
        windDirection="N"
        siteOrientation="N"
        windSpeed={35}
        showLabel={true}
      />
      <WindIndicator
        windDirection={undefined}
        siteOrientation="N"
        windSpeed={undefined}
        showLabel={true}
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Comparison of all possible wind favorability states',
      },
    },
  },
});

/**
 * Compact version showing only emoji with tooltip
 */
export const Compact = meta.story({
  name: 'Compact Version',
  render: (args) => <WindIndicatorCompact {...args} />,
  args: {
    windDirection: 'N',
    siteOrientation: 'N',
    windSpeed: 15,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Compact version showing only emoji with tooltip (hover to see details)',
      },
    },
  },
});

/**
 * All compact states: Shows all favorability states in compact mode
 */
export const AllCompactStates = meta.story({
  name: 'All Compact States',
  render: () => (
    <div className="flex gap-4 p-4">
      <WindIndicatorCompact
        windDirection="N"
        siteOrientation="N"
        windSpeed={15}
      />
      <WindIndicatorCompact
        windDirection="NE"
        siteOrientation="N"
        windSpeed={12}
      />
      <WindIndicatorCompact
        windDirection="E"
        siteOrientation="N"
        windSpeed={10}
      />
      <WindIndicatorCompact
        windDirection="S"
        siteOrientation="N"
        windSpeed={20}
      />
      <WindIndicatorCompact
        windDirection="N"
        siteOrientation="N"
        windSpeed={35}
      />
      <WindIndicatorCompact
        windDirection={undefined}
        siteOrientation="N"
        windSpeed={undefined}
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'All favorability states in compact mode (hover each to see tooltip)',
      },
    },
  },
});
