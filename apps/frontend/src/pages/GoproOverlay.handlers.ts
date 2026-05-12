import { http, HttpResponse } from 'msw';

const layouts = [
  {
    id: 'parapente-1080',
    label: 'Parapente 1920x1080',
    path: '/media/usb/data-m2/developement/gopro-overlay-dasboard/layout_parapente_1080.xml',
    width: 1920,
    height: 1080,
    exists: true,
    recommended: true,
  },
  {
    id: 'parapente-3840',
    label: 'Parapente 3840x2160',
    path: '/media/usb/data-m2/developement/gopro-overlay-dasboard/layout_parapente_3840.xml',
    width: 3840,
    height: 2160,
    exists: true,
    recommended: false,
  },
  {
    id: 'parapente-7680',
    label: 'Parapente 7680x4320',
    path: '/media/usb/data-m2/developement/gopro-overlay-dasboard/layout_parapente_7680.xml',
    width: 7680,
    height: 4320,
    exists: true,
    recommended: false,
  },
];

const missingLayouts = layouts.map((layout) =>
  Object.assign({}, layout, { exists: false })
);

export const goproOverlayHandlers = [
  http.get('*/api/gopro-overlays/layouts', () =>
    HttpResponse.json({ layouts })
  ),
  http.post('*/api/gopro-overlays/jobs', async ({ request }) => {
    const formData = await request.formData();
    const layoutId = String(formData.get('layout_id') || 'parapente-1080');
    const layout = layouts.find((item) => item.id === layoutId) || layouts[0];

    return HttpResponse.json({
      job_id: 'job-gopro-story',
      status: 'queued',
      progress: 0,
      message: 'Overlay queued',
      layout_id: layout.id,
      layout_label: layout.label,
      output_filename: 'arguel-overlay.mp4',
      video_width: layout.width,
      video_height: layout.height,
      created_at: '2026-05-12T12:00:00Z',
      updated_at: '2026-05-12T12:00:00Z',
    });
  }),
];

export const missingGoproOverlayLayoutsHandlers = [
  http.get('*/api/gopro-overlays/layouts', () =>
    HttpResponse.json({ layouts: missingLayouts })
  ),
];
