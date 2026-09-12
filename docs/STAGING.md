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
- arrête les conteneurs lorsque le label est retiré ou lorsque la PR actuellement déployée est fermée ; si une autre PR a été déployée entre-temps, le staging reste actif.
- conserve le dossier, `stack.env` et les données persistantes ; la VM peut aussi être arrêtée avec `STAGING_VM_SHUTDOWN_COMMAND`.

Aucun déploiement n'est déclenché lors de la création ou de la mise à jour d'une PR. Pour tester un nouveau commit, relancer manuellement le workflow ou retirer puis remettre le label `deploy-staging`.

## Préparation du serveur

Créer un dossier par exemple `/home/capic/docker-data/dashboard-parapente-staging`. Si aucun `stack.env` staging n'existe, le workflow initialise automatiquement ce fichier depuis le `.env` ou `stack.env` de production déjà présent sur le serveur, puis surcharge les chemins persistants pour le staging. Il ne crée aucun secret : vérifier que la configuration de production contient les variables requises par `docker-compose.yml`, notamment `GOPRO_OVERLAY_DATA_HOST_DIR` et `BACKEND_VERSION_STATE_FILE=/app/db/version_state.json`. Ce dossier est réutilisé par toutes les PR et ne doit donc pas être suffixé par un numéro de PR.

Le serveur doit disposer de Docker Compose et d'un accès sortant à GHCR. Le workflow réserve automatiquement `data/parapente` dans le dossier staging pour `GOPRO_OVERLAY_DATA_HOST_DIR` ; les cinq vols d'exemple y reçoivent de petits fichiers MP4 valides pour la caméra, le pano et l'overlay. Le port local `18001` doit être publié par un reverse proxy HTTPS ou rendu accessible par le pare-feu/NAT. Avec le domaine de production existant, créer une Custom Location `/staging` vers `192.168.1.106:18001` et ajouter cette réécriture dans sa configuration avancée Nginx :

```nginx
rewrite ^/staging(/.*)$ $1 break;
```

Elle retire le préfixe avant de transmettre la requête au backend. L'image staging est construite avec `VITE_BASE_PATH=/staging/` afin que ses assets, routes et appels API restent sous ce préfixe. Un sous-domaine dédié, par exemple `https://staging.example.com` vers `127.0.0.1:18001`, reste plus simple si cette configuration est possible.

## Secrets GitHub

Configurer `STAGING_SSH_DEPLOY_PATH`, `STAGING_PUBLIC_URL` et `GHCR_READ_TOKEN`. Pour SSH, le workflow réutilise les secrets `SSH_HOST`, `SSH_USER`, `SSH_PORT`, `SSH_PASSWORD` ou `SSH_KEY` et `SSH_FINGERPRINT` déjà utilisés par la production ; des secrets `STAGING_SSH_*` peuvent les remplacer si nécessaire.

`STAGING_VM_SHUTDOWN_COMMAND` est optionnel. S'il est défini, il est exécuté en tâche détachée après l'arrêt du stack, par exemple `sudo shutdown -h now`. Ne le configurer que si l'hôte SSH est une VM dédiée au staging : les valeurs SSH retombent sinon sur celles de production. La VM doit être rallumée par un mécanisme externe avant un nouveau déploiement, car GitHub Actions ne peut pas se connecter à une VM arrêtée.

Le workflow est volontairement limité aux PR dont la branche source appartient au même dépôt : cela évite d'exécuter du code d'une fork avec les secrets de déploiement.
