#!/usr/bin/env python3
"""
Test script for OpenClaw ACP integration.

This script tests the complete workflow:
1. Check if openclaw is available
2. Check if OpenClaw Gateway is running
3. Take test screenshots
4. Analyze with OpenClaw ACP
5. Verify the response format
"""

import sys
import os
import subprocess
import logging
import json
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from llm.acp_analyzer import analyze_emagram_with_acp

logging.basicConfig(level=logging.DEBUG, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


def check_openclaw_available():
    """Check if openclaw command is available."""
    logger.info("Checking if openclaw is available...")
    
    try:
        result = subprocess.run(
            ["openclaw", "--version"],
            capture_output=True,
            timeout=5
        )
        
        if result.returncode == 0:
            version = result.stdout.decode('utf-8').strip()
            logger.info(f"✅ openclaw is available: {version}")
            return True
        else:
            logger.error("❌ openclaw command failed")
            return False
            
    except FileNotFoundError:
        logger.error("❌ openclaw command not found in PATH")
        logger.info("💡 Install OpenClaw: npm install -g openclaw")
        return False
        
    except Exception as e:
        logger.error(f"❌ Error checking openclaw: {e}")
        return False


def check_gateway_running():
    """Check if OpenClaw Gateway is running."""
    logger.info("Checking if OpenClaw Gateway is running...")
    
    try:
        result = subprocess.run(
            ["openclaw", "status"],
            capture_output=True,
            timeout=5
        )
        
        output = result.stdout.decode('utf-8')
        
        if "running" in output.lower():
            logger.info("✅ OpenClaw Gateway is running")
            return True
        else:
            logger.warning("⚠️  OpenClaw Gateway might not be running")
            logger.info(f"Status output: {output}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error checking gateway status: {e}")
        return False


def create_test_screenshots():
    """Create dummy test screenshots."""
    logger.info("Creating test screenshot files...")
    
    screenshots_dir = Path("/tmp/emagram_test")
    screenshots_dir.mkdir(exist_ok=True)
    
    test_files = [
        screenshots_dir / "meteo_parapente_test.png",
        screenshots_dir / "topmeteo_test.png",
        screenshots_dir / "windy_test.png"
    ]
    
    for path in test_files:
        # Create a 1x1 pixel PNG (minimal valid PNG)
        # PNG header + IHDR + IDAT + IEND
        png_data = (
            b'\x89PNG\r\n\x1a\n'  # PNG signature
            b'\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'  # IHDR chunk
            b'\x08\x02\x00\x00\x00\x90wS\xde'
            b'\x00\x00\x00\x0cIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4'  # IDAT chunk
            b'\x00\x00\x00\x00IEND\xaeB`\x82'  # IEND chunk
        )
        
        path.write_bytes(png_data)
        logger.debug(f"Created {path}")
    
    logger.info(f"✅ Created {len(test_files)} test files")
    return [str(p) for p in test_files]


def test_acp_analysis(screenshot_paths):
    """Test ACP analysis with test screenshots."""
    logger.info("Testing OpenClaw ACP analysis...")
    
    try:
        result = analyze_emagram_with_acp(
            screenshot_paths=screenshot_paths,
            spot_name="Test Spot Arguel",
            coordinates=(47.2167, 6.0833),
            timeout=30
        )
        
        logger.info("✅ ACP analysis successful!")
        logger.info("\nAnalysis result:")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
        # Validate response structure
        required_fields = [
            'plafond_thermique_m',
            'force_thermique_ms',
            'heures_volables',
            'score_volabilite',
            'conseils_vol',
            'alertes_securite',
            'details_analyse'
        ]
        
        missing_fields = [f for f in required_fields if f not in result]
        
        if missing_fields:
            logger.warning(f"⚠️  Missing fields in response: {missing_fields}")
            return False
        
        logger.info("✅ Response structure is valid")
        return True
        
    except Exception as e:
        logger.error(f"❌ ACP analysis failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def cleanup_test_files(screenshot_paths):
    """Remove test screenshot files."""
    logger.info("Cleaning up test files...")
    
    for path in screenshot_paths:
        Path(path).unlink(missing_ok=True)
    
    screenshots_dir = Path("/tmp/emagram_test")
    if screenshots_dir.exists() and not list(screenshots_dir.iterdir()):
        screenshots_dir.rmdir()
    
    logger.info("✅ Cleanup complete")


def main():
    """Run all tests."""
    logger.info("=" * 60)
    logger.info("OpenClaw ACP Integration Test")
    logger.info("=" * 60)
    
    # Check prerequisites
    if not check_openclaw_available():
        logger.error("\n❌ Test failed: openclaw not available")
        logger.info("\nTo install OpenClaw:")
        logger.info("  npm install -g openclaw")
        logger.info("  openclaw onboard")
        return False
    
    if not check_gateway_running():
        logger.warning("\n⚠️  OpenClaw Gateway might not be running")
        logger.info("\nTo start the gateway:")
        logger.info("  openclaw gateway --port 18789")
        logger.info("\nContinuing anyway...")
    
    # Create test data
    screenshot_paths = create_test_screenshots()
    
    try:
        # Run analysis test
        success = test_acp_analysis(screenshot_paths)
        
        if success:
            logger.info("\n" + "=" * 60)
            logger.info("✅ All tests passed!")
            logger.info("=" * 60)
            logger.info("\nNext steps:")
            logger.info("1. Set OPENCLAW_ACP_ENABLED=true in .env")
            logger.info("2. Optionally set OPENCLAW_AGENT_ID (e.g., claude, codex)")
            logger.info("3. Run the emagram scheduler: python backend/emagram_scheduler/emagram_scheduler.py")
            return True
        else:
            logger.error("\n" + "=" * 60)
            logger.error("❌ Tests failed")
            logger.error("=" * 60)
            return False
            
    finally:
        cleanup_test_files(screenshot_paths)


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
