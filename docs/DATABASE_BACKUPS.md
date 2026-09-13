# Sauvegardes de la base de données

La base SQLite est sauvegardée automatiquement par le service Docker
`database-backup`. Une sauvegarde est créée au démarrage, puis toutes les 24
heures par défaut.

Les archives sont compressées (`dashboard-YYYYMMDDTHHMMSSZ.sqlite3.gz`),
accompagnées d'un fichier SHA-256, et seules les 3 plus récentes sont conservées. La sauvegarde est
produite avec l'API de sauvegarde en ligne de SQLite : elle reste cohérente
même si la base utilise un fichier WAL.

## Google Drive

Pour stocker les sauvegardes hors du NAS, configurer un remote `rclone` Google
Drive dans `RCLONE_CONFIG_HOST_DIR/rclone.conf`, puis renseigner son nom dans
`DATABASE_BACKUP_GOOGLE_DRIVE_REMOTE`. Le service envoie l'archive et son
fichier SHA-256, vérifie leur présence sur Drive, puis supprime la copie locale.
En cas d'échec réseau, la copie locale est conservée et le service réessaie.

La rétention de 3 sauvegardes est alors appliquée sur Google Drive.

### Première configuration

L'autorisation Google est distincte de l'autorisation YouTube, même si le
même compte Google est utilisé.

1. Installer `rclone` sur un ordinateur qui peut ouvrir un navigateur.
2. Lancer `rclone config`.
3. Créer un nouveau remote nommé `gdrive`, de type `drive`.
4. Laisser `client_id`, `client_secret` et `service_account_file` vides.
5. Choisir l'accès complet à Google Drive et autoriser le même compte Google
   que celui utilisé pour YouTube.
6. Vérifier le remote avec `rclone lsd gdrive:` et créer le dossier distant :
   `rclone mkdir gdrive:dashboard-parapente/database-backups`.
7. Afficher le fichier de configuration avec `rclone config file`, puis
   copier `rclone.conf` sur le serveur dans
   `RCLONE_CONFIG_HOST_DIR/rclone.conf`.
8. Dans Portainer, renseigner `DATABASE_BACKUP_GOOGLE_DRIVE_REMOTE=gdrive` et
   `DATABASE_BACKUP_GOOGLE_DRIVE_PATH=dashboard-parapente/database-backups`,
   puis redéployer la stack.

Le fichier `rclone.conf` contient un jeton d'accès Google et ne doit jamais
être commité ni partagé. Tant que le remote Google Drive n'est pas renseigné,
le service conserve les 3 dernières sauvegardes localement. En cas d'échec de
l'upload, la sauvegarde locale est conservée et le service réessaie.

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
2. Si Google Drive est configuré, télécharger l'archive et son checksum :
   `rclone copyto gdrive:dashboard-parapente/database-backups/dashboard-<timestamp>.sqlite3.gz .`
   `rclone copyto gdrive:dashboard-parapente/database-backups/dashboard-<timestamp>.sqlite3.gz.sha256 .`
3. Depuis le répertoire de sauvegarde, vérifier l'archive :
   `sha256sum -c dashboard-<timestamp>.sqlite3.gz.sha256`.
4. Décompresser l'archive vers le volume de la base :
   `gzip -dc dashboard-<timestamp>.sqlite3.gz > dashboard.db`.
5. Redémarrer les services et vérifier leur état de santé.

Effectuer un test de restauration au moins une fois après le premier
déploiement, puis régulièrement.
