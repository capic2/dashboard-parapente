import { createFileRoute } from '@tanstack/react-router';
import ThermalAnalysis from '../pages/ThermalAnalysis';

export const Route = createFileRoute('/thermal')({
  component: ThermalAnalysis,
});
