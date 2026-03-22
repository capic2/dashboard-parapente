"""Explore meteociel website to understand its structure"""

import asyncio

from scrapling import Fetcher


async def main():
    print("=" * 70)
    print("🔍 Exploring Meteociel Website")
    print("=" * 70)
    print()

    # Try the URL format
    location_name = "Arguel"
    url = f"https://www.meteociel.fr/prevville.php?ville={location_name}"

    print(f"URL: {url}")
    print()

    try:
        fetcher = Fetcher()

        # Fetch the page
        print("Fetching page...")
        page = fetcher.get(url)

        print("Status: Success")
        print(f"Page length: {len(page.text)} characters")
        print()

        # Save HTML for inspection
        with open("meteociel_page.html", "w", encoding="utf-8") as f:
            f.write(page.text)
        print("✓ Saved HTML to meteociel_page.html")
        print()

        # Look for tables
        tables = page.find_all("table")
        print(f"Found {len(tables)} tables")

        # Look for specific patterns
        if "404" in page.text or "Not Found" in page.text:
            print("⚠️  Possible 404 error")

        if "prévisions" in page.text.lower() or "prevision" in page.text.lower():
            print("✓ Found forecast-related content")

        # Check for specific elements
        print("\nLooking for data patterns...")

        # Search for common weather data patterns
        import re

        # Look for hours
        hours = re.findall(r"\b([0-2]?[0-9])h?\b", page.text)
        print(f"  Found potential hours: {hours[:10]}")

        # Look for temperatures
        temps = re.findall(r"(-?\d+)\s*°", page.text)
        print(f"  Found potential temperatures: {temps[:10]}")

        # Look for wind speeds
        winds = re.findall(r"(\d+)\s*km/h", page.text)
        print(f"  Found potential wind speeds: {winds[:10]}")

    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback

        traceback.print_exc()


asyncio.run(main())
