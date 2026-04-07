# Analyseurs LLM pour Emagrammes

Ce répertoire contient les analyseurs qui utilisent des modèles de langage avec vision pour analyser des captures d'écran d'emagrammes.

## Analyseurs disponibles

### 1. `gemini_analyzer.py` - Google Gemini Vision (Recommandé) ✨

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
GOOGLE_API_KEY=your_google_api_key_here
GEMINI_MODEL=gemini-2.5-flash  # ou gemini-1.5-pro
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

### 2. `groq_analyzer.py` - Groq Llama Vision (Gratuit)

Utilise **Groq** avec Llama Vision pour analyser les emagrammes.

**Avantages:**
- ✅ Gratuit
- ✅ Rapide (inférence Groq)

**Configuration:**
```bash
# Dans .env
GROQ_API_KEY=your_groq_api_key_here
```

---

### 3. `multi_emagram_analyzer.py` - API Anthropic directe

Utilise l'**API Claude Messages** d'Anthropic directement.

**Avantages:**
- ✅ API REST simple
- ✅ Service managé (fiable)
- ✅ Batch processing possible

**Inconvénients:**
- ❌ Coût: ~50€/mois pour 6 spots × 8 analyses/jour
- ❌ Nécessite crédit API Anthropic

**Configuration:**
```bash
# Dans .env
ANTHROPIC_API_KEY=sk-ant-api03-...
```

---

### 4. `vision_analyzer.py` - Wrapper générique

Module utilitaire pour fonctions communes de vision analysis.

---

## Ordre de préférence dans l'orchestrateur

Le fichier [`emagram_multi_source.py`](../emagram_multi_source.py) utilise la stratégie suivante:

```
1. Priority 1: Google Gemini (si GOOGLE_API_KEY présente)
   └─> Gratuit (1500/jour), rapide, Docker-friendly ✨

2. Priority 2: Groq Llama Vision (si GROQ_API_KEY présente)
   └─> Gratuit, rapide

3. Priority 3: API Anthropic directe (si ANTHROPIC_API_KEY présente)
   └─> Payant (~50€/mois) mais très haute qualité

4. Échec: Retour d'erreur
```

**Recommandation production**: Utiliser **Gemini** (Priority 1) avec **Groq** en fallback.

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

# Test API directe
python multi_emagram_analyzer.py
```

## Configuration recommandée

```bash
# .env
GOOGLE_API_KEY=your_google_api_key_here
GEMINI_MODEL=gemini-2.5-flash
GROQ_API_KEY=your_groq_api_key_here  # fallback gratuit
ANTHROPIC_API_KEY=your_anthropic_key_here  # fallback payant (optionnel)
```

## Dépannage

### Gemini retourne une erreur

```bash
# Vérifier la clé API
echo $GOOGLE_API_KEY

# Tester manuellement
curl -H "Content-Type: application/json" \
     -d '{"contents":[{"parts":[{"text":"test"}]}]}' \
     "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$GOOGLE_API_KEY"

# Vérifier les quotas
# https://aistudio.google.com/app/apikey
```

### API Anthropic retourne 401

```bash
# Vérifier la clé API
echo $ANTHROPIC_API_KEY

# Vérifier le solde
curl -H "x-api-key: $ANTHROPIC_API_KEY" \
     -H "anthropic-version: 2023-06-01" \
     https://api.anthropic.com/v1/messages
```

## Ressources

### Gemini
- **Get API Key**: https://aistudio.google.com/app/apikey
- **Gemini Docs**: https://ai.google.dev/gemini-api/docs
- **Python SDK**: https://github.com/google/generative-ai-python
- **Pricing**: https://ai.google.dev/pricing (Free tier: 1500 req/day)

### Anthropic
- **Anthropic API**: https://docs.anthropic.com
- **Pricing**: https://www.anthropic.com/pricing
