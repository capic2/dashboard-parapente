# Analyseurs LLM pour Emagrammes

Ce répertoire contient les analyseurs qui utilisent des modèles de langage avec vision pour analyser des captures d'écran d'emagrammes.

## Analyseurs disponibles

### 1. `acp_analyzer.py` - OpenClaw ACP (Recommandé) ✨

Utilise **OpenClaw via Agent Control Protocol** pour analyser les emagrammes.

**Avantages:**
- ✅ Gratuit (utilise votre installation OpenClaw locale)
- ✅ Supporte Claude Vision, GPT-4o Vision, etc.
- ✅ Flexible (plusieurs agents disponibles)
- ✅ Local-first (données restent sur votre machine)

**Configuration:**
```bash
# Dans .env
OPENCLAW_ACP_ENABLED=true
OPENCLAW_COMMAND=openclaw
OPENCLAW_AGENT_ID=claude  # ou codex, gemini, etc.
OPENCLAW_TIMEOUT=120
```

**Utilisation:**
```python
from llm.acp_analyzer import analyze_emagram_with_acp

result = analyze_emagram_with_acp(
    screenshot_paths=[...],
    spot_name="Arguel",
    coordinates=(47.2167, 6.0833)
)
```

**Prérequis:**
- OpenClaw installé: `npm install -g openclaw`
- Gateway en cours d'exécution: `openclaw gateway --port 18789`

Voir: [`docs/OPENCLAW_ACP_INTEGRATION.md`](../../docs/OPENCLAW_ACP_INTEGRATION.md)

---

### 2. `multi_emagram_analyzer.py` - API Anthropic directe

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

**Utilisation:**
```python
from llm.multi_emagram_analyzer import analyze_emagrammes_with_fallback

result = await analyze_emagrammes_with_fallback(
    image_paths=[...],
    spot_name="Arguel",
    sources=["meteo-parapente", "topmeteo", "windy"]
)
```

---

### 3. `openclaw_analyzer.py` - OpenClaw Gateway Proxy (Alternative)

Utilise OpenClaw comme **proxy vers l'API Anthropic** (via WebSocket).

**Note:** Similaire à l'API directe mais via OpenClaw Gateway. Utile si vous voulez centraliser vos appels API via OpenClaw.

**Configuration:**
```bash
# Dans .env
OPENCLAW_BASE_URL=http://192.168.1.106:3000
OPENCLAW_API_KEY=your_key
```

---

### 4. `vision_analyzer.py` - Wrapper générique

Module utilitaire pour fonctions communes de vision analysis.

---

## Ordre de préférence dans l'orchestrateur

Le fichier [`emagram_multi_source.py`](../emagram_multi_source.py) utilise la stratégie suivante:

```
1. Essayer OpenClaw ACP (si OPENCLAW_ACP_ENABLED=true)
   └─> Gratuit, local, flexible
   
2. Fallback: API Anthropic directe (si ANTHROPIC_API_KEY présente)
   └─> Payant mais fiable
   
3. Fallback: OpenClaw Proxy (si configuré)
   └─> Alternative à l'API directe
   
4. Échec: Retour d'erreur
```

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

### Test d'intégration complet

```bash
cd /home/capic/developements/dashboard-parapente
python backend/test_acp_integration.py
```

### Test unitaire d'un analyseur

```bash
cd backend/llm

# Test ACP
python acp_analyzer.py

# Test API directe
python multi_emagram_analyzer.py
```

## Configuration recommandée

Pour un usage local gratuit:

```bash
# .env
OPENCLAW_ACP_ENABLED=true
OPENCLAW_AGENT_ID=claude
OPENCLAW_TIMEOUT=120

# Optionnel: API directe en fallback
ANTHROPIC_API_KEY=sk-ant-api03-...
```

Pour un usage production avec API managée:

```bash
# .env
OPENCLAW_ACP_ENABLED=false
ANTHROPIC_API_KEY=sk-ant-api03-...
```

## Dépannage

### ACP ne fonctionne pas

```bash
# Vérifier OpenClaw
openclaw status

# Démarrer le gateway
openclaw gateway --port 18789

# Voir les logs
openclaw logs --follow

# Diagnostics
openclaw doctor
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

### Timeout après 120s

```bash
# Augmenter le timeout
export OPENCLAW_TIMEOUT=300
```

## Ressources

- **OpenClaw Docs**: https://docs.openclaw.ai
- **Anthropic API**: https://docs.anthropic.com
- **ACP Spec**: https://agentclientprotocol.com
- **Integration Guide**: [`docs/OPENCLAW_ACP_INTEGRATION.md`](../../docs/OPENCLAW_ACP_INTEGRATION.md)
