# 🔄 Comment Rafraîchir les Données Météo Manuellement

## Méthode 1: Via votre Navigateur Web (Le plus simple!)

1. Ouvrez votre navigateur
2. Allez sur cette URL (remplacez par votre domaine):
   ```
   https://votre-domaine.com/api/admin/refresh-weather
   ```
   
3. Vous verrez une réponse JSON comme:
   ```json
   {
     "success": true,
     "message": "Weather data refresh completed successfully",
     "timestamp": "2026-03-07T16:45:00"
   }
   ```

## Méthode 2: Via Curl (ligne de commande)

Si vous avez accès SSH à votre serveur:

```bash
curl -X POST https://votre-domaine.com/api/admin/refresh-weather
```

## Méthode 3: Via Portainer (si vous utilisez Portainer)

1. Allez dans Portainer
2. Cliquez sur votre container `parapente-backend`
3. Allez dans "Console"
4. Exécutez:
   ```bash
   ./trigger_weather_refresh.sh
   ```

## Méthode 4: Via Docker CLI

Si vous avez accès à docker sur votre serveur:

```bash
docker exec -it parapente-backend curl -X POST http://localhost:8001/api/admin/refresh-weather
```

## Que se passe-t-il pendant le refresh?

Le système va:
1. ✅ Récupérer les données météo pour les 6 sites
2. ✅ Récupérer aujourd'hui + demain (2 jours par site = 12 requêtes)
3. ✅ Mettre en cache dans Redis
4. ✅ Calculer les Para-Index
5. ✅ Rendre les données disponibles pour le dashboard

**Durée:** Environ 30-60 secondes

## Comment vérifier que ça a fonctionné?

### Dans les logs Docker:
```
✅ Cached Arguel day 0
✅ Cached Arguel day 1
✅ Cached Mont Poupet Nord day 0
...
✅ Scheduled fetch completed: 12/12 succeeded
```

### Dans votre dashboard:
Rechargez la page - vous devriez voir les données météo apparaître!

## Quand utiliser le refresh manuel?

- ⚠️ Au premier déploiement (cache vide)
- ⚠️ Après un redémarrage de l'application
- ⚠️ Si les données semblent anciennes ou manquantes
- 🔄 Le scheduler automatique tourne toutes les heures à :00

## Problèmes courants

### "Failed to fetch daily summary"
➡️ Lancez le refresh manuel, attendez 1 minute, puis rechargez votre dashboard

### "No forecast data available"
➡️ Le cache est vide. Lancez le refresh manuel.

### Connection timeout
➡️ Normal si c'est la première fois - les API météo peuvent être lentes. Réessayez dans 2-3 minutes.

---

**Note:** Une fois le refresh manuel effectué, le scheduler automatique prendra le relais et rafraîchira les données toutes les heures. Vous n'aurez plus besoin de le faire manuellement!
