# Preview temporaire de pull request

A l'ouverture, à la réouverture ou à chaque mise à jour d'une PR interne, une
preview full-stack démarre automatiquement. Un commentaire est ajouté ou mis à
jour dans la PR avec une URL
publique `trycloudflare.com` qui reste disponible au plus 60 minutes.

La preview s'exécute sur un runner GitHub Actions et non sur le serveur
Portainer. À la fin du job, le runner, les conteneurs, le tunnel et la copie de
la base sont détruits automatiquement.

## Données de démo

Le workflow télécharge la dernière archive SQLite de production depuis le
répertoire configuré, vérifie son intégrité puis la monte uniquement dans le
conteneur de preview. Il ne se connecte jamais à la base de production. Les
workers, le scheduler et les synchronisations externes sont désactivés.

## Configuration requise

Le workflow réutilise les secrets SSH déjà présents pour le déploiement de
production (`SSH_HOST`, `SSH_USER`, `SSH_PASSWORD`, `SSH_FINGERPRINT` et
`SSH_PORT`) afin de lire la dernière sauvegarde dans
`/media/nas/DS211_Synology_2/parapente/database-backups`. Le jeton
`VITE_CESIUM_ION_TOKEN` est également déjà utilisé par le build de production.

Le secret JWT de la preview est généré à chaque lancement : aucun nouveau secret
GitHub n'est nécessaire.

Les PR provenant de forks sont volontairement ignorées. Une preview est publique
pendant sa session ; le jeu de données ne doit donc contenir aucune information
qui ne puisse être exposée.
