"""Check status API response"""
import httpx
import asyncio
import json

async def main():
    async with httpx.AsyncClient() as client:
        response = await client.get('https://data0.meteo-parapente.com/status.php')
        data = response.json()
        print(json.dumps(data, indent=2))

asyncio.run(main())
