import { beforeAll } from 'vitest';
import preview from './preview';
import { getWorker } from 'msw-storybook-addon';

beforeAll(async () => {
  await preview.composed.beforeAll();
  await getWorker().context.activationPromise;
});
