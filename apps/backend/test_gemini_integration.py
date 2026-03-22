#!/usr/bin/env python3
"""
Test script for Google Gemini Vision integration.

This script tests the complete Gemini workflow:
1. Check if google-generativeai is installed
2. Check if GOOGLE_API_KEY is configured
3. Create test screenshots
4. Analyze with Gemini Vision
5. Verify response format
"""

import logging
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

logging.basicConfig(level=logging.DEBUG, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def check_gemini_package():
    """Check if google-generativeai package is installed."""
    logger.info("Checking if google-generativeai is installed...")

    try:
        import google.generativeai as _genai  # noqa: F401 - import check only

        logger.info("✅ google-generativeai package is installed")
        return True
    except ImportError:
        logger.error("❌ google-generativeai package not found")
        logger.info("💡 Install with: pip install google-generativeai")
        return False


def check_api_key():
    """Check if GOOGLE_API_KEY is configured."""
    logger.info("Checking for GOOGLE_API_KEY...")

    api_key = os.getenv("GOOGLE_API_KEY")
    if api_key:
        # Mask the key for logging
        masked = api_key[:10] + "..." + api_key[-4:] if len(api_key) > 14 else "***"
        logger.info(f"✅ GOOGLE_API_KEY found: {masked}")
        return api_key
    else:
        logger.error("❌ GOOGLE_API_KEY not set in environment")
        logger.info("💡 Add to .env: GOOGLE_API_KEY=your_key_here")
        logger.info("💡 Get your key at: https://aistudio.google.com/app/apikey")
        return None


def create_test_screenshots():
    """Create dummy test screenshots."""
    logger.info("Creating test screenshot files...")

    screenshots_dir = Path("/tmp/emagram_test_gemini")
    screenshots_dir.mkdir(exist_ok=True)

    test_files = [
        screenshots_dir / "meteo_parapente_gemini.png",
        screenshots_dir / "topmeteo_gemini.png",
        screenshots_dir / "windy_gemini.png",
    ]

    # Create minimal valid PNG (1x1 pixel)
    png_data = (
        b"\x89PNG\r\n\x1a\n"  # PNG signature
        b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"  # IHDR chunk
        b"\x08\x02\x00\x00\x00\x90wS\xde"
        b"\x00\x00\x00\x0cIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4"  # IDAT chunk
        b"\x00\x00\x00\x00IEND\xaeB`\x82"  # IEND chunk
    )

    for path in test_files:
        path.write_bytes(png_data)
        logger.debug(f"Created {path}")

    logger.info(f"✅ Created {len(test_files)} test files")
    return [str(p) for p in test_files]


def test_gemini_analysis(api_key, screenshot_paths):
    """Test Gemini Vision analysis."""
    logger.info("Testing Gemini Vision analysis...")

    try:
        import json

        from llm.gemini_analyzer import analyze_emagram_with_gemini

        result = analyze_emagram_with_gemini(
            screenshot_paths=screenshot_paths,
            spot_name="Test Spot Arguel",
            coordinates=(47.2167, 6.0833),
            api_key=api_key,
            model_name=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        )

        logger.info("✅ Gemini analysis successful!")
        logger.info("\nAnalysis result:")
        print(json.dumps(result, indent=2, ensure_ascii=False))

        # Validate response structure
        required_fields = [
            "plafond_thermique_m",
            "force_thermique_ms",
            "heures_volables",
            "score_volabilite",
            "conseils_vol",
            "alertes_securite",
            "details_analyse",
        ]

        missing_fields = [f for f in required_fields if f not in result]

        if missing_fields:
            logger.warning(f"⚠️  Missing fields in response: {missing_fields}")
            return False

        # Type validation
        if not isinstance(result["plafond_thermique_m"], int):
            logger.warning(
                f"⚠️  plafond_thermique_m should be int, got {type(result['plafond_thermique_m'])}"
            )

        if not isinstance(result["force_thermique_ms"], int | float):
            logger.warning(
                f"⚠️  force_thermique_ms should be float, got {type(result['force_thermique_ms'])}"
            )

        if not isinstance(result["score_volabilite"], int):
            logger.warning(
                f"⚠️  score_volabilite should be int, got {type(result['score_volabilite'])}"
            )

        if not isinstance(result["alertes_securite"], list):
            logger.warning(
                f"⚠️  alertes_securite should be list, got {type(result['alertes_securite'])}"
            )

        logger.info("✅ Response structure is valid")
        return True

    except Exception as e:
        logger.error(f"❌ Gemini analysis failed: {e}")
        import traceback

        traceback.print_exc()
        return False


def cleanup_test_files(screenshot_paths):
    """Remove test screenshot files."""
    logger.info("Cleaning up test files...")

    for path in screenshot_paths:
        Path(path).unlink(missing_ok=True)

    screenshots_dir = Path("/tmp/emagram_test_gemini")
    if screenshots_dir.exists() and not list(screenshots_dir.iterdir()):
        screenshots_dir.rmdir()

    logger.info("✅ Cleanup complete")


def main():
    """Run all tests."""
    logger.info("=" * 60)
    logger.info("Google Gemini Vision Integration Test")
    logger.info("=" * 60)

    # Check prerequisites
    if not check_gemini_package():
        logger.error("\n❌ Test failed: google-generativeai not installed")
        logger.info("\nTo install:")
        logger.info("  pip install google-generativeai")
        return False

    api_key = check_api_key()
    if not api_key:
        logger.error("\n❌ Test failed: GOOGLE_API_KEY not configured")
        logger.info("\nTo configure:")
        logger.info("  1. Get API key at: https://aistudio.google.com/app/apikey")
        logger.info("  2. Add to .env: GOOGLE_API_KEY=your_key_here")
        return False

    # Create test data
    screenshot_paths = create_test_screenshots()

    try:
        # Run analysis test
        success = test_gemini_analysis(api_key, screenshot_paths)

        if success:
            logger.info("\n" + "=" * 60)
            logger.info("✅ All tests passed!")
            logger.info("=" * 60)
            logger.info("\nGemini integration is ready!")
            logger.info("\nNext steps:")
            logger.info("1. Verify GOOGLE_API_KEY is in .env")
            logger.info("2. Install dependencies: pip install -r requirements.txt")
            logger.info("3. Rebuild Docker: docker-compose build --no-cache backend")
            logger.info("4. Run scheduler: python backend/emagram_scheduler/emagram_scheduler.py")
            logger.info("\nFree tier limits:")
            logger.info("- 1500 requests/day")
            logger.info("- Your usage: ~48 requests/day (6 spots × 8 analyses)")
            logger.info("- Plenty of headroom! 🎉")
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
