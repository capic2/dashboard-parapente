# AGENTS - Frontend

Ce fichier definit les regles frontend pour `apps/frontend`.

## Portee

- S'applique a tout fichier sous `apps/frontend/**`.
- Herite de `AGENTS.md` racine. En cas de conflit, ce fichier est prioritaire.

## Data fetching et routing

- Utiliser en priorite TanStack Router avec loaders.
- Utiliser React Query pour cache, sync et etat serveur.
- Eviter les fetchs ad hoc dans les composants si un loader + query convient.

## Storybook

- Creer les stories en CSF Factory.
- Ajouter un fichier `*.test.ts` ou `*.test.tsx` quand un comportement doit etre teste.
- Garder les stories focalisees sur des etats/variantes clairs et reproductibles.

## Chromatic

- Maintenir `apps/frontend/chromatic.config.json` a jour quand des stories sont ajoutees ou restructurees.
- Verifier que les nouvelles stories sont bien incluses dans le workflow Chromatic.

## Qualite minimale

- Respecter TypeScript strict et regles `oxlint`/`oxfmt` du repo.
- Commandes recommandees:
  - `pnpm nx lint frontend`
  - `pnpm nx test frontend`
  - `pnpm nx build frontend`
