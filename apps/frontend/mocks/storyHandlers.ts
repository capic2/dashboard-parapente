// Reusable MSW handlers for Storybook stories
//
// Usage:
// import { getDefaultHandlers } from '../../../mocks/storyHandlers';
//
// export const MyStory = {
//   parameters: {
//     msw: {
//       handlers: getDefaultHandlers(),
//     },
//   },
// };

import { handlers } from './handlers';

export function getDefaultHandlers() {
  return handlers;
}
