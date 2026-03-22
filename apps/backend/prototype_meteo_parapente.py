#!/usr/bin/env python3
"""
PROTOTYPE: Scraper meteo-parapente.com avec Playwright
Objectif: Explorer le site et identifier les sélecteurs CSS nécessaires

Usage:
    python prototype_meteo_parapente.py [ville] [elevation] [jours]

Exemples:
    python prototype_meteo_parapente.py "Arguel" 427 1
    python prototype_meteo_parapente.py "Mont Poupet" 842 3
"""

import asyncio
import json
import logging
import re
import sys
from datetime import datetime
from typing import Any

from playwright.async_api import async_playwright

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


async def explore_meteo_parapente(
    site_name: str = "Arguel", elevation_m: int = 427, days: int = 1, debug_mode: bool = True
) -> dict[str, Any]:
    """
    Prototype de scraping avec mode debug

    Args:
        site_name: Nom de la ville à rechercher
        elevation_m: Altitude du site (pour sélectionner la bonne ligne)
        days: Nombre de jours à récupérer
        debug_mode: Si True, ouvre le navigateur visible + pauses

    Returns:
        Dict avec les données extraites et les sélecteurs identifiés
    """

    logger.info(f"🚀 Démarrage du prototype pour {site_name} ({elevation_m}m), {days} jour(s)")

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=not debug_mode)
            page = await browser.new_page()

            # Configuration pour le mode debug
            if debug_mode:
                logger.info(
                    "⚠️  Mode DEBUG: Le navigateur va s'ouvrir. Vous pouvez inspecter la page."
                )
                page.set_default_timeout(60000)  # 60s pour avoir le temps d'inspecter
            else:
                page.set_default_timeout(30000)  # 30s normal

            # Appel de la fonction d'exploration
            result = await explore_and_extract(page, site_name, elevation_m, days, debug_mode)

            await browser.close()

            logger.info("✅ Scraping terminé!")

            return {
                "success": True,
                "site_name": site_name,
                "elevation_m": elevation_m,
                "days_requested": days,
                "data": result,
                "timestamp": datetime.now().isoformat(),
            }

    except Exception as e:
        logger.error(f"❌ Erreur: {e}", exc_info=True)
        return {"success": False, "error": str(e), "timestamp": datetime.now().isoformat()}


