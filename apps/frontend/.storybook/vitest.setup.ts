import { beforeAll } from 'vitest';
import preview from './preview';
import { getWorker } from 'msw-storybook-addon';
import { overrideApi } from '../src/lib/api';

beforeAll(async () => {
  overrideApi({ retry: 0 });
  await preview.composed.beforeAll();
  await getWorker().context.activationPromise;
});
