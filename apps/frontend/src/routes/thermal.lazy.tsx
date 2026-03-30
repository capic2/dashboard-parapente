import { createLazyFileRoute } from '@tanstack/react-router';
import ThermalAnalysis from '../pages/ThermalAnalysis';

export const Route = createLazyFileRoute('/thermal')({
  component: ThermalAnalysis,
});
