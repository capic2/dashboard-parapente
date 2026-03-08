# Intégration OpenClaw ACP pour l'Analyse d'Emagrammes

## Vue d'ensemble

Le système d'analyse d'emagrammes peut maintenant utiliser **OpenClaw via ACP (Agent Control Protocol)** pour analyser automatiquement les captures d'écran d'emagrammes.

### Avantages d'OpenClaw ACP

- ✅ **Gratuit**: Utilise votre installation OpenClaw locale (pas de frais API)
- ✅ **Vision AI**: Supporte Claude Vision, GPT-4o Vision, et autres modèles
- ✅ **Flexible**: Peut utiliser différents agents (claude, codex, gemini, etc.)
- ✅ **Fallback automatique**: Revient aux API directes si ACP échoue
- ✅ **Local-first**: Vos données restent sur votre machine

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Dashboard Parapente                       │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Emagram Scheduler (toutes les 3h)                   │   │
│  │  - Arguel, Mont Poupet, Champagnole, etc.            │   │
│  └────────────────┬─────────────────────────────────────┘   │
│                   │                                           │
│                   ▼                                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Screenshot Capture (Playwright)                      │   │
│  │  - Meteo-Parapente, TopMeteo, Windy                  │   │
│  └────────────────┬─────────────────────────────────────┘   │
│                   │                                           │
│                   ▼                                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ACP Analyzer                                         │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  1. Essayer OpenClaw ACP                       │  │   │
│  │  │     openclaw acp client --agent claude         │  │   │
│  │  │                                                 │  │   │
│  │  │  2. Fallback: API Anthropic directe            │  │   │
│  │  │     (si ANTHROPIC_API_KEY disponible)          │  │   │
│  │  │                                                 │  │   │
│  │  │  3. Fallback: OpenClaw proxy                   │  │   │
│  │  │     (si configuré)                              │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └────────────────┬─────────────────────────────────────┘   │
│                   │                                           │
│                   ▼                                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Database (emagram_analysis)                          │   │
│  │  - Plafond thermique, force, heures volables, etc.   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

                              ▲
                              │
                              │ ACP Protocol (stdio)
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                    OpenClaw Gateway                          │
│                  (ws://127.0.0.1:18789)                      │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Agent: claude, codex, gemini, pi, opencode...       │   │
│  │  - Claude Vision API                                  │   │
│  │  - GPT-4o Vision API                                  │   │
│  │  - Autres providers                                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Prérequis

### 1. Installer OpenClaw

```bash
# Installation globale
npm install -g openclaw@latest

# Ou avec pnpm
pnpm add -g openclaw@latest
```

### 2. Initialiser OpenClaw

```bash
# Wizard d'onboarding
openclaw onboard --install-daemon

# Le wizard vous guide pour:
# - Choisir votre provider (Anthropic, OpenAI, etc.)
# - Configurer les API keys
# - Installer le daemon (launchd/systemd)
```

### 3. Démarrer le Gateway

```bash
# Démarrage manuel
openclaw gateway --port 18789

# Ou via le daemon (recommandé)
openclaw gateway install
openclaw gateway restart
```

### 4. Vérifier le statut

```bash
openclaw status
# Runtime: running
# RPC probe: ok
```

## Configuration

### Dans `.env`

```bash
# ==========================================
# OpenClaw ACP Configuration
# ==========================================

# Activer OpenClaw ACP pour l'analyse d'emagrammes
OPENCLAW_ACP_ENABLED=true

# Commande openclaw (par défaut: openclaw)
# Utilisez le chemin complet si openclaw n'est pas dans PATH
OPENCLAW_COMMAND=openclaw

# Agent à utiliser (optionnel)
# Exemples: claude, codex, gemini, pi, opencode
# Laissez vide pour utiliser l'agent par défaut d'OpenClaw
OPENCLAW_AGENT_ID=claude

# Timeout d'analyse en secondes (défaut: 120)
OPENCLAW_TIMEOUT=120

# Gateway OpenClaw distant (optionnel)
# OPENCLAW_GATEWAY_URL=wss://gateway-host:18789
# OPENCLAW_GATEWAY_TOKEN=votre_token_ici
```

### Dans `openclaw.json` (optionnel)

Pour une configuration plus avancée, vous pouvez configurer OpenClaw directement:

```json
{
  "agent": {
    "model": "anthropic/claude-opus-4-6"
  },
  "acp": {
    "enabled": true,
    "backend": "acpx",
    "defaultAgent": "claude",
    "allowedAgents": ["claude", "codex", "gemini"],
    "maxConcurrentSessions": 8
  }
}
```

Voir: https://docs.openclaw.ai/gateway/configuration

## Utilisation

### Test de l'intégration

```bash
cd /home/capic/developements/dashboard-parapente
python backend/test_acp_integration.py
```

Ce script vérifie:
- ✅ openclaw est disponible
- ✅ Gateway OpenClaw est en cours d'exécution
- ✅ Création de screenshots de test
- ✅ Analyse via ACP
- ✅ Validation de la structure de réponse

### Analyse manuelle

```bash
# Via Python
cd backend
python3 -c "
from llm.acp_analyzer import analyze_emagram_with_acp

result = analyze_emagram_with_acp(
    screenshot_paths=[
        '/tmp/meteo_parapente.png',
        '/tmp/topmeteo.png',
        '/tmp/windy.png'
    ],
    spot_name='Arguel',
    coordinates=(47.2167, 6.0833)
)

import json
print(json.dumps(result, indent=2, ensure_ascii=False))
"
```

### Scheduler automatique

Le scheduler utilise automatiquement ACP si `OPENCLAW_ACP_ENABLED=true`:

```bash
# Lancer le scheduler
python backend/emagram_scheduler/emagram_scheduler.py

# Log output devrait montrer:
# 🦞 Trying OpenClaw ACP analysis...
# 🦞 OpenClaw ACP analysis successful!
```

## Format de réponse

L'analyseur ACP retourne un JSON structuré:

```json
{
  "plafond_thermique_m": 2800,
  "force_thermique_ms": 2.5,
  "heures_volables": "13h-18h",
  "score_volabilite": 75,
  "conseils_vol": "Bonne journée de vol thermique. Cumulus attendus vers 14h.",
  "alertes_securite": [
    "Vigilance sur le cisaillement en altitude"
  ],
  "details_analyse": "Consensus des 3 sources: Plafond stable à 2800m..."
}
```

## Agents disponibles

OpenClaw supporte plusieurs agents via ACP:

| Agent     | Provider      | Modèle recommandé           | Vision |
|-----------|---------------|------------------------------|--------|
| `claude`  | Anthropic     | claude-opus-4-6              | ✅     |
| `codex`   | OpenAI        | gpt-5.2                      | ✅     |
| `gemini`  | Google        | gemini-2.5-pro               | ✅     |
| `pi`      | Inflection    | pi-3                         | ❌     |
| `opencode`| GitHub        | github-copilot-gpt-4o        | ✅     |

Choisir un agent avec Vision pour l'analyse d'emagrammes.

## Dépannage

### ❌ `openclaw: command not found`

```bash
# Vérifier l'installation
npm list -g openclaw

# Réinstaller si nécessaire
npm install -g openclaw@latest

# Vérifier PATH
echo $PATH | grep -o "[^:]*npm[^:]*"
```

### ❌ Gateway non disponible

```bash
# Vérifier le statut
openclaw status

# Démarrer manuellement
openclaw gateway --port 18789 --verbose

# Ou installer le daemon
openclaw gateway install
```

### ❌ `AcpRuntimeError: Permission prompt unavailable`

L'agent ACP demande des permissions pour lire/écrire des fichiers. Configurer:

```bash
openclaw config set plugins.entries.acpx.config.permissionMode approve-all
openclaw gateway restart
```

### ❌ Timeout après 120s

Augmenter le timeout dans `.env`:

```bash
OPENCLAW_TIMEOUT=300
```

### ⚠️ Fallback vers API directe

Si ACP échoue, le système utilise automatiquement l'API Anthropic directe (si `ANTHROPIC_API_KEY` est configurée).

Logs typiques:
```
🦞 Trying OpenClaw ACP analysis...
WARNING: OpenClaw ACP failed, falling back to direct API: ...
🤖 Using direct LLM API...
```

## Avantages vs API directe

| Critère              | OpenClaw ACP                  | API Anthropic directe     |
|----------------------|-------------------------------|---------------------------|
| **Coût**             | ✅ Gratuit (local)            | ❌ ~50€/mois              |
| **Confidentialité**  | ✅ Données locales            | ⚠️ Envoyé à Anthropic     |
| **Flexibilité**      | ✅ Multi-providers            | ❌ Anthropic uniquement   |
| **Complexité**       | ⚠️ Nécessite OpenClaw         | ✅ API REST simple        |
| **Fiabilité**        | ⚠️ Dépend du gateway local    | ✅ Service managé         |

## Limitations connues

1. **Taille d'images**: ACP peut avoir des limites de taille d'entrée stdin. Pour de grandes images, préférer l'API directe.

2. **Timeout**: Les analyses complexes peuvent prendre >60s. Ajuster `OPENCLAW_TIMEOUT`.

3. **Concurrent sessions**: OpenClaw limite le nombre de sessions ACP simultanées (`acp.maxConcurrentSessions`).

4. **Pas de batch**: ACP traite une analyse à la fois (pas de batch comme l'API Messages).

## Ressources

- **OpenClaw Docs**: https://docs.openclaw.ai
- **ACP Spec**: https://agentclientprotocol.com
- **OpenClaw GitHub**: https://github.com/openclaw/openclaw
- **ACP CLI Reference**: https://docs.openclaw.ai/cli/acp

## Prochaines étapes

1. ✅ Intégration ACP implémentée
2. ⏳ Tester avec screenshots réels
3. ⏳ Optimiser le prompt pour meilleurs résultats
4. ⏳ Ajouter support d'images base64 dans ACP (si nécessaire)
5. ⏳ Dashboard UI pour afficher les analyses

## Support

Pour des questions ou problèmes:

1. Vérifier les logs: `openclaw logs --follow`
2. Exécuter diagnostics: `openclaw doctor`
3. Tester ACP manuellement: `openclaw acp client`
4. Consulter la doc: https://docs.openclaw.ai/tools/acp-agents
