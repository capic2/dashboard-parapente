// Reusable MSW handlers for Storybook stories
//
// Usage in stories:
//
// import { getDefaultHandlers } from '../../../mocks/storyHandlers';
//
// export const MyStory = {
//   parameters: {
//     msw: {
//       handlers: getDefaultHandlers(),
//     },
//   },
// };
//
// Or with overrides:
//
// import { getDefaultHandlers } from '../../../mocks/storyHandlers';
// import { http, HttpResponse } from 'msw';
//
// export const MyStory = {
//   parameters: {
//     msw: {
//       handlers: [
//         ...getDefaultHandlers(),
//         http.get('*/api/weather/:spotId', () => HttpResponse.json(customData)),
//       ],
//     },
//   },
// };

import { handlers } from './handlers';

// Get all default MSW handlers
// These handlers use the wildcard pattern to work in both dev and Vitest browser mode
export function getDefaultHandlers() {
  return handlers;
}
