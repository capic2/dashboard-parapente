import { createLazyFileRoute } from '@tanstack/react-router';
import WeatherPage from '../pages/WeatherPage';

export const Route = createLazyFileRoute('/weather')({
  component: WeatherPage,
});
