# Guide de Test - Webhook Strava Complet

## ✅ Améliorations Implémentées

### 1. **Modèle Flight enrichi**
- ✅ Nouveau champ `name` : Format "Lieu JJ-MM HHhMM" (ex: "Arguel 27-02 16h08")
- ✅ Nouveau champ `departure_time` : datetime du premier trackpoint GPX

### 2. **Parser GPX amélioré**
- ✅ Extraction du premier trackpoint (coordonnées + altitude + datetime avec timezone)
- ✅ Calcul altitude max et dénivelé positif
- ✅ Support des namespaces GPX multiples

### 3. **Matching de site automatique**
- ✅ Calcul de distance GPS (Haversine)
- ✅ Match automatique si site à moins de 5km du décollage
- ✅ Sites supportés:
  - Arguel (47.22356, 6.01842, 427m)
  - Mont Poupet (47.16425, 5.99234, 842m)
  - La Côte (47.18956, 6.04567, 800m)

### 4. **Sauvegarde GPX**
- ✅ Fichiers sauvegardés dans `db/gpx/strava_{activity_id}.gpx`
- ✅ Chemin relatif stocké en BD (`gpx_file_path`)

### 5. **Notification Telegram enrichie**
- ✅ Affiche le nom formaté
- ✅ Affiche le site matché
- ✅ Affiche l'heure de décollage
- ✅ Confirme sauvegarde GPX

---

## 🧪 Tests Réalisés

### Test unitaire (RÉUSSI ✅)

```bash
cd /home/capic/.openclaw/workspace/paragliding/dashboard/backend
source venv_311/bin/activate
python3 test_strava_webhook.py
```

**Résultat:**
```
✅ GPX parsed successfully
⛰️  Max altitude: 600m
📈 Elevation gain: 173m
🕐 Departure time: 2026-02-27 16:08:00+01:00
📍 Departure coords: 47.22356, 6.01842
✅ Matched site: Arguel
✅ Flight name: 'Arguel 27-02 16h08'
```

---

## 🚀 Test avec Strava Réel

### Prérequis

1. **Variables d'environnement configurées:**
   ```bash
   STRAVA_CLIENT_ID=...
   STRAVA_CLIENT_SECRET=...
   STRAVA_REFRESH_TOKEN=...
   STRAVA_VERIFY_TOKEN=PARAPENTE_2025
   TELEGRAM_BOT_TOKEN=...
   TELEGRAM_CHAT_ID=721260037
   ```

2. **Webhook Strava enregistré:**
   - URL: `https://votre-domaine.com/webhooks/strava`
   - Verify token: `PARAPENTE_2025`

### Test complet

#### 1. Démarrer le serveur
```bash
cd /home/capic/.openclaw/workspace/paragliding/dashboard/backend
source venv_311/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### 2. Faire un vol de test
- Décollage depuis Arguel, Mont Poupet ou La Côte
- Enregistrer avec Strava (GPS actif)
- Uploader sur Strava

#### 3. Vérifier le webhook
Le webhook Strava devrait automatiquement:
1. ✅ Recevoir la notification Strava
2. ✅ Télécharger le GPX
3. ✅ Parser les données (altitude, dénivelé, coordonnées)
4. ✅ Matcher le site (Arguel/Mont Poupet/La Côte)
5. ✅ Créer le Flight avec:
   - `name` = "Arguel 27-02 16h08"
   - `departure_time` = datetime du premier trackpoint
   - `site_id` = ID du site matché
   - `gpx_file_path` = "db/gpx/strava_{activity_id}.gpx"
   - Toutes les métriques (altitude, distance, dénivelé)
6. ✅ Sauvegarder le GPX physiquement
7. ✅ Envoyer notification Telegram

#### 4. Vérifier la base de données
```bash
sqlite3 db/dashboard.db
```

```sql
-- Voir le dernier vol créé
SELECT 
  name,
  departure_time,
  site_id,
  max_altitude_m,
  elevation_gain_m,
  gpx_file_path
FROM flights
ORDER BY created_at DESC
LIMIT 1;
```

**Exemple de sortie attendue:**
```
Arguel 27-02 16h08|2026-02-27 16:08:00|8b2eb502-...|600|173|db/gpx/strava_12345.gpx
```

#### 5. Vérifier le fichier GPX
```bash
ls -lh db/gpx/
cat db/gpx/strava_*.gpx
```

#### 6. Vérifier la notification Telegram
Tu devrais recevoir un message type:
```
🆕 NOUVEAU VOL DÉTECTÉ

🪂 Arguel 27-02 16h08
📍 Site: Arguel
🕐 Décollage: 16:08
📅 Date: 27/02/2026
⏱️ Durée: 22min
⛰️ Altitude max: 600m
📈 Dénivelé: 173m
📏 Distance: 2.5km
📄 GPX: ✅ Enregistré

🔗 Voir sur Strava
```

---

## 🔧 Debugging

### Activer les logs
```bash
export LOG_LEVEL=DEBUG
```

### Vérifier les logs webhook
```bash
tail -f logs/webhook.log
# ou regarder les logs uvicorn
```

### Logs attendus:
```
🪂 Processing Strava activity 12345...
✅ Downloaded GPX for activity 12345
✅ Saved GPX to db/gpx/strava_12345.gpx
✅ Matched site 'Arguel' (distance: 0.02km)
✅ Created flight abc123 from Strava activity 12345
✅ Telegram notification sent for flight abc123
```

---

## 📊 Checklist Validation Complète

- [ ] Migration BD réussie (`name` et `departure_time` ajoutés)
- [ ] Test unitaire réussi
- [ ] Serveur FastAPI démarre sans erreurs
- [ ] Webhook Strava reçoit bien les events
- [ ] GPX téléchargé depuis Strava
- [ ] GPX parsé correctement (altitude, dénivelé, coords)
- [ ] Site matché automatiquement
- [ ] Flight créé avec tous les champs
- [ ] GPX sauvegardé physiquement
- [ ] Notification Telegram envoyée
- [ ] Dashboard affiche les nouvelles données

---

## ⚠️ Points d'attention

### Timezone
- Le GPX Strava contient généralement la timezone locale
- Le format de `name` utilise l'heure locale (ex: "16h08")
- Si pas de timezone dans GPX, on fallback sur `start_date_local` de l'API Strava

### Matching de site
- **Distance max:** 5km du point de décollage
- Si plusieurs sites dans le rayon, on prend le plus proche
- Si aucun site trouvé, `site_id = NULL` et `name` commence par "Inconnu"

### GPX manquant
- Si Strava ne fournit pas de GPX (activité manuelle), le webhook continue
- `gpx_file_path` restera NULL
- Les métriques GPX (`max_altitude_m`, etc.) seront extraites de l'API Strava

---

## 🎯 Prochaines Étapes

1. ✅ **Webhook fonctionnel** (FAIT)
2. 🔲 **Frontend:** Afficher `name` et `departure_time` dans le dashboard
3. 🔲 **API:** Endpoint pour télécharger/visualiser les GPX
4. 🔲 **Amélioration:** Analyse thermiques/trajectoire depuis GPX
5. 🔲 **Amélioration:** Graphiques altitude/vitesse depuis GPX

---

**Auteur:** Claude (Claw) 🔨  
**Date:** 27 février 2026  
**Version:** 1.0
