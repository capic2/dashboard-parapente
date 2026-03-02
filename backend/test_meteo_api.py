"""Test si meteo-parapente expose une API JSON"""
import asyncio
from playwright.async_api import async_playwright

async def test_api():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        
        # Intercepter les requêtes réseau
        requests = []
        
        async def log_request(request):
            if 'json' in request.url or 'api' in request.url or 'forecast' in request.url or 'data' in request.url:
                requests.append({
                    'url': request.url,
                    'method': request.method,
                    'resource_type': request.resource_type
                })
        
        page = await context.new_page()
        page.on('request', log_request)
        
        # Charger la page
        await page.goto('https://meteo-parapente.com/')
        await page.wait_for_timeout(2000)
        
        # Rechercher Arguel
        search = page.locator('input[type="text"]').first
        await search.click()
        await search.type('Arguel', delay=100)
        await page.wait_for_timeout(1500)
        
        suggestion = page.locator('text="Arguel"').first
        await suggestion.click()
        await page.wait_for_timeout(5000)  # Attendre plus longtemps
        
        await browser.close()
        
        # Afficher les requêtes JSON/API trouvées
        print("\n🔍 Requêtes API/JSON détectées:")
        for req in requests:
            print(f"  • {req['method']} {req['url']}")
            print(f"    Type: {req['resource_type']}")
        
        return requests

if __name__ == '__main__':
    requests = asyncio.run(test_api())
    print(f"\n📊 Total: {len(requests)} requêtes API/JSON")
