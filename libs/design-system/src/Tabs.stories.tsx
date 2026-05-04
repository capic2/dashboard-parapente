import preview from '../.storybook/preview';
import { expect } from 'storybook/test';
import { Tab, TabList, TabPanel, Tabs } from './Tabs';

const meta = preview.meta({
  title: 'Components/UI/Tabs',
  component: Tabs,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Accessible tabs built on react-aria-components with a visible selected state and dark mode support.',
      },
    },
  },
  tags: ['autodocs'],
});

export const Default = meta.story({
  render: () => (
    <div className="w-[min(36rem,calc(100vw-2rem))]">
      <Tabs defaultSelectedKey="weather">
        <TabList className="grid-cols-3">
          <Tab id="general">General</Tab>
          <Tab id="weather">Weather</Tab>
          <Tab id="data">Data</Tab>
        </TabList>
        <TabPanel id="general" className="rounded-xl bg-white p-4 shadow-md">
          General settings
        </TabPanel>
        <TabPanel id="weather" className="rounded-xl bg-white p-4 shadow-md">
          Weather sources
        </TabPanel>
        <TabPanel id="data" className="rounded-xl bg-white p-4 shadow-md">
          Data management
        </TabPanel>
      </Tabs>
    </div>
  ),
});

Default.test('shows selected tab state', async ({ canvas }) => {
  const selectedTab = canvas.getByRole('tab', { name: 'Weather' });
  const unselectedTab = canvas.getByRole('tab', { name: 'General' });

  await expect(selectedTab).toHaveAttribute('data-selected');
  await expect(unselectedTab).not.toHaveAttribute('data-selected');
  expect(getComputedStyle(selectedTab).backgroundColor).not.toBe(
    getComputedStyle(unselectedTab).backgroundColor
  );
});

export const Responsive = meta.story({
  render: () => (
    <div className="w-[min(36rem,calc(100vw-2rem))]">
      <Tabs defaultSelectedKey="sites">
        <TabList className="grid-cols-2 sm:flex">
          <Tab id="general">General</Tab>
          <Tab id="sites">Sites</Tab>
          <Tab id="weather">Weather</Tab>
          <Tab id="data">Data</Tab>
        </TabList>
        <TabPanel id="general">General settings</TabPanel>
        <TabPanel id="sites">Favorite sites</TabPanel>
        <TabPanel id="weather">Weather sources</TabPanel>
        <TabPanel id="data">Data management</TabPanel>
      </Tabs>
    </div>
  ),
});
