import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export interface AppSettings {
  cache_ttl_default: string;
  cache_ttl_summary: string;
  spotair_live_wind_radius_km: string;
  spotair_live_wind_cache_ttl_seconds: string;
  scheduler_interval_minutes: string;
  redis_connect_timeout: string;
  redis_socket_timeout: string;
  para_wind_very_low_max: string;
  para_wind_low_max: string;
  para_wind_weak_max: string;
  para_wind_optimal_max: string;
  para_wind_high_max: string;
  para_gust_low_max: string;
  para_gust_moderate_max: string;
  para_gust_high_max: string;
  para_precip_none_max: string;
  para_precip_light_max: string;
  para_precip_heavy_min: string;
  para_slot_precipitation_max: string;
  para_li_stable_min: string;
  para_li_slightly_unstable_min: string;
  para_li_very_unstable_max: string;
  para_temp_cool_min: string;
  para_temp_warm_min: string;
  para_verdict_good_min: string;
  para_verdict_medium_min: string;
  para_verdict_limit_min: string;
  ui_reason_wind_very_strong_min: string;
  ui_reason_gust_high_min: string;
  ui_reason_cloud_very_cloudy_min: string;
  ui_reason_wind_moderate_min: string;
}

export function useAppSettings() {
  return useQuery<AppSettings>({
    queryKey: ['app-settings'],
    queryFn: () => api.get('settings').json<AppSettings>(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useUpdateAppSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Partial<Record<keyof AppSettings, string>>) =>
      api.put('settings', { json: settings }).json(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['weather'] });
      void queryClient.invalidateQueries({ queryKey: ['bestSpot'] });
      void queryClient.invalidateQueries({ queryKey: ['live-wind'] });
      void queryClient.invalidateQueries({ queryKey: ['landings-weather'] });
    },
  });
}
