# AGENTS - Regles globales

Ce fichier definit les regles globales pour tout le monorepo.

## Hierarchie des regles

1. Le fichier `AGENTS.md` le plus proche du code modifie est prioritaire.
2. En cas de conflit, la regle locale remplace la regle parent.
3. Les regles globales restent actives si elles ne sont pas surchargees localement.

## Portee

- Monorepo Nx: `apps/*` et `libs/*`.
- Ce fichier couvre les regles transverses (git, securite, qualite, workflow).

## Workflow

- Toujours limiter les changements au besoin de la tache.
- Respecter les conventions deja en place avant de proposer un nouveau pattern.
- Ne jamais modifier des fichiers hors scope sans raison explicite.

## Git

- Ne pas utiliser de commandes destructives (`reset --hard`, `checkout --`, etc.).
- Faire des commits petits et explicites.
- Utiliser Conventional Commits quand un commit est demande.

## Securite

- Ne jamais commiter de secrets (`.env`, cles API, tokens, credentials).
- Ne jamais exposer de valeurs sensibles dans logs, tests, docs, ou stories.

## Qualite minimale

- Linter et tests cibles sur les projets touches via Nx.
- Commandes usuelles:
  - `pnpm lint`
  - `pnpm test`
  - ou commandes cibles: `pnpm nx lint <project>`, `pnpm nx test <project>`

## Regles locales

- Backend: voir `apps/backend/AGENTS.md`.
- Frontend: voir `apps/frontend/AGENTS.md`.
