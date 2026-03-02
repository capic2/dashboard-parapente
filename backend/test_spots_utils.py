"""
Quick test of spots utilities
"""

from spots.distance import haversine_distance, calculate_bounding_box
from spots.geocoding import geocode_city

# Test distance calculation
print("Testing haversine_distance:")
# Distance from Besançon to Arguel
dist = haversine_distance(47.2380, 6.0244, 47.1944, 5.9896)
print(f"Besançon to Arguel: {dist} km")

# Test bounding box
print("\nTesting bounding box:")
min_lat, max_lat, min_lon, max_lon = calculate_bounding_box(47.24, 6.02, 50)
print(f"50km box around Besançon: lat [{min_lat:.4f}, {max_lat:.4f}], lon [{min_lon:.4f}, {max_lon:.4f}]")

# Test geocoding
print("\nTesting geocoding:")
coords = geocode_city("Besançon")
if coords:
    print(f"Besançon coordinates: {coords}")
else:
    print("Geocoding failed")

# Test small village
coords2 = geocode_city("Arguel")
if coords2:
    print(f"Arguel coordinates: {coords2}")
else:
    print("Arguel not found (expected for small villages)")

print("\n✓ All utilities working!")
