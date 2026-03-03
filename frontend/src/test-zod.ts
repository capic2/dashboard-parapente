/**
 * Script de test pour valider les schémas Zod
 * Usage: node --loader ts-node/esm test-zod.ts
 */

import { SiteSchema, SitesApiResponseSchema } from './schemas';

// Test data from backend
const testSite1 = {
  code: "arguel",
  name: "Arguel",
  elevation_m: 462,
  latitude: 47.1944,
  longitude: 5.9896,
  region: "Besançon",
  country: "FR",
  id: "site-arguel",
  rating: 3,
  orientation: "NNW",
  linked_spot_id: "merged_884e0213d9116315",
  created_at: "2026-03-01T11:56:26.544046",
  updated_at: "2026-03-01T16:52:32.618626"
};

const testSite2 = {
  code: "mont-poupet-nord",
  name: "Mont Poupet Nord",
  elevation_m: 795,
  latitude: 46.9716,
  longitude: 5.8776,
  region: null,
  country: null,
  id: "site-mont-poupet-nord",
  rating: 4,
  orientation: "N",
  linked_spot_id: "merged_d370be468747c90a",
  created_at: null,
  updated_at: null
};

console.log('=== Test SiteSchema ===');

console.log('\n1. Testing site with all fields (Arguel)...');
const result1 = SiteSchema.safeParse(testSite1);
if (result1.success) {
  console.log('✅ Validation passed');
} else {
  console.log('❌ Validation failed:', result1.error);
}

console.log('\n2. Testing site with NULL fields (Mont Poupet Nord)...');
const result2 = SiteSchema.safeParse(testSite2);
if (result2.success) {
  console.log('✅ Validation passed');
} else {
  console.log('❌ Validation failed:', result2.error);
}

console.log('\n3. Testing SitesApiResponseSchema...');
const result3 = SitesApiResponseSchema.safeParse({
  sites: [testSite1, testSite2]
});
if (result3.success) {
  console.log('✅ Validation passed');
  console.log(`   Validated ${result3.data.sites.length} sites`);
} else {
  console.log('❌ Validation failed:', result3.error);
}
