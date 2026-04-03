"""Explore Meteoblue website to understand its HTML structure for precipitation data"""

import asyncio

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright


async def main():
    print("=" * 70)
    print("Exploring Meteoblue Website - Precipitation Structure")
    print("=" * 70)
    print()

    url = "https://www.meteoblue.com/fr/meteo/semaine/arguel_france_3036982"
    print(f"URL: {url}")
    print()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        print("Navigating to page...")
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=15000)
        except Exception as e:
            print(f"Page load warning: {e}")

        # Wait for forecast table
        try:
            await page.wait_for_selector("table.picto", timeout=10000)
            print("Forecast table found")
        except Exception as e:
            print(f"ERROR: Forecast table not found: {e}")
            await browser.close()
            return

        # Click 1h toggle
        try:
            toggle_selector = "#switch input.switch"
            await page.wait_for_selector(toggle_selector, timeout=3000)
            is_checked = await page.evaluate(f'document.querySelector("{toggle_selector}").checked')
            if not is_checked:
                print("Clicking 1h toggle...")
                await page.evaluate(f'document.querySelector("{toggle_selector}").click()')
                await page.wait_for_timeout(1000)
            else:
                print("Already in 1h view")
        except Exception as e:
            print(f"Toggle warning: {e}")

        # Get HTML
        html = await page.content()
        await browser.close()

    # Save full HTML
    with open("meteoblue_arguel.html", "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Saved full HTML ({len(html)} chars) to meteoblue_arguel.html")
    print()

    # Parse and analyze table structure
    soup = BeautifulSoup(html, "html.parser")
    hourly_table = soup.find("table", class_="picto hourly-view")

    if not hourly_table:
        print("WARNING: No hourly-view table found, looking for any picto table...")
        hourly_table = soup.find("table", class_="picto")

    if not hourly_table:
        print("ERROR: No forecast table found in HTML")
        return

    print("=" * 70)
    print("TABLE ROWS ANALYSIS")
    print("=" * 70)
    print()

    rows = hourly_table.find_all("tr")
    for tr in rows:
        classes = tr.get("class", ["no-class"])
        class_str = " ".join(classes) if isinstance(classes, list) else str(classes)

        cells = tr.find_all("td")
        if not cells:
            cells = tr.find_all("th")

        # Get sample of first 4 cells content
        samples = []
        for cell in cells[:4]:
            text = cell.get_text(strip=True)
            if text:
                samples.append(text[:30])
            else:
                # Check for img or other elements
                img = cell.find("img")
                if img:
                    samples.append(f"[img: {img.get('alt', img.get('src', '')[:30])}]")
                else:
                    samples.append("[empty]")

        print(f"tr.{class_str} ({len(cells)} cells)")
        if samples:
            print(f"  Sample: {samples}")
        print()

    # Specifically look for precipitation-related rows
    print("=" * 70)
    print("PRECIPITATION-RELATED ROWS (detailed)")
    print("=" * 70)
    print()

    for tr in rows:
        classes = tr.get("class", [])
        class_str = " ".join(classes) if isinstance(classes, list) else str(classes)

        # Check if row might be precipitation-related
        is_precip = any(
            keyword in class_str.lower() for keyword in ["precip", "rain", "pluie", "proba"]
        )

        # Also check cell content for precipitation indicators
        cells = tr.find_all("td")
        cell_texts = [cell.get_text(strip=True) for cell in cells[:8]]
        has_mm = any("mm" in t.lower() for t in cell_texts)
        has_percent = any("%" in t for t in cell_texts)

        if is_precip or has_mm or has_percent:
            print(f">>> tr.{class_str}")
            print(f"    All cell texts (first 12): {cell_texts[:12]}")
            if has_mm:
                print("    Contains 'mm' values")
            if has_percent:
                print("    Contains '%' values")
            print()


if __name__ == "__main__":
    asyncio.run(main())
