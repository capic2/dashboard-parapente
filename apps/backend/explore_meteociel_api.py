"""Explore if meteociel has an API or better URL structure"""

import asyncio
import re

import httpx


async def main():
    print("=" * 70)
    print("🔍 Exploring Meteociel URL Patterns")
    print("=" * 70)
    print()

    # Coordinates for Arguel
    _lat, _lon = 47.012, 6.789

    # Try to find city code
    # Meteociel uses INSEE codes (French city codes)
    # Arguel postal code: 25720
    # Let's try to search and parse the results

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        # First, search for the city
        search_url = "https://www.meteociel.fr/prevville.php?ville=Arguel"
        print("Searching for Arguel...")
        print(f"URL: {search_url}")
        print()

        response = await client.get(search_url)
        if response.status_code == 200:
            html = response.text

            # Look for links to forecast pages
            # Pattern: href="/previsions/XXXXX/city-name.htm"
            links = re.findall(r'href="(/previsions/[^"]+)"', html)

            print(f"Found {len(links)} forecast links:")
            for link in links[:5]:
                print(f"  {link}")

            # Also look for AROME links
            arome_links = re.findall(r'href="(/previsions-arome[^"]+)"', html)
            print(f"\\nFound {len(arome_links)} AROME links:")
            for link in arome_links[:5]:
                print(f"  {link}")

            print()

            # Try the first forecast link if found
            if links:
                forecast_url = "https://www.meteociel.fr" + links[0]
                print(f"Trying first forecast link: {forecast_url}")

                forecast_response = await client.get(forecast_url)
                if forecast_response.status_code == 200:
                    print(f"✓ Success! Status: {forecast_response.status_code}")
                    print(f"  Page length: {len(forecast_response.text)} chars")

                    # Save it
                    with open("meteociel_forecast.html", "w", encoding="utf-8") as f:
                        f.write(forecast_response.text)
                    print("  ✓ Saved to meteociel_forecast.html")
                else:
                    print(f"✗ Failed with status: {forecast_response.status_code}")


asyncio.run(main())
