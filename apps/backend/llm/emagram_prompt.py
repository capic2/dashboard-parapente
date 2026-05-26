"""Shared prompt contract for vision-based emagram analysis."""

from __future__ import annotations

SUPPORTED_LOCALES = {"fr", "en"}


def normalize_analysis_locale(locale: str | None) -> str:
    """Return a supported analysis locale, defaulting to French."""
    if not locale:
        return "fr"
    normalized = locale.lower().split("-", maxsplit=1)[0]
    return normalized if normalized in SUPPORTED_LOCALES else "fr"


def language_instruction(locale: str | None) -> str:
    """Return the natural-language instruction for generated explanations."""
    normalized = normalize_analysis_locale(locale)
    if normalized == "en":
        return "Write every user-facing explanation in simple English."
    return "Rédige toutes les explications visibles par l'utilisateur en français simple."


def build_emagram_analysis_prompt(
    *,
    spot_name: str,
    lat: float,
    lon: float,
    source_lines: str,
    image_count: int,
    locale: str | None,
) -> str:
    """Build the shared JSON contract used by all vision providers."""
    normalized_locale = normalize_analysis_locale(locale)
    return f"""Tu es un expert meteorologue specialise en parapente. Analyse ces {image_count} emagrammes pour {spot_name} ({lat:.4f}, {lon:.4f}).

Correspondance des images:
{source_lines}

{language_instruction(normalized_locale)}

Reponds UNIQUEMENT avec ce JSON valide, sans markdown:

{{
  "plafond_thermique_m": <altitude plafond en metres>,
  "force_thermique_ms": <force thermiques en m/s>,
  "heures_volables": "<ex: 12h-18h>",
  "score_volabilite": <0-100>,
  "conseils_vol": "<conseils courts MAX 50 mots>",
  "alertes_securite": ["<alerte courte>"],
  "details_analyse": "<analyse courte MAX 100 mots>",
  "explication_analyse": {{
    "locale": "{normalized_locale}",
    "resume": "<pourquoi ce score en 1 phrase>",
    "indices": [
      "<indice global observe -> consequence parapente simple>"
    ],
    "par_source": {{
      "<source exacte ci-dessus>": [
        "<observation utile mais non localisee ou complementaire>"
      ]
    }},
    "annotations_image": {{
      "<source exacte ci-dessus>": [
        {{
          "id": "<identifiant-court-stable>",
          "type": "point",
          "label": "<titre court>",
          "priority": "important",
          "category": "thermal",
          "display_order": 1,
          "confidence": 0.84,
          "x": 42,
          "y": 58,
          "visual_cue": "<repere visuel simple, incluant pourquoi ce point est place ici>",
          "weather_reading": "<lecture meteo simple>",
          "flight_impact": "<impact concret pour voler>",
          "term": "<mot meteo utile optionnel>",
          "term_definition": "<definition courte optionnelle>",
          "uncertainty_note": "<raison simple si lecture moins certaine, sinon null>"
        }},
        {{
          "id": "<identifiant-zone>",
          "type": "zone",
          "label": "<titre court>",
          "priority": "watch",
          "category": "stability",
          "display_order": 2,
          "confidence": 0.78,
          "x": 35,
          "y": 30,
          "width": 12,
          "height": 10,
          "visual_cue": "<repere visuel simple de la zone>",
          "weather_reading": "<lecture meteo simple>",
          "flight_impact": "<impact concret pour voler>",
          "term": null,
          "term_definition": null,
          "uncertainty_note": null
        }}
      ]
    }}
  }}
}}

Contraintes obligatoires pour annotations_image:
- Produis au maximum 6 annotations par source, uniquement sur les points importants pour comprendre les conditions de vol et apprendre a lire l'emagramme.
- Chaque source doit etre independante. Ne copie jamais une annotation d'une source vers une autre.
- Coordonnees x, y, width, height en pourcentage de l'image originale, origine en haut a gauche, valeurs entre 0 et 100.
- Pour type "point", x et y sont obligatoires. Pour type "zone", x, y, width et height sont obligatoires.
- confidence est obligatoire entre 0 et 1. N'invente pas de coordonnees si la courbe n'est pas lisible.
- priority doit etre exactement: "important", "watch" ou "educational".
- category doit etre exactement: "thermal", "ceiling", "stability", "humidity", "wind" ou "risk".
- visual_cue, weather_reading et flight_impact doivent etre courts, clairs, avec des mots simples.
- Utilise term et term_definition seulement si un mot meteo utile merite d'etre appris.
- Si une lecture est incertaine mais utile, garde confidence adaptee et explique pourquoi dans uncertainty_note.

Explique les courbes visibles: temperature, point de rosee, ecart temperature/point de rosee, parcelle/thermique si visible, plafond/base nuageuse, inversions/couches stables et vent altitude si visible.
IMPORTANT: Reponds UNIQUEMENT le JSON complet, rien d'autre.
"""
