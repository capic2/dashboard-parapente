# 🤝 Contributing / Contribuer

> **Guidelines for contributing to Dashboard Parapente**  
> **Lignes directrices pour contribuer à Dashboard Parapente**

---

## 🇬🇧 English Version

### We Welcome Contributions!

Thank you for your interest in improving Dashboard Parapente. All contributions are welcome:

- 🐛 Bug reports and fixes
- ✨ New features
- 📝 Documentation improvements
- 🧪 Test coverage
- 🎨 UI/UX enhancements
- 🌍 Translations

### Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork**: `git clone https://github.com/YOUR_USERNAME/dashboard-parapente.git`
3. **Create a branch**: `git checkout -b feature/your-feature-name`
4. **Set up development environment**: See [DEVELOPMENT.md](DEVELOPMENT.md)

### Code Standards

#### Python (Backend)

- **Style**: Follow PEP 8
- **Type hints**: Use type annotations
- **Docstrings**: Google-style docstrings for functions
- **Linting**: Run `flake8` before committing
- **Testing**: Write tests with `pytest`

```python
# Example
def calculate_para_index(wind_speed: float, wind_direction: str) -> int:
    """
    Calculate Para-Index score based on wind conditions.

    Args:
        wind_speed: Wind speed in km/h
        wind_direction: Wind direction (N, NE, E, etc.)

    Returns:
        Para-Index score (0-100)
    """
    # Implementation...
```

#### TypeScript/React (Frontend)

- **Style**: Functional components with hooks
- **Types**: Strict TypeScript, no `any`
- **Components**: One component per file
- **Naming**: PascalCase for components, camelCase for functions
- **Linting**: Run `pnpm run lint` before committing
- **Testing**: Write tests with Vitest + Testing Library

```typescript
// Example
interface WeatherData {
  temperature: number;
  windSpeed: number;
  windDirection: string;
}

export function WeatherWidget({ data }: { data: WeatherData }) {
  // Implementation...
}
```

### Commit Message Format

Use conventional commits format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(weather): add Windy.com data source
fix(cache): resolve Redis connection timeout
docs(readme): update installation instructions
```

### Pull Request Process

1. **Update tests**: Ensure all tests pass
2. **Update documentation**: If you changed functionality
3. **Run linters**: `flake8` (backend), `pnpm run lint` (frontend)
4. **Type check**: `pnpm run type-check` (frontend)
5. **Create PR** with clear description:
   - What problem does it solve?
   - How did you test it?
   - Screenshots (for UI changes)
6. **Wait for review**: Maintainers will review and provide feedback
7. **Address feedback**: Make requested changes
8. **Merge**: Once approved, your PR will be merged!

### Testing Guidelines

#### Backend Tests

```bash
cd backend
pytest                    # Run all tests
pytest -v                 # Verbose output
pytest tests/test_cache.py  # Specific test file
pytest --cov              # Coverage report
```

Write tests for:

- New scrapers
- API endpoints
- Cache logic
- Weather calculations

#### Frontend Tests

```bash
cd frontend
pnpm run test              # Run all tests
pnpm run test:watch        # Watch mode
pnpm run test:coverage     # Coverage report
```

Write tests for:

- React components
- Custom hooks
- Utility functions
- API integration

### Documentation

When adding features:

- Update `USER_GUIDE.md` for user-facing changes
- Update `DEVELOPMENT.md` for developer workflow changes
- Add JSDoc/docstrings for new functions
- Update API documentation if endpoints changed

### Reporting Bugs

Open an issue with:

- **Clear title**: Summarize the problem
- **Description**: What happened vs. what you expected
- **Steps to reproduce**: Detailed steps
- **Environment**: OS, Python version, Node version
- **Screenshots**: If applicable
- **Error logs**: Full stack traces

### Suggesting Features

Open an issue with:

- **Use case**: Why is this needed?
- **Proposed solution**: How should it work?
- **Alternatives**: Other approaches considered
- **Mockups**: UI sketches if applicable

### Code Review Process

Maintainers will review for:

- ✅ Code quality and style
- ✅ Test coverage
- ✅ Documentation completeness
- ✅ Performance impact
- ✅ Security considerations
- ✅ Breaking changes

### Community Guidelines

- Be respectful and constructive
- Help newcomers get started
- Give credit where due
- Follow the code of conduct

---

## 🇫🇷 Version Française

### Nous Accueillons les Contributions !

Merci de votre intérêt pour améliorer Dashboard Parapente. Toutes les contributions sont bienvenues :

- 🐛 Rapports et corrections de bugs
- ✨ Nouvelles fonctionnalités
- 📝 Améliorations de documentation
- 🧪 Couverture de tests
- 🎨 Améliorations UI/UX
- 🌍 Traductions

### Démarrer

1. **Forker le dépôt** sur GitHub
2. **Cloner votre fork** : `git clone https://github.com/VOTRE_NOM/dashboard-parapente.git`
3. **Créer une branche** : `git checkout -b feature/nom-de-votre-feature`
4. **Configurer l'environnement de dev** : Voir [DEVELOPMENT.md](DEVELOPMENT.md)

