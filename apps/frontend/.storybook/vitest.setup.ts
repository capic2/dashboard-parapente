import { beforeAll, vi } from 'vitest';
import preview from './preview';
import { getWorker } from 'msw-storybook-addon';
import { overrideApi } from '../src/lib/api';

vi.mock('../src/components/flights/FlightViewer3D', () => ({
  FlightViewer3D: () => null,
}));

beforeAll(async () => {
  overrideApi({ retry: 0, logs: false });
  await preview.composed.beforeAll();
  await getWorker().context.activationPromise;
});
