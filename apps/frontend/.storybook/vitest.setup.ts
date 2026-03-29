import { beforeAll } from 'vitest';
import preview from './preview';

// Just call Storybook's beforeAll - msw-storybook-addon should handle MSW initialization
beforeAll(preview.composed.beforeAll);