async def explore_and_extract(page, site_name: str, elevation_m: int, days: int, debug: bool):
    """
    Fonction d'exploration et d'extraction

    Cette fonction explore le site et documente les sélecteurs trouvés
    """

    logger.info("🔍 Page chargement...")

    selectors_found = {}
    all_days_data = []

    try:
        # ============================================================
        # ÉTAPE 1: CHARGER LA PAGE D'ACCUEIL
        # ============================================================
        logger.info("📄 Chargement de meteo-parapente.com...")

        await page.goto("https://meteo-parapente.com/", wait_until="networkidle")
        await page.wait_for_timeout(3000)  # Attendre Vue.js

        if debug:
            logger.info("📸 Page chargée. Inspection possible...")
            await page.wait_for_timeout(2000)

        # ============================================================
        # ÉTAPE 2: RECHERCHE DU CHAMP DE RECHERCHE
        # ============================================================
        logger.info("🔎 Recherche du champ de recherche...")

        # Liste exhaustive de sélecteurs à tester
        search_selectors = [
            'input[type="search"]',
            'input[type="text"]',
            'input[placeholder*="recherche" i]',
            'input[placeholder*="search" i]',
            'input[placeholder*="ville" i]',
            'input[placeholder*="lieu" i]',
            'input[placeholder*="spot" i]',
            "input.search",
            "#search",
            ".search-input",
            'input[name="search"]',
            'input[name="q"]',
            '[data-testid="search"]',
        ]

        search_input = None
        for selector in search_selectors:
            try:
                locator = page.locator(selector).first
                if await locator.is_visible(timeout=1000):
                    search_input = locator
                    selectors_found["search_input"] = selector
                    logger.info(f"✓ Champ trouvé: {selector}")
                    break
            except Exception as e:
                continue

        if not search_input:
            logger.warning("⚠️  Aucun champ de recherche standard trouvé")

            # Debug: lister TOUS les inputs visibles
            logger.info("📋 Debug: Liste de tous les inputs:")
            all_inputs = await page.locator("input").all()
            for i, inp in enumerate(all_inputs[:15]):
                try:
                    is_visible = await inp.is_visible()
                    attrs = {
                        "visible": is_visible,
                        "type": await inp.get_attribute("type") or "",
                        "name": await inp.get_attribute("name") or "",
                        "placeholder": await inp.get_attribute("placeholder") or "",
                        "class": await inp.get_attribute("class") or "",
                        "id": await inp.get_attribute("id") or "",
                    }
                    logger.info(f"   [{i}] {attrs}")
                except Exception as e:
                    logger.info(f"   [{i}] Erreur: {e}")

            # Screenshot pour debug
            if debug:
                await page.screenshot(path="debug_no_search_input.png", full_page=True)
                logger.info("📸 Screenshot: debug_no_search_input.png")

            return {
                "error": "search_input_not_found",
                "selectors_found": selectors_found,
                "inputs_count": len(all_inputs),
                "debug_tip": "Voir screenshot et logs pour identifier le bon sélecteur",
            }

        # ============================================================
        # ÉTAPE 3: SAISIE DE LA VILLE
        # ============================================================
        logger.info(f"⌨️  Saisie de '{site_name}'...")

        # Cliquer d'abord pour activer l'input
        await search_input.click()
        await page.wait_for_timeout(500)

        # Vider l'input au cas où
        await search_input.fill("")
        await page.wait_for_timeout(200)

        # Taper le nom lettre par lettre (plus naturel)
        await search_input.type(site_name, delay=100)
        await page.wait_for_timeout(1500)  # Attendre les suggestions

        # ============================================================
        # ÉTAPE 4: SÉLECTION DE LA SUGGESTION
        # ============================================================
        logger.info("📋 Recherche des suggestions...")

        # Escape regex special characters for safe selector usage
        escaped_site_name = re.escape(site_name)
        
        suggestion_selectors = [
            f'text="{site_name}"',
            f"text=/{escaped_site_name}/i",
            f'[role="option"]:has-text("{site_name}")',
            f'li:has-text("{site_name}")',
            f'.suggestion:has-text("{site_name}")',
            f'.search-result:has-text("{site_name}")',
            f'[data-testid*="suggestion"]:has-text("{site_name}")',
            # Plus générique
            f'div:has-text("{site_name}")',
            f'span:has-text("{site_name}")',
        ]

        suggestion = None
        for selector in suggestion_selectors:
            try:
                locator = page.locator(selector).first
                if await locator.is_visible(timeout=2000):
                    suggestion = locator
                    selectors_found["suggestion"] = selector
                    logger.info(f"✓ Suggestion trouvée: {selector}")
                    break
            except Exception as e:
                continue

        if not suggestion:
            logger.warning("⚠️  Aucune suggestion trouvée")

            # Debug: capturer l'état après recherche
            logger.info("📋 Debug: Contenu de la page après recherche:")
            page_content = await page.content()
            logger.info(f"   Taille HTML: {len(page_content)} chars")

            # Rechercher le texte de la ville dans la page
            if site_name.lower() in page_content.lower():
                logger.info(f"   ✓ Texte '{site_name}' trouvé dans la page")
                # Essayer de trouver l'élément parent (use escaped regex)
                matches = await page.locator(f"text=/{escaped_site_name}/i").all()
                logger.info(f"   {len(matches)} éléments contiennent le texte")
                for i, match in enumerate(matches[:5]):
                    try:
                        tag = await match.evaluate("el => el.tagName")
                        text = await match.inner_text()
                        logger.info(f"      [{i}] <{tag}>: {text[:50]}")
                    except Exception as e:
                        pass
            else:
                logger.info(f"   ✗ Texte '{site_name}' NON trouvé dans la page")

            if debug:
                await page.screenshot(path="debug_no_suggestion.png", full_page=True)
                logger.info("📸 Screenshot: debug_no_suggestion.png")

                # Sauvegarder le HTML pour inspection
                with open("debug_page_content.html", "w", encoding="utf-8") as f:
                    f.write(page_content)
                logger.info("💾 HTML: debug_page_content.html")

            return {
                "error": "suggestion_not_found",
                "selectors_found": selectors_found,
                "debug_tip": "Voir screenshot et HTML pour identifier les suggestions",
            }

        # Cliquer sur la suggestion
        logger.info("🖱️  Clic sur la suggestion...")
        await suggestion.click()
        await page.wait_for_timeout(3000)  # Attendre chargement prévisions

        # Attendre que le contenu change (prévisions chargées)
        try:
            await page.wait_for_load_state("networkidle", timeout=10000)
        except Exception as e:
            logger.warning(f"Timeout networkidle ({e}), continuons quand même...")

        # ============================================================
        # ÉTAPE 5: EXTRACTION DES DONNÉES PAR JOUR
        # ============================================================

        for day_idx in range(days):
            logger.info(f"📅 Extraction jour {day_idx}...")

            if day_idx > 0:
                # Navigation vers jour suivant
                logger.info("➡️  Navigation vers jour suivant...")

                next_button_selectors = [
                    'button:has-text("→")',
                    'button:has-text(">")',
                    'button:has-text("suivant")',
                    'button:has-text("next")',
                    ".next-day",
                    ".arrow-right",
                    '[aria-label*="next" i]',
                    '[aria-label*="suivant" i]',
                    '[data-testid*="next"]',
                ]

                next_button = None
                for selector in next_button_selectors:
                    try:
                        locator = page.locator(selector).first
                        if await locator.is_visible(timeout=1000):
                            next_button = locator
                            selectors_found["next_day_button"] = selector
                            logger.info(f"✓ Bouton suivant: {selector}")
                            break
                    except Exception as e:
                        continue

                if not next_button:
                    logger.warning(f"⚠️  Impossible de naviguer au jour {day_idx}")
                    all_days_data.append(None)
                    continue

                await next_button.click()
                await page.wait_for_timeout(2000)
                try:
                    await page.wait_for_load_state("networkidle", timeout=5000)
                except Exception as e:
                    pass

            # Extraire les données du jour
            day_data = await extract_day_forecast(page, elevation_m, selectors_found, debug)
            all_days_data.append(day_data)

            logger.info(f"   {'✓' if day_data else '✗'} Jour {day_idx} extrait")

        logger.info("✅ Extraction terminée!")

        if debug:
            logger.info("⏸️  Pause 5s pour inspection finale...")
            await page.wait_for_timeout(5000)

        return {
            "days_data": all_days_data,
            "selectors_found": selectors_found,
            "total_days": len(all_days_data),
            "success_count": sum(1 for d in all_days_data if d is not None),
        }

    except Exception as e:
        logger.error(f"❌ Erreur: {e}", exc_info=True)

        if debug:
            try:
                await page.screenshot(path="debug_error.png", full_page=True)
                logger.info("📸 Screenshot erreur: debug_error.png")
            except Exception as e:
                pass

        return {"error": str(e), "selectors_found": selectors_found}