### Standards de Code

#### Python (Backend)

- **Style** : Suivre PEP 8
- **Type hints** : Utiliser les annotations de type
- **Docstrings** : Docstrings style Google pour les fonctions
- **Linting** : Lancer `flake8` avant de commit
- **Tests** : Écrire des tests avec `pytest`

```python
# Exemple
def calculate_para_index(wind_speed: float, wind_direction: str) -> int:
    """
    Calcule le score Para-Index basé sur les conditions de vent.

    Args:
        wind_speed: Vitesse du vent en km/h
        wind_direction: Direction du vent (N, NE, E, etc.)

    Returns:
        Score Para-Index (0-100)
    """
    # Implémentation...
```

#### TypeScript/React (Frontend)

- **Style** : Composants fonctionnels avec hooks
- **Types** : TypeScript strict, pas de `any`
- **Composants** : Un composant par fichier
- **Nommage** : PascalCase pour composants, camelCase pour fonctions
- **Linting** : Lancer `pnpm run lint` avant de commit
- **Tests** : Écrire des tests avec Vitest + Testing Library

```typescript
// Exemple
interface WeatherData {
  temperature: number;
  windSpeed: number;
  windDirection: string;
}

export function WeatherWidget({ data }: { data: WeatherData }) {
  // Implémentation...
}
```

### Format des Messages de Commit

Utiliser le format conventional commits :

```
<type>(<scope>): <description>

[corps optionnel]

[pied de page optionnel]
```

**Types :**

- `feat` : Nouvelle fonctionnalité
- `fix` : Correction de bug
- `docs` : Documentation uniquement
- `style` : Changements de style (formatage, pas de logique)
- `refactor` : Refactorisation de code
- `test` : Ajout ou mise à jour de tests
- `chore` : Tâches de maintenance

**Exemples :**

```
feat(weather): ajout source données Windy.com
fix(cache): résout timeout connexion Redis
docs(readme): mise à jour instructions installation
```

### Processus de Pull Request

1. **Mettre à jour les tests** : S'assurer que tous les tests passent
2. **Mettre à jour la documentation** : Si vous avez changé des fonctionnalités
3. **Lancer les linters** : `flake8` (backend), `pnpm run lint` (frontend)
4. **Vérification des types** : `pnpm run type-check` (frontend)
5. **Créer une PR** avec description claire :
   - Quel problème résout-elle ?
   - Comment l'avez-vous testée ?
   - Captures d'écran (pour changements UI)
6. **Attendre la review** : Les mainteneurs réviseront et donneront feedback
7. **Traiter le feedback** : Faire les changements demandés
8. **Merge** : Une fois approuvée, votre PR sera fusionnée !

### Directives de Tests

#### Tests Backend

```bash
cd backend
pytest                    # Lancer tous les tests
pytest -v                 # Sortie verbose
pytest tests/test_cache.py  # Fichier de test spécifique
pytest --cov              # Rapport de couverture
```

Écrire des tests pour :

- Nouveaux scrapers
- Endpoints API
- Logique de cache
- Calculs météo

#### Tests Frontend

```bash
cd frontend
pnpm run test              # Lancer tous les tests
pnpm run test:watch        # Mode watch
pnpm run test:coverage     # Rapport de couverture
```

Écrire des tests pour :

- Composants React
- Hooks personnalisés
- Fonctions utilitaires
- Intégration API

### Documentation

Lors de l'ajout de fonctionnalités :

- Mettre à jour `USER_GUIDE.md` pour changements côté utilisateur
- Mettre à jour `DEVELOPMENT.md` pour changements workflow développeur
- Ajouter JSDoc/docstrings pour nouvelles fonctions
- Mettre à jour doc API si endpoints changés

### Rapporter des Bugs

Ouvrir une issue avec :

- **Titre clair** : Résumer le problème
- **Description** : Ce qui s'est passé vs. ce qui était attendu
- **Étapes de reproduction** : Étapes détaillées
- **Environnement** : OS, version Python, version Node
- **Captures d'écran** : Si applicable
- **Logs d'erreur** : Stack traces complètes

### Suggérer des Fonctionnalités

Ouvrir une issue avec :

- **Cas d'usage** : Pourquoi est-ce nécessaire ?
- **Solution proposée** : Comment devrait-elle fonctionner ?
- **Alternatives** : Autres approches considérées
- **Maquettes** : Esquisses UI si applicable

### Processus de Code Review

Les mainteneurs réviseront pour :

- ✅ Qualité et style du code
- ✅ Couverture de tests
- ✅ Complétude de la documentation
- ✅ Impact sur les performances
- ✅ Considérations de sécurité
- ✅ Changements cassants

### Directives Communautaires

- Être respectueux et constructif
- Aider les nouveaux à démarrer
- Donner crédit où c'est dû
- Suivre le code de conduite

---

**Thank you for contributing! / Merci de contribuer ! 🙏**
