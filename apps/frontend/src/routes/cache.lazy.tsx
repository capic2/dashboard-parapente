import { createLazyFileRoute } from '@tanstack/react-router';
import CacheViewer from '../pages/CacheViewer';

export const Route = createLazyFileRoute('/cache')({
  component: CacheViewer,
});
