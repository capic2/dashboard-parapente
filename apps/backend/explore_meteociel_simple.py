"""Explore meteociel website using simple httpx"""

import asyncio

import httpx
from bs4 import BeautifulSoup


async def main():
    print("=" * 70)
    print("🔍 Exploring Meteociel Website")
    print("=" * 70)
    print()

    # Try different URL formats
    urls_to_try = [
        "https://www.meteociel.fr/prevville.php?ville=Arguel",
        "https://www.meteociel.fr/previsions/25031/arguel.htm",
        "https://www.meteociel.fr/temps-reel/obs_villes.php?code2=25031",
    ]

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        for url in urls_to_try:
            print(f"\nTrying: {url}")
            print("-" * 70)

            try:
                response = await client.get(url)
                print(f"Status: {response.status_code}")

                if response.status_code == 200:
                    html = response.text
                    print(f"Page length: {len(html)} characters")

                    # Parse with BeautifulSoup
                    soup = BeautifulSoup(html, "html.parser")

                    # Look for title
                    title = soup.find("title")
                    if title:
                        print(f"Title: {title.get_text(strip=True)}")

                    # Look for tables
                    tables = soup.find_all("table")
                    print(f"Tables found: {len(tables)}")

                    # Check for errors
                    if "404" in html or "not found" in html.lower():
                        print("⚠️  Possible 404 error")
                    elif "erreur" in html.lower():
                        print("⚠️  Possible error page")
                    else:
                        print("✓ Page loaded successfully")

                        # Save first successful page
                        if len(tables) > 0:
                            with open(
                                f"meteociel_page_{urls_to_try.index(url)}.html",
                                "w",
                                encoding="utf-8",
                            ) as f:
                                f.write(html)
                            print(f"✓ Saved to meteociel_page_{urls_to_try.index(url)}.html")

                            # Show first table structure
                            print("\nFirst table structure:")
                            first_table = tables[0]
                            rows = first_table.find_all("tr")[:3]
                            for i, row in enumerate(rows):
                                cells = row.find_all(["td", "th"])
                                print(f"  Row {i}: {len(cells)} cells")
                                for j, cell in enumerate(cells[:5]):
                                    text = cell.get_text(strip=True)[:30]
                                    print(f"    Cell {j}: {text}")

                elif response.status_code == 404:
                    print("✗ 404 Not Found")
                else:
                    print(f"✗ Unexpected status code: {response.status_code}")

            except Exception as e:
                print(f"✗ Error: {e}")


asyncio.run(main())
