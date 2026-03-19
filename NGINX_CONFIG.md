# Nginx Reverse Proxy Configuration

Configuration pour exposer Dashboard Parapente à `parapente.capic.ignorelist.com` via Nginx.

---

## Configuration Nginx

Ajouter ce bloc serveur à votre Nginx (généralement `/etc/nginx/sites-available/parapente.capic.ignorelist.com`) :

```nginx
server {
    listen 80;
    server_name parapente.capic.ignorelist.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name parapente.capic.ignorelist.com;

    # SSL certificates (ajuster chemins selon votre config)
    ssl_certificate /path/to/your/ssl/cert.pem;
    ssl_certificate_key /path/to/your/ssl/key.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Logging
    access_log /var/log/nginx/parapente.access.log;
    error_log /var/log/nginx/parapente.error.log;

    # Proxy settings
    location / {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Timeouts pour requêtes API longues
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # Client body size (uploads)
    client_max_body_size 10M;
}
```

---

## Installation

### 1. Créer le fichier de configuration

```bash
sudo nano /etc/nginx/sites-available/parapente.capic.ignorelist.com
```

Coller la configuration ci-dessus.

### 2. Activer le site

```bash
sudo ln -s /etc/nginx/sites-available/parapente.capic.ignorelist.com /etc/nginx/sites-enabled/
```

### 3. Tester la configuration

```bash
sudo nginx -t
```

### 4. Recharger Nginx

```bash
sudo systemctl reload nginx
```

---

## Configuration DNS

Assurer que votre DNS pointe vers le serveur :

```
A    parapente.capic.ignorelist.com    →    <IP_SERVEUR>
```

---

## Certificats SSL

### Option A: Let's Encrypt (Recommandé)

```bash
sudo certbot --nginx -d parapente.capic.ignorelist.com
```

Certbot configurera automatiquement SSL dans votre Nginx.

### Option B: Certificats existants

Modifier les lignes dans la config Nginx :

```nginx
ssl_certificate /chemin/vers/votre/fullchain.pem;
ssl_certificate_key /chemin/vers/votre/privkey.pem;
```

---

## Vérification

### Test local (sur le serveur)

```bash
curl http://localhost:8001/
# Doit retourner le status JSON de l'API
```

### Test via domaine

```bash
curl https://parapente.capic.ignorelist.com/
# Doit charger la page React
```

### Dans le navigateur

Ouvrir : `https://parapente.capic.ignorelist.com`

---

## Sécurité Supplémentaire (Optionnel)

### Rate Limiting

Ajouter dans le bloc `http` de `/etc/nginx/nginx.conf` :

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
```

Puis dans le bloc `location /` :

```nginx
limit_req zone=api_limit burst=20 nodelay;
```

### Headers de Sécurité

Ajouter dans le bloc `server` :

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
```

---

## Troubleshooting

### 502 Bad Gateway

Vérifier que le backend Docker est en cours d'exécution :

```bash
docker ps | grep parapente-backend
curl http://localhost:8001/
```

### 504 Gateway Timeout

Augmenter les timeouts dans Nginx :

```nginx
proxy_connect_timeout 120s;
proxy_send_timeout 120s;
proxy_read_timeout 120s;
```

### Certificats SSL expirés

Renouveler avec Certbot :

```bash
sudo certbot renew
sudo systemctl reload nginx
```

---

## Logs

Consulter les logs Nginx :

```bash
# Access logs
sudo tail -f /var/log/nginx/parapente.access.log

# Error logs
sudo tail -f /var/log/nginx/parapente.error.log
```

---

**Documentation complète Nginx :** https://nginx.org/en/docs/