async def extract_day_forecast(page, elevation_m: int, selectors: dict, debug: bool):
    """Extraction des prévisions horaires pour un jour"""

    logger.info(f"📊 Extraction données (altitude cible: {elevation_m}m)...")

    try:
        # Attendre un peu pour s'assurer que les données sont chargées
        await page.wait_for_timeout(1000)

        # ============================================================
        # RECHERCHE TABLE/GRILLE DE PRÉVISIONS
        # ============================================================

        container_selectors = [
            "table",
            ".forecast-table",
            ".weather-table",
            ".previsions",
            '[role="table"]',
            ".forecast-grid",
            ".hourly-forecast",
            'div[class*="forecast"]',
            'div[class*="meteo"]',
        ]

        forecast_container = None
        for selector in container_selectors:
            try:
                containers = await page.locator(selector).all()
                if containers:
                    # Prendre le premier visible
                    for container in containers:
                        if await container.is_visible():
                            forecast_container = container
                            selectors["forecast_container"] = selector
                            logger.info(f"✓ Conteneur trouvé: {selector} ({len(containers)} total)")
                            break
                    if forecast_container:
                        break
            except Exception as e:
                continue

        if not forecast_container:
            logger.warning("⚠️  Aucun conteneur de prévisions trouvé")

            if debug:
                # Dump structure de la page
                logger.info("📋 Structure principale de la page:")
                main_divs = await page.locator("div[class]").all()
                shown = 0
                for i, div in enumerate(main_divs):
                    try:
                        if await div.is_visible() and shown < 30:
                            cls = await div.get_attribute("class") or ""
                            if cls:  # Seulement les divs avec class
                                text_preview = await div.inner_text()
                                text_preview = text_preview[:50].replace("\n", " ")
                                logger.info(f"   [{shown}] div.{cls}: {text_preview}...")
                                shown += 1
                    except Exception as e:
                        pass

            return None

        # ============================================================
        # RECHERCHE LIGNES D'ALTITUDE
        # ============================================================

        logger.info("🎯 Recherche des lignes d'altitude...")

        altitude_strategies = [
            'tr:has-text("m")',
            "tr[data-altitude]",
            "[data-elevation]",
            ".altitude-row",
            ".elevation-row",
            "tr.elevation",
            'div:has-text("m")',
            "tr",  # Fallback: toutes les lignes
        ]

        altitude_elements = []
        for selector in altitude_strategies:
            try:
                elements = (
                    await forecast_container.locator(selector).all()
                    if forecast_container
                    else await page.locator(selector).all()
                )
                if elements:
                    altitude_elements = elements
                    selectors["altitude_rows"] = selector
                    logger.info(f"✓ {len(elements)} lignes d'altitude ({selector})")
                    break
            except Exception as e:
                continue

        if not altitude_elements:
            logger.warning("⚠️  Aucune ligne d'altitude trouvée")

            if debug:
                # Essayer de trouver tous les éléments avec des nombres suivis de "m"
                logger.info("📋 Recherche d'éléments contenant des altitudes...")
                all_with_m = await page.locator('*:has-text("m")').all()
                for i, el in enumerate(all_with_m[:20]):
                    try:
                        text = await el.inner_text()
                        text = text[:100].replace("\n", " ")
                        tag = await el.evaluate("el => el.tagName")
                        logger.info(f"   [{i}] <{tag}>: {text}")
                    except Exception as e:
                        pass

            return None

        # ============================================================
        # SÉLECTION DE LA BONNE ALTITUDE
        # ============================================================

        logger.info(f"🎯 Sélection de l'altitude pour {elevation_m}m...")

        import re

        parsed_altitudes = []

        for element in altitude_elements:
            try:
                text = await element.inner_text()

                # Chercher pattern: nombre suivi de "m"
                patterns = [
                    r"(\d+)\s*m(?:ètres)?",
                    r"(\d+)\s*m\b",
                    r"alt(?:itude)?\s*:\s*(\d+)",
                    r"(\d+)\s*(?:m|M)\b",
                ]

                alt_value = None
                for pattern in patterns:
                    match = re.search(pattern, text, re.IGNORECASE)
                    if match:
                        alt_value = int(match.group(1))
                        break

                if alt_value and 100 <= alt_value <= 5000:  # Filtre altitude raisonnable
                    parsed_altitudes.append((alt_value, element))
                    logger.info(f"   Altitude: {alt_value}m")

            except Exception as e:
                logger.debug(f"   Erreur parsing altitude: {e}")
                continue

        if not parsed_altitudes:
            logger.warning("⚠️  Impossible de parser les altitudes")
            return None

        # Trier par altitude (croissant)
        parsed_altitudes.sort(key=lambda x: x[0])

        # STRATÉGIE: Prendre la plus basse (comme demandé)
        target_altitude, target_element = parsed_altitudes[0]

        logger.info(f"✓ Altitude sélectionnée: {target_altitude}m (la plus basse)")

        # ============================================================
        # EXTRACTION DONNÉES HORAIRES
        # ============================================================

        logger.info("📊 Extraction des données horaires...")

        # Récupérer toutes les cellules de la ligne/élément
        cell_selectors = ["td", "th", "div", "span"]
        cells = []

        for cell_sel in cell_selectors:
            try:
                found_cells = await target_element.locator(cell_sel).all()
                if found_cells:
                    cells = found_cells
                    selectors["data_cells"] = cell_sel
                    logger.info(f"✓ {len(found_cells)} cellules ({cell_sel})")
                    break
            except Exception as e:
                continue

        if not cells:
            logger.warning("⚠️  Aucune cellule trouvée")
            return None

        # Debug: afficher le contenu de quelques cellules
        if debug:
            logger.info("📋 Aperçu des cellules:")
            for i, cell in enumerate(cells[:15]):
                try:
                    text = await cell.inner_text()
                    text = text.replace("\n", " ").strip()
                    if text:
                        logger.info(f"   Cell[{i}]: {text}")
                except Exception as e:
                    pass

        # ============================================================
        # PARSING DES DONNÉES
        # ============================================================

        hourly_data = []

        # Parsing basique pour identifier les patterns
        import re

        for i, cell in enumerate(cells):
            try:
                text = await cell.inner_text()
                text = text.strip()

                # Essayer de détecter si c'est une heure
                hour_match = re.search(r"\b(\d{1,2})(?::00)?(?:h)?\b", text)
                if hour_match:
                    hour = int(hour_match.group(1))
                    if 0 <= hour <= 23:
                        # Cellule suivante = vent ?
                        wind_text = ""
                        temp_text = ""

                        if i + 1 < len(cells):
                            wind_text = await cells[i + 1].inner_text()
                        if i + 2 < len(cells):
                            temp_text = await cells[i + 2].inner_text()

                        wind_match = re.search(r"(\d+(?:\.\d+)?)", wind_text)
                        temp_match = re.search(r"(-?\d+(?:\.\d+)?)", temp_text)

                        hourly_data.append(
                            {
                                "hour": hour,
                                "wind_speed": (
                                    float(wind_match.group(1)) / 3.6 if wind_match else None
                                ),
                                "temperature": float(temp_match.group(1)) if temp_match else None,
                                "raw_hour": text,
                                "raw_wind": wind_text,
                                "raw_temp": temp_text,
                            }
                        )
            except Exception as e:
                logger.debug(f"Erreur parsing cellule {i}: {e}")
                continue

        logger.info(f"✓ {len(hourly_data)} heures extraites")

        return {
            "altitude_selected": target_altitude,
            "hourly": hourly_data,
            "total_hours": len(hourly_data),
        }

    except Exception as e:
        logger.error(f"❌ Erreur extraction: {e}", exc_info=True)
        return None


async def main():
    """Point d'entrée"""

    site_name = sys.argv[1] if len(sys.argv) > 1 else "Arguel"
    elevation_m = int(sys.argv[2]) if len(sys.argv) > 2 else 427
    days = int(sys.argv[3]) if len(sys.argv) > 3 else 1

    print("\n" + "=" * 60)
    print("🧪 PROTOTYPE SCRAPER METEO-PARAPENTE.COM")
    print("=" * 60)
    print(f"Ville:     {site_name}")
    print(f"Altitude:  {elevation_m}m")
    print(f"Jours:     {days}")
    print("Debug:     OUI (navigateur visible)")
    print("=" * 60 + "\n")

    result = await explore_meteo_parapente(
        site_name=site_name, elevation_m=elevation_m, days=days, debug_mode=True
    )

    print("\n" + "=" * 60)
    print("📊 RÉSULTAT")
    print("=" * 60)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print("=" * 60 + "\n")

    output_file = f"prototype_result_{site_name.lower().replace(' ', '_')}.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"💾 Résultat sauvegardé: {output_file}\n")

    return result


if __name__ == "__main__":
    asyncio.run(main())
