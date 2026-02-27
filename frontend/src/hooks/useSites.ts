import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { SitesApiResponseSchema, SiteSchema } from '../schemas';

interface Site {
  id: string;
  name: string;
  location: string;
  altitude: number;
  coordinates: {
    lat: number;
    lng: number;
  };
  orientation: string[];
  difficulty: 'debutant' | 'intermediaire' | 'avance';
  description?: string;
  conditions?: string;
  takeoff_coordinates?: {
    lat: number;
    lng: number;
  };
  landing_coordinates?: {
    lat: number;
    lng: number;
  };
}

const API_BASE_URL = '/api';

export const useSites = () => {
  return useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE_URL}/spots`);
      console.log('📍 Sites response:', data);
      
      // Validate API response with Zod
      const validation = SitesApiResponseSchema.safeParse(data);
      if (!validation.success) {
        console.error('❌ Sites validation failed:', validation.error);
        throw new Error(`Invalid sites data: ${validation.error.message}`);
      }
      
      return validation.data.sites as any; // Extract validated sites array
    },
    staleTime: 1000 * 60 * 30, // 30 minutes - sites don't change often
  });
};

export const useSite = (siteId: string) => {
  return useQuery<Site>({
    queryKey: ['site', siteId],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE_URL}/spots/${siteId}`);
      
      // Validate API response with Zod
      const validation = SiteSchema.safeParse(data);
      if (!validation.success) {
        console.error('❌ Site validation failed:', validation.error);
        throw new Error(`Invalid site data: ${validation.error.message}`);
      }
      
      return validation.data as any;
    },
    enabled: !!siteId,
    staleTime: 1000 * 60 * 30,
  });
};

export const useNearbySites = (lat: number, lng: number, radius = 50) => {
  return useQuery<Site[]>({
    queryKey: ['sites', 'nearby', lat, lng, radius],
    queryFn: async () => {
      const { data } = await axios.get(
        `${API_BASE_URL}/spots/nearby?lat=${lat}&lng=${lng}&radius=${radius}`
      );
      
      // Validate API response with Zod
      const validation = SiteSchema.array().safeParse(data);
      if (!validation.success) {
        console.error('❌ Nearby sites validation failed:', validation.error);
        throw new Error(`Invalid nearby sites data: ${validation.error.message}`);
      }
      
      return validation.data as any;
    },
    enabled: !!lat && !!lng,
  });
};
