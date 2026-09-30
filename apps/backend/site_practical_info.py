"""Generate sourced suggestions for a pilot's private site notes."""

import json
import logging
import re
from typing import Any
from urllib.parse import quote

import httpx

import config

logger = logging.getLogger(__name__)

PRACTICAL_INFO_KEYS = ("access", "rules", "webcam", "contact", "hazards")


async def suggest_site_practical_info(site: dict[str, Any]) -> dict[str, Any]:
    """Search the web through Gemini and return conservative notes plus sources."""
    if not config.GOOGLE_API_KEY:
        raise RuntimeError("La recherche web Gemini n'est pas configurée sur le serveur.")

    location_parts = [site.get("region"), site.get("country")]
    location = ", ".join(part for part in location_parts if part)
    coordinates = ""
    if site.get("latitude") is not None and site.get("longitude") is not None:
        coordinates = f"Coordonnées : {site['latitude']}, {site['longitude']}."

    prompt = f"""Recherche sur le web des informations pratiques vérifiables pour ce site de parapente.
Nom : {site['name']}
Localité/pays : {location or 'non précisé'}
{coordinates}
Usage : {site.get('usage_type', 'both')} (takeoff=décollage, landing=atterrissage, both=les deux).

Réponds uniquement avec un objet JSON contenant exactement les clés access, rules, webcam, contact et hazards.
Chaque valeur doit être une chaîne courte en français, ou une chaîne vide si aucune source fiable ne confirme l'information.
Ne déduis jamais un parking, une règle locale, un contact, une webcam ni un danger à partir de connaissances générales.
N'invente aucun fait. Pour access, rules, contact et hazards, ne rapporte que les informations clairement liées à ce site.
Pour webcam, donne un lien seulement s'il s'agit réellement d'une webcam utile à ce site; sinon chaîne vide.
Ne donne pas de conseils génériques de sécurité. La réponse doit être fondée sur les résultats de Google Search."""

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{quote(config.GEMINI_MODEL, safe='-._')}:generateContent"
    )
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
                url,
                headers={"x-goog-api-key": config.GOOGLE_API_KEY},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "tools": [{"google_search": {}}],
                },
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.warning("Gemini practical info search failed with HTTP %s", exc.response.status_code)
        raise RuntimeError("La recherche web est temporairement indisponible.") from exc
    except httpx.HTTPError as exc:
        logger.warning("Gemini practical info search request failed: %s", exc)
        raise RuntimeError("La recherche web est temporairement indisponible.") from exc

    try:
        payload = response.json()
        candidate = payload["candidates"][0]
        part_text_by_index: dict[int, str] = {}
        part_offset_by_index: dict[int, int] = {}
        text_parts: list[str] = []
        text_length = 0
        for index, part in enumerate(candidate["content"]["parts"]):
            part_text = part.get("text")
            if isinstance(part_text, str):
                part_text_by_index[index] = part_text
                part_offset_by_index[index] = text_length
                text_parts.append(part_text)
                text_length += len(part_text)
        text = "".join(text_parts)
        try:
            parsed = json.loads(text)
            json_start = 0
        except json.JSONDecodeError:
            json_match = re.search(r"\{.*\}", text, re.DOTALL)
            if not json_match:
                raise
            parsed = json.loads(json_match.group(0))
            json_start = json_match.start()
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        logger.warning("Gemini returned an invalid practical info response")
        raise RuntimeError("La recherche n'a pas retourné de suggestions exploitables.") from exc
    if not isinstance(parsed, dict):
        raise RuntimeError("La recherche n'a pas retourné de suggestions exploitables.")

    sources: list[dict[str, str]] = []
    seen_urls: set[str] = set()
    metadata = candidate.get("groundingMetadata", {})
    source_chunk_indices: set[int] = set()
    grounding_chunks = metadata.get("groundingChunks", [])
    for index, chunk in enumerate(grounding_chunks):
        web_source = chunk.get("web", {})
        source_url = web_source.get("uri")
        if isinstance(source_url, str) and source_url.startswith(("https://", "http://")):
            source_chunk_indices.add(index)
        if (
            isinstance(source_url, str)
            and source_url.startswith(("https://", "http://"))
            and source_url not in seen_urls
        ):
            seen_urls.add(source_url)
            sources.append(
                {
                    "title": str(web_source.get("title") or source_url),
                    "url": source_url,
                }
            )

    raw_suggestions = {
        key: parsed.get(key, "") if isinstance(parsed.get(key, ""), str) else ""
        for key in PRACTICAL_INFO_KEYS
    }
    supported_ranges: list[tuple[int, int]] = []
    for support in metadata.get("groundingSupports", []):
        indices = support.get("groundingChunkIndices", [])
        segment = support.get("segment", {})
        if not any(index in source_chunk_indices for index in indices):
            continue
        start = segment.get("startIndex", 0)
        end = segment.get("endIndex")
        part_index = segment.get("partIndex", 0)
        part_text = part_text_by_index.get(part_index)
        part_offset = part_offset_by_index.get(part_index)
        if (
            isinstance(start, int)
            and isinstance(end, int)
            and isinstance(part_text, str)
            and isinstance(part_offset, int)
            and 0 <= start < end
        ):
            try:
                char_start = len(part_text.encode("utf-8")[:start].decode("utf-8"))
                char_end = len(part_text.encode("utf-8")[:end].decode("utf-8"))
            except UnicodeDecodeError:
                continue
            if char_end > char_start:
                supported_ranges.append((part_offset + char_start, part_offset + char_end))

    def supported_field_text(key: str, value: str) -> str:
        if not value:
            return ""
        key_pattern = re.compile(rf'"{re.escape(key)}"\s*:\s*')
        matches = list(key_pattern.finditer(text, json_start))
        decoder = json.JSONDecoder()
        for match in reversed(matches):
            value_start = match.end()
            try:
                decoded_value, value_end = decoder.raw_decode(text, value_start)
            except json.JSONDecodeError:
                continue
            if decoded_value != value or not isinstance(decoded_value, str):
                continue
            character_spans: list[tuple[int, int]] = []
            cursor = value_start + 1
            token_end = value_end - 1
            try:
                while cursor < token_end:
                    atom_start = cursor
                    if text[cursor] == "\\":
                        if text[atom_start + 1 : atom_start + 2] == "u":
                            cursor = atom_start + 6
                            high_surrogate = int(text[atom_start + 2 : atom_start + 6], 16)
                            if (
                                0xD800 <= high_surrogate <= 0xDBFF
                                and text[cursor : cursor + 2] == "\\u"
                            ):
                                low_surrogate = int(text[cursor + 2 : cursor + 6], 16)
                                if 0xDC00 <= low_surrogate <= 0xDFFF:
                                    cursor += 6
                        else:
                            cursor += 2
                    else:
                        cursor += 1
                    atom = text[atom_start:cursor]
                    decoded_atom = json.loads(f'"{atom}"')
                    character_spans.extend([(atom_start, cursor)] * len(decoded_atom))
            except (json.JSONDecodeError, TypeError, ValueError):
                return ""
            if len(character_spans) != len(value):
                return ""

            sentences = re.split(r"(?<=[.!?])\s+", value)
            supported_sentences: list[str] = []
            search_from = 0
            for sentence in sentences:
                sentence_start = value.find(sentence, search_from)
                if sentence_start < 0:
                    continue
                search_from = sentence_start + len(sentence)
                sentence_end = sentence_start + len(sentence)
                if not sentence.strip():
                    continue
                sentence_spans = character_spans[sentence_start:sentence_end]
                if sentence_spans and all(
                    any(
                        support_start <= char_start and support_end >= char_end
                        for support_start, support_end in supported_ranges
                    )
                    for char_start, char_end in sentence_spans
                ):
                    supported_sentences.append(sentence.strip())
            return " ".join(supported_sentences)
        return ""

    # Keep complete sentences with grounding support; omit uncited sentences.
    suggestions = {key: supported_field_text(key, value) for key, value in raw_suggestions.items()}
    all_nonempty_fields_supported = bool(sources) and all(
        not value or suggestions[key] == value for key, value in raw_suggestions.items()
    )

    search_entry_point_data = metadata.get("searchEntryPoint") or {}
    search_entry_point = (
        search_entry_point_data.get("renderedContent", "")
        if isinstance(search_entry_point_data, dict)
        else ""
    )
    return {
        "suggestions": suggestions,
        "sources": sources,
        "grounded_result": (
            json.dumps(suggestions, ensure_ascii=False)
            if sources and any(suggestions.values())
            else ""
        ),
        "grounded_result_is_verified": all_nonempty_fields_supported,
        "search_suggestions_html": search_entry_point if sources else "",
    }
