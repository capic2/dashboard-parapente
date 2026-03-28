// Reusable MSW handlers for Storybook stories
// Handlers can be used as object (for selective override) or array (all handlers)
//
// Usage Option 1: Use all default handlers
// import { defaultHandlers } from '../../../mocks/storyHandlers';
//
// export const MyStory = {
//   parameters: {
//     msw: {
//       handlers: defaultHandlers, // Object or array, both work!
//     },
//   },
// };
//
// Usage Option 2: Override specific handlers (if MSW supports objects)
// import { defaultHandlers } from '../../../mocks/storyHandlers';
// import { http, HttpResponse } from 'msw';
//
// export const MyStory = {
//   parameters: {
//     msw: {
//       handlers: {
//         ...defaultHandlers,
//         weatherGet: http.get('/api/weather/:spotId', () => 
//           HttpResponse.json(customData)
//         ),
//       },
//     },
//   },
// };

import { handlers } from './handlers';

// Export as function for backward compatibility
export function getDefaultHandlers() {
  return handlers;
}
