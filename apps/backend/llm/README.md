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

### 2. `openrouter_analyzer.py` - OpenRouter Vision (fallbacks gratuits)

Utilise **OpenRouter** avec une file de modèles vision gratuits configurables.

**Avantages:**
- ✅ Donne accès à plusieurs modèles vision via une API compatible OpenAI
- ✅ Tente plusieurs modèles `:free` avant de consommer le quota Gemini
- ✅ Les modèles peuvent être remplacés sans changement de code

**Configuration:**
```bash
# Dans .env
BACKEND_OPENROUTER_API_KEY=your_openrouter_api_key_here
BACKEND_OPENROUTER_MODEL=qwen/qwen2.5-vl-72b-instruct:free
BACKEND_OPENROUTER_MODELS=qwen/qwen2.5-vl-72b-instruct:free,google/gemini-2.0-flash-exp:free,mistralai/mistral-small-3.2-24b-instruct:free
```

---

### 3. `openai_compatible_vision_analyzer.py` - Providers OpenAI-compatibles

Client générique pour ajouter des endpoints compatibles Chat Completions avec images.

Providers configurés:
- GitHub Models: quota gratuit limité selon compte GitHub.
- Hugging Face Router: dépend du modèle et du quota/token Hugging Face.
- Custom OpenAI-compatible: endpoint libre pour ajouter un provider sans changement de code.

**Configuration:**
```bash
BACKEND_GITHUB_MODELS_API_KEY=your_github_token_here
BACKEND_GITHUB_MODELS_BASE_URL=https://models.github.ai/inference/v1/chat/completions
BACKEND_GITHUB_MODELS_MODELS=openai/gpt-4o-mini

BACKEND_HUGGINGFACE_API_KEY=your_huggingface_token_here
BACKEND_HUGGINGFACE_BASE_URL=https://router.huggingface.co/v1/chat/completions
BACKEND_HUGGINGFACE_MODELS=Qwen/Qwen2.5-VL-7B-Instruct

BACKEND_CUSTOM_OPENAI_API_KEY=your_custom_openai_key_here
BACKEND_CUSTOM_OPENAI_BASE_URL=https://example.com/v1/chat/completions
BACKEND_CUSTOM_OPENAI_MODELS=your/provider-vision-model
```

---

### 4. `gemini_analyzer.py` - Google Gemini Vision

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
    api_key=os.getenv("BACKEND_GOOGLE_API_KEY")
)
```

**Obtenir une clé API:**
1. Aller sur https://aistudio.google.com/app/apikey
2. Créer une clé API (compte Google requis)
3. Ajouter dans `.env`: `BACKEND_GOOGLE_API_KEY=...`

**Limites gratuites:**
- 1500 requêtes/jour
- Votre usage: ~48/jour (6 spots × 8 analyses)
- Marge confortable! 🎉

---

### 5. Cooldown quota/rate-limit

Quand un couple provider/modèle retourne un quota ou rate-limit, il est placé en cooldown mémoire pour éviter de retenter le même modèle à chaque spot.

```bash
BACKEND_LLM_QUOTA_COOLDOWN_SECONDS=3600
```

Mettre `0` désactive le cooldown.

---

### 6. `vision_analyzer.py` - Wrapper générique

Module utilitaire pour fonctions communes de vision analysis.

---

## Ordre de préférence dans l'orchestrateur

Le fichier [`emagram_multi_source.py`](../emagram_multi_source.py) utilise la stratégie suivante:

```
1. Priority 1: Groq Llama Vision (si BACKEND_GROQ_API_KEY présente)
   └─> Gratuit, rapide

2. Priority 2: OpenRouter Vision (si BACKEND_OPENROUTER_API_KEY présente)
   └─> Plusieurs modèles gratuits configurés par BACKEND_OPENROUTER_MODELS

3. Priority 3: GitHub Models (si BACKEND_GITHUB_MODELS_API_KEY présente)
   └─> Fallback OpenAI-compatible avec quota gratuit limité

4. Priority 4: Hugging Face Router (si BACKEND_HUGGINGFACE_API_KEY présente)
   └─> Fallback OpenAI-compatible configurable

5. Priority 5: Google Gemini (si BACKEND_GOOGLE_API_KEY présente)
   └─> Dernier recours fiable

6. Priority 6: Custom OpenAI-compatible (si configuré)
   └─> Endpoint libre pour ajouter un autre provider sans code

7. Échec: Retour d'erreur
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
export BACKEND_GOOGLE_API_KEY=your_key
python gemini_analyzer.py

# Test Groq
export BACKEND_GROQ_API_KEY=your_key
python groq_analyzer.py
```

## Configuration recommandée

```bash
# .env
BACKEND_LLM_FALLBACK_ORDER=groq,openrouter,github_models,huggingface,google,custom_openai
BACKEND_LLM_QUOTA_COOLDOWN_SECONDS=3600
BACKEND_GROQ_API_KEY=your_groq_api_key_here
BACKEND_GROQ_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
BACKEND_OPENROUTER_API_KEY=your_openrouter_api_key_here
BACKEND_OPENROUTER_MODEL=qwen/qwen2.5-vl-72b-instruct:free
BACKEND_OPENROUTER_MODELS=qwen/qwen2.5-vl-72b-instruct:free,google/gemini-2.0-flash-exp:free,mistralai/mistral-small-3.2-24b-instruct:free
BACKEND_GITHUB_MODELS_API_KEY=your_github_token_here
BACKEND_GITHUB_MODELS_MODELS=openai/gpt-4o-mini
BACKEND_HUGGINGFACE_API_KEY=your_huggingface_token_here
BACKEND_HUGGINGFACE_MODELS=Qwen/Qwen2.5-VL-7B-Instruct
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
