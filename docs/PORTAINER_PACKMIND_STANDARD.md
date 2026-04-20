# Standard Packmind - Interaction Portainer

Ce standard definit comment un agent (ou un humain) interagit avec Portainer de facon securisee et reproductible.

## 1) Objectif

- Centraliser les bonnes pratiques pour lire et modifier les stacks Portainer.
- Eviter les manipulations manuelles risquees.
- Garantir la tracabilite des changements (variables, redeploy, validation).

## 2) Secrets et variables requis

Ces valeurs doivent etre injectees en secrets (CI/CD ou environnement local securise), jamais en dur dans le repo.

- `PORTAINER_URL`: URL Portainer (ex: `https://portainer.example.com`)
- `PORTAINER_API_TOKEN`: token API Portainer
- `PORTAINER_ENDPOINT_ID`: ID de l'endpoint Docker
- `PORTAINER_STACK_ID`: ID numerique de la stack cible

Optionnel:

- `PORTAINER_STACK_NAME`: nom de la stack (utile pour logs)

## 2.1) Contrat d'execution (important)

Un standard seul ne lit pas automatiquement les secrets. Pour qu'un agent ou un script les utilise de facon fiable:

- Charger les secrets avant toute commande Portainer.
- Valider explicitement les variables requises.
- Echouer immediatement si une variable manque.

Le projet fournit un helper: `scripts/portainer/portainer-env.sh`.

Exemple:

```bash
source scripts/portainer/portainer-env.sh
curl -fsS \
  -H "X-API-Key: $PORTAINER_API_TOKEN" \
  "$PORTAINER_URL/api/stacks/$PORTAINER_STACK_ID?endpointId=$PORTAINER_ENDPOINT_ID"
```

## 3) Regles de securite

- Toujours utiliser HTTPS pour `PORTAINER_URL`.
- Token avec privileges minimaux (least privilege).
- Rotation du token periodique (ex: 90 jours).
- Ne jamais afficher le token dans les logs (`set +x` dans les scripts shell).
- Ne jamais committer `.env.portainer` ni credentials.

## 4) Workflow standard (lecture -> changement -> verification)

### 4.1 Lire la stack

```bash
curl -fsS \
  -H "X-API-Key: $PORTAINER_API_TOKEN" \
  "$PORTAINER_URL/api/stacks/$PORTAINER_STACK_ID?endpointId=$PORTAINER_ENDPOINT_ID"
```

### 4.2 Mettre a jour des variables d'environnement

Principe recommande:

1. Recuperer la definition actuelle de la stack.
2. Appliquer un patch sur les variables (ajout/suppression/modification).
3. Redeployer la stack avec la definition mise a jour.

Exemple de suppression d'une variable obsolete dans le compose de stack:

```bash
sed -i '/BACKEND_UNUSED_API_KEY/d' docker-compose.yml
```

Si votre workflow utilise le webhook Portainer de stack:

```bash
curl -fsS -X POST "$PORTAINER_WEBHOOK_URL"
```

## 5) Procedure agent (checklist)

Avant changement:

- Verifier la stack cible (`PORTAINER_STACK_ID`, endpoint, environnement).
- Verifier l'impact (variables retirees/ajoutees, services touches).

Pendant changement:

- Appliquer un seul changement logique a la fois.
- Conserver un log d'action (horodatage, action, cible, resultat).

Apres changement:

- Verifier que la stack est `running`.
- Verifier les logs backend (pas d'erreur de variable manquante).
- Verifier endpoint de sante applicative (ex: `/health`).

## 6) Verification minimale post-deploiement

- Healthcheck des conteneurs OK.
- API backend repond (`2xx`) sur les routes critiques.
- Dashboard frontend charge sans erreur bloquante.
- Metriques (si actives) disponibles.

## 7) Rollback

En cas d'echec:

- Restaurer le compose precedent (version git/tag precedente).
- Redeployer immediatement via webhook/API Portainer.
- Confirmer le retour a l'etat sain (health + logs).

## 8) Bonnes pratiques CI/CD

- Stocker `PORTAINER_API_TOKEN` et `PORTAINER_WEBHOOK_URL` dans les secrets CI.
- Interdire toute execution de deploy sans secrets presents.
- Ajouter un garde-fou: blocage si variable sensible est vide et obligatoire.

## 9) Exemple de gabarit de runbook

```text
Contexte: <raison du changement>
Stack: <nom/id>
Endpoint: <id>
Changement: <ajout/suppression/modif variable>
Validation: <checks effectues>
Resultat: <success/rollback>
```

## 10) Convention projet

Pour ce projet, la source de verite de la stack est `docker-compose.yml` a la racine.
Portainer doit etre aligne avec cette definition et non l'inverse.
