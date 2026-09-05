# Sauvegardes de la base de données

La base SQLite est sauvegardée automatiquement par le service Docker
`database-backup`. Une sauvegarde est créée au démarrage, puis toutes les 24
heures par défaut.

Les archives sont compressées (`dashboard-YYYYMMDDTHHMMSSZ.sqlite3.gz`),
accompagnées d'un fichier SHA-256, et conservées 30 jours. La sauvegarde est
produite avec l'API de sauvegarde en ligne de SQLite : elle reste cohérente
même si la base utilise un fichier WAL.

## Destination requise

`DATABASE_BACKUP_HOST_DIR` doit désigner un stockage distinct du serveur
Docker, par exemple un montage NAS. En production, il est configuré vers
`/media/nas/DS211_Synology_2/parapente/database-backups` dans `env.portainer`.
Le répertoire doit être accessible en écriture par Docker avant le déploiement.

## Supervision

Le conteneur `parapente-database-backup` est sain lorsqu'une sauvegarde a
réussi durant les 25 dernières heures par défaut. En cas d'échec, il conserve
les archives précédentes et réessaie toutes les cinq minutes ; l'erreur est
visible dans les logs du conteneur.

## Restauration

1. Arrêter les services qui écrivent dans la base.
2. Depuis le répertoire de sauvegarde, vérifier l'archive :
   `sha256sum -c dashboard-<timestamp>.sqlite3.gz.sha256`.
3. Décompresser l'archive vers le volume de la base :
   `gzip -dc dashboard-<timestamp>.sqlite3.gz > dashboard.db`.
4. Redémarrer les services et vérifier leur état de santé.

Effectuer un test de restauration au moins une fois après le premier
déploiement, puis régulièrement.
