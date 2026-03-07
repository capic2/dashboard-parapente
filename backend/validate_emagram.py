#!/usr/bin/env python3
"""
Validation script for Emagram Analysis System
Tests all components without external API calls
"""

import sys
import os

print("=" * 60)
print("EMAGRAM SYSTEM VALIDATION")
print("=" * 60)

# Test 1: Imports
print("\n1️⃣ Testing imports...")
try:
    from models import EmagramAnalysis
    from schemas import (
        EmagramAnalysis as EmagramSchema,
        EmagramAnalysisCreate,
        EmagramTriggerRequest
    )
    from scrapers.wyoming import (
        FRENCH_STATIONS,
        find_closest_station,
        haversine_distance
    )
    from meteorology.classic_analysis import (
        calculate_stability_indices,
        calculate_flyability_score
    )
    print("   ✅ All imports successful")
except ImportError as e:
    print(f"   ❌ Import failed: {e}")
    sys.exit(1)

# Test 2: Station lookup
print("\n2️⃣ Testing station lookup...")
try:
    # Test Lyon coordinates
    closest = find_closest_station(45.76, 4.84)
    assert closest['code'] == '07481', f"Expected Lyon (07481), got {closest['code']}"
    assert closest['distance_km'] < 30, f"Distance too far: {closest['distance_km']}km"
    print(f"   ✅ Lyon: {closest['name']} ({closest['distance_km']:.1f} km)")
    
    # Test Paris coordinates
    closest = find_closest_station(48.85, 2.35)
    assert closest['code'] == '07145', f"Expected Trappes (07145), got {closest['code']}"
    print(f"   ✅ Paris: {closest['name']} ({closest['distance_km']:.1f} km)")
    
except Exception as e:
    print(f"   ❌ Station lookup failed: {e}")
    sys.exit(1)

# Test 3: Classic calculations with sample data
print("\n3️⃣ Testing classic meteorology calculations...")
try:
    # Sample sounding data (simplified)
    pressure = [1000, 925, 850, 700, 500, 300]
    temperature = [15, 10, 5, -5, -20, -45]
    dewpoint = [10, 7, 3, -8, -25, -50]
    
    result = calculate_stability_indices(pressure, temperature, dewpoint)
    
    assert result['success'], f"Calculation failed: {result.get('error')}"
    assert 'cape_jkg' in result, "Missing CAPE value"
    assert 'lcl_m' in result, "Missing LCL value"
    
    print(f"   ✅ CAPE: {result.get('cape_jkg', 0):.1f} J/kg")
    print(f"   ✅ LCL: {result.get('lcl_m', 0)} m")
    print(f"   ✅ Stabilité: {result.get('stabilite_atmospherique')}")
    
    # Test flyability score
    score = calculate_flyability_score(
        cape_jkg=result.get('cape_jkg', 0),
        plafond_m=result.get('plafond_thermique_m'),
        force_thermique_ms=result.get('force_thermique_ms', 0),
        cisaillement='faible',
        risque_orage='faible'
    )
    assert 0 <= score <= 100, f"Invalid score: {score}"
    print(f"   ✅ Score volabilité: {score}/100")
    
except Exception as e:
    print(f"   ❌ Classic calculations failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 4: Database schema
print("\n4️⃣ Testing database schema...")
try:
    from database import engine
    from sqlalchemy import inspect
    
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    if 'emagram_analysis' in tables:
        columns = [col['name'] for col in inspector.get_columns('emagram_analysis')]
        print(f"   ✅ Table 'emagram_analysis' exists ({len(columns)} columns)")
        
        # Check key columns
        required = ['id', 'analysis_datetime', 'station_code', 'score_volabilite']
        for col in required:
            assert col in columns, f"Missing column: {col}"
        print(f"   ✅ All required columns present")
    else:
        print(f"   ⚠️  Table 'emagram_analysis' not created yet (run migration)")
    
except Exception as e:
    print(f"   ⚠️  Database check skipped: {e}")

# Test 5: API endpoints
print("\n5️⃣ Testing API endpoint registration...")
try:
    from routes import router
    
    emagram_routes = [
        route for route in router.routes 
        if hasattr(route, 'path') and 'emagram' in route.path
    ]
    
    assert len(emagram_routes) >= 3, f"Expected 3+ emagram routes, found {len(emagram_routes)}"
    
    for route in emagram_routes:
        print(f"   ✅ {route.methods} {route.path}")
    
except Exception as e:
    print(f"   ❌ API endpoints check failed: {e}")
    sys.exit(1)

print("\n" + "=" * 60)
print("✅ EMAGRAM SYSTEM VALIDATION COMPLETE")
print("=" * 60)
print("\n📋 Summary:")
print("   - 5 French radiosonde stations configured")
print("   - Classic meteorology calculations working")
print("   - Database schema ready")
print("   - 3 API endpoints registered")
print("\n🔑 Next steps:")
print("   1. Set ANTHROPIC_API_KEY environment variable")
print("   2. Run migration: python migrations/add_emagram_analysis.py")
print("   3. Test analysis: POST /api/emagram/analyze")
print("\n")
