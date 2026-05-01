# Analyseurs LLM pour Emagrammes

Ce répertoire contient les analyseurs qui utilisent des modèles de langage avec vision pour analyser des captures d'écran d'emagrammes.

## Analyseurs disponibles

### 1. `groq_analyzer.py` - Groq Llama Vision (Gratuit)

Utilise **Groq** avec Llama Vision pour analyser les emagrammes.

**Avantages:**
- ✅ Gratuit
- ✅ Rapide (inférence Groq)
- ✅ Premier choix par défaut pour économiser Gemini

**Configuration:**
```bash
# Dans .env
BACKEND_GROQ_API_KEY=your_groq_api_key_here
BACKEND_GROQ_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

---

### 2. `openrouter_analyzer.py` - OpenRouter Vision (Fallback gratuit)

Utilise **OpenRouter** avec un modèle vision gratuit configurable.

**Avantages:**
- ✅ Donne accès à plusieurs modèles vision via une API compatible OpenAI
- ✅ Permet d'ajouter un deuxième fallback gratuit après Groq
- ✅ Le modèle peut être remplacé sans changement de code

**Configuration:**
```bash
# Dans .env
BACKEND_OPENROUTER_API_KEY=your_openrouter_api_key_here
BACKEND_OPENROUTER_MODEL=qwen/qwen2.5-vl-72b-instruct:free
```

---

### 3. `gemini_analyzer.py` - Google Gemini Vision

Utilise **Google Gemini Vision API** pour analyser les emagrammes.

**Avantages:**
- ✅ **Gratuit**: 1500 requêtes/jour (plus que suffisant)
- ✅ **Rapide**: ~2-3s par analyse avec Gemini 2.0 Flash
- ✅ **Simple**: API REST standard, pas de setup complexe
- ✅ **Docker-friendly**: Fonctionne parfaitement en container
- ✅ **Fiable**: Service managé Google

**Configuration:**
```bash
# Dans .env
BACKEND_GOOGLE_API_KEY=your_google_api_key_here
BACKEND_GEMINI_MODEL=gemini-2.5-flash  # ou gemini-1.5-pro
```

**Utilisation:**
```python
from llm.gemini_analyzer import analyze_emagram_with_gemini

result = analyze_emagram_with_gemini(
    screenshot_paths=[...],
    spot_name="Arguel",
    coordinates=(47.2167, 6.0833),
    api_key=os.getenv("GOOGLE_API_KEY")
)
```

**Obtenir une clé API:**
1. Aller sur https://aistudio.google.com/app/apikey
2. Créer une clé API (compte Google requis)
3. Ajouter dans `.env`: `GOOGLE_API_KEY=...`

**Limites gratuites:**
- 1500 requêtes/jour
- Votre usage: ~48/jour (6 spots × 8 analyses)
- Marge confortable! 🎉

---

### 4. `vision_analyzer.py` - Wrapper générique

Module utilitaire pour fonctions communes de vision analysis.

---

## Ordre de préférence dans l'orchestrateur

Le fichier [`emagram_multi_source.py`](../emagram_multi_source.py) utilise la stratégie suivante:

```
1. Priority 1: Groq Llama Vision (si BACKEND_GROQ_API_KEY présente)
   └─> Gratuit, rapide

2. Priority 2: OpenRouter Vision (si BACKEND_OPENROUTER_API_KEY présente)
   └─> Fallback gratuit configurable

3. Priority 3: Google Gemini (si BACKEND_GOOGLE_API_KEY présente)
   └─> Dernier recours pour économiser le quota Gemini

4. Échec: Retour d'erreur
```

L'ordre est configurable avec `BACKEND_LLM_FALLBACK_ORDER`, par exemple `google,groq,openrouter` si la qualité Gemini doit primer sur l'économie de quota.

## Format de réponse

Tous les analyseurs retournent le même format JSON:

```json
{
  "plafond_thermique_m": 2800,
  "force_thermique_ms": 2.5,
  "heures_volables": "13h-18h",
  "score_volabilite": 75,
  "conseils_vol": "Bonne journée de vol thermique...",
  "alertes_securite": ["Vigilance cisaillement"],
  "details_analyse": "Consensus des 3 sources: ..."
}
```

## Tests

### Test d'intégration Gemini (Recommandé)

```bash
cd /home/capic/developements/dashboard-parapente
python backend/test_gemini_integration.py
```

### Test unitaire d'un analyseur

```bash
cd backend/llm

# Test Gemini
export GOOGLE_API_KEY=your_key
python gemini_analyzer.py

# Test Groq
export GROQ_API_KEY=your_key
python groq_analyzer.py
```

## Configuration recommandée

```bash
# .env
BACKEND_LLM_FALLBACK_ORDER=groq,openrouter,google
BACKEND_GROQ_API_KEY=your_groq_api_key_here
BACKEND_GROQ_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
BACKEND_OPENROUTER_API_KEY=your_openrouter_api_key_here
BACKEND_OPENROUTER_MODEL=qwen/qwen2.5-vl-72b-instruct:free
BACKEND_GOOGLE_API_KEY=your_google_api_key_here
BACKEND_GEMINI_MODEL=gemini-2.5-flash
```

## Dépannage

### Gemini retourne une erreur

```bash
# Vérifier la clé API
echo $BACKEND_GOOGLE_API_KEY

# Tester manuellement
curl -H "Content-Type: application/json" \
     -d '{"contents":[{"parts":[{"text":"test"}]}]}' \
     "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$BACKEND_GOOGLE_API_KEY"

# Vérifier les quotas
# https://aistudio.google.com/app/apikey
```

## Ressources

### Gemini
- **Get API Key**: https://aistudio.google.com/app/apikey
- **Gemini Docs**: https://ai.google.dev/gemini-api/docs
- **Python SDK**: https://github.com/google/generative-ai-python
- **Pricing**: https://ai.google.dev/pricing (Free tier: 1500 req/day)
