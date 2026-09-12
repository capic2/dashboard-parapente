# PR staging

Une seule instance de staging partagée peut recevoir, à la demande, le contenu d'une PR.

Deux déclencheurs sont disponibles :

- ajouter le label GitHub `deploy-staging` à une PR ;
- ou ouvrir `Actions → Deploy PR staging → Run workflow`, saisir le numéro de PR, puis lancer le workflow.

Le label `deploy-staging` est exclusif : lorsqu'il est ajouté à une PR, le workflow le retire automatiquement des autres PR ouvertes.

Le workflow `.github/workflows/deploy-staging.yml` :

- construit ou remplace l'image GHCR taguée `staging` ;
- crée ou met à jour l'unique stack `dashboard-parapente-staging` ;
- expose l'application publiquement via `STAGING_PUBLIC_URL` ;
- publie l'URL dans un commentaire de la PR ;
- remplace le contenu du staging précédent, sans créer de nouvel environnement.
- arrête les conteneurs lorsque la PR actuellement déployée est fusionnée ; si une autre PR a été déployée entre-temps, le staging reste actif.

Aucun déploiement n'est déclenché lors de la création ou de la mise à jour d'une PR. Pour tester un nouveau commit, relancer manuellement le workflow ou retirer puis remettre le label `deploy-staging`.

## Préparation du serveur

Créer un dossier par exemple `/home/capic/docker-data/dashboard-parapente-staging`, puis un fichier `/home/capic/docker-data/dashboard-parapente-staging/stack.env` (le workflow ne crée pas de secrets). Ce dossier est réutilisé par toutes les PR et ne doit donc pas être suffixé par un numéro de PR. Le fichier doit contenir les variables requises par `docker-compose.yml`, notamment la base SQLite, les tokens backend, `GOPRO_OVERLAY_DATA_HOST_DIR` et `BACKEND_VERSION_STATE_FILE=/app/db/version_state.json`.

Le serveur doit disposer de Docker Compose, d'un accès sortant à GHCR et d'un chemin `GOPRO_OVERLAY_DATA_HOST_DIR` lisible par les conteneurs. Le port local `18001` doit être publié par un reverse proxy HTTPS ou rendu accessible par le pare-feu/NAT. La méthode recommandée est un sous-domaine tel que `https://staging.example.com` proxyfié vers `127.0.0.1:18001`.

## Secrets GitHub

Configurer `STAGING_SSH_DEPLOY_PATH`, `STAGING_PUBLIC_URL` et `GHCR_READ_TOKEN`. Pour SSH, le workflow réutilise les secrets `SSH_HOST`, `SSH_USER`, `SSH_PORT`, `SSH_PASSWORD` ou `SSH_KEY` et `SSH_FINGERPRINT` déjà utilisés par la production ; des secrets `STAGING_SSH_*` peuvent les remplacer si nécessaire.

Le workflow est volontairement limité aux PR dont la branche source appartient au même dépôt : cela évite d'exécuter du code d'une fork avec les secrets de déploiement.
