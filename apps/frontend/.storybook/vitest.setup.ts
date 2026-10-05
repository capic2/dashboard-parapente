import { beforeAll } from 'vitest';
import { overrideApi } from '../src/lib/api';

beforeAll(async () => {
  overrideApi({ retry: 0, logs: false });
});
