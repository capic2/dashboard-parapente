# AGENTS - Backend

Ce fichier definit les regles backend pour `apps/backend`.

## Portee

- S'applique a tout fichier sous `apps/backend/**`.
- Herite de `AGENTS.md` racine. En cas de conflit, ce fichier est prioritaire.

## Stack et style

- Python `>=3.12` avec typage explicite sur nouvelles fonctions.
- Respecter les regles definies dans `apps/backend/pyproject.toml` (Ruff, Black, Pytest).
- Eviter la duplication de logique: preferer des fonctions/services reutilisables.

## FastAPI

- Garder une separation claire: routes, schemas, logique metier, acces donnees.
- Valider les IO API avec schemas Pydantic.
- Gerer les erreurs de facon explicite (codes HTTP coherents, messages actionnables).

## Base de donnees

- Suivre les patterns SQLAlchemy deja en place.
- Eviter les changements schema implicites: utiliser scripts/migrations dedies si necessaire.

## Tests et validation

- Tout nouveau comportement metier ou correction de bug doit avoir un test pytest.
- Utiliser des tests cibles quand possible pour accelerer la boucle.
- Commandes recommandees:
  - `pnpm nx lint backend`
  - `pnpm nx test backend`

## Hors scope

- Ne pas ajouter de regles frontend ici.
- Pour les conventions UI/data fetching frontend, voir `apps/frontend/AGENTS.md`.
