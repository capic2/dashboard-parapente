import { beforeAll } from 'vitest';
import preview from './preview';
import { getWorker } from 'msw-storybook-addon';
import { overrideApi } from '../src/lib/api';
import { http, HttpResponse } from 'msw';

beforeAll(async () => {
  overrideApi({ retry: 0, logs: false });
  await preview.composed.beforeAll();
  const worker = getWorker();
  //await worker.context.activationPromise;
  // Mock Cesium terrain heights file so 3D stories/tests avoid network JSON errors.
  worker.use(
    http.get(/approximateTerrainHeights\.json(?:\?.*)?$/, () =>
      HttpResponse.json({})
    )
  );
});
