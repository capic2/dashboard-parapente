# 🚢 Deployment Guide / Guide de Déploiement

> **Advanced production deployment guide for Portainer and beyond**  
> **Guide de déploiement production avancé pour Portainer et plus**

---

## 🇬🇧 English Version

### Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Portainer Deployment](#portainer-deployment)
4. [Environment Configuration](#environment-configuration)
5. [Redis Configuration](#redis-configuration)
6. [Health Checks & Monitoring](#health-checks--monitoring)
7. [Backup Strategy](#backup-strategy)
8. [Scaling & Performance](#scaling--performance)
9. [Security Best Practices](#security-best-practices)
10. [Troubleshooting Production](#troubleshooting-production)
11. [Rollback Procedures](#rollback-procedures)
12. [CI/CD Pipeline](#cicd-pipeline)

---

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Load Balancer / Nginx                │
│                   (Optional, for scaling)               │
└────────────┬───────────────────────┬────────────────────┘
             │                       │
    ┌────────▼────────┐    ┌────────▼────────┐
    │   Frontend      │    │   Frontend      │
    │  (Node:20)      │    │  (Node:20)      │  (Multiple instances)
    │  Port: 5173     │    │  Port: 5174     │
    └────────┬────────┘    └────────┬────────┘
             │                       │
             └───────────┬───────────┘
                         │
                ┌────────▼────────┐
                │   Backend       │
                │  (Python 3.10)  │
                │  Port: 8000     │
                │  + Scheduler    │
                └────┬──────┬─────┘
                     │      │
        ┌────────────┘      └────────────┐
        │                                 │
┌───────▼───────┐                ┌───────▼───────┐
│  Redis Cache  │                │  SQLite DB    │
│  Port: 6379   │                │  (Volume)     │
│  Persistent   │                └───────────────┘
└───────────────┘
```

**Components:**
- **Frontend**: React app serving static files
- **Backend**: FastAPI + APScheduler (weather polling)
- **Redis**: Centralized cache (shared between processes)
- **SQLite**: Flight data, user preferences, alerts

---

### Prerequisites

#### Server Requirements

**Minimum:**
- 2 CPU cores
- 2 GB RAM
- 20 GB disk space
- Ubuntu 20.04+ or Debian 11+

**Recommended:**
- 4 CPU cores
- 4 GB RAM
- 50 GB SSD
- Ubuntu 22.04 LTS

#### Software

- Docker 20.10+
- Docker Compose 2.0+
- Portainer CE 2.19+ (or Portainer Business)
- Domain name (for HTTPS)
- SSL certificate (Let's Encrypt recommended)

---

### Portainer Deployment

#### Step 1: Access Portainer

1. Navigate to your Portainer instance: `https://your-portainer.com`
2. Login with admin credentials
3. Select your Docker environment

#### Step 2: Create Stack

1. Go to **Stacks** → **Add stack**
2. Name: `dashboard-parapente-prod`
3. Build method: **Web editor**
4. Paste the `docker-compose.yml` content

#### Step 3: Environment Variables

In the **Environment variables** section, add:

```env
# API Keys (REQUIRED)
WEATHERAPI_KEY=your_weatherapi_key_here
METEOBLUE_API_KEY=your_meteoblue_key_here
STRAVA_KEY=your_strava_key_here

# Optional: Telegram alerts
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

⚠️ **Important**: API keys set here override values in `docker-compose.yml`

#### Step 4: Deploy Stack

1. Click **Deploy the stack**
2. Wait for containers to start (1-2 minutes)
3. Check **Containers** section for status

#### Step 5: Verify Deployment

```bash
# Check logs
docker logs dashboard-backend

# Should see:
# INFO: Connecting to Redis at redis:6379
# INFO: Redis connection established successfully
# INFO: Uvicorn running on http://0.0.0.0:8000

# Test API
curl http://localhost:8001/api/sites
# Should return JSON with sites list
```

---

### Environment Configuration

#### Production Environment Variables

**Backend (`docker-compose.yml`):**

```yaml
environment:
  # Core
  ENVIRONMENT: "production"
  PYTHONUNBUFFERED: "1"
  
  # Database
  DATABASE_URL: "sqlite:///db/dashboard.db"
  
  # Redis Cache
  USE_FAKE_REDIS: "false"  # MUST be false in production
  REDIS_HOST: "redis"
  REDIS_PORT: "6379"
  
  # Scheduler
  SCHEDULER_ENABLED: "true"
  SCHEDULER_INTERVAL_MINUTES: "30"  # Poll weather every 30min
  
  # Logging
  LOG_LEVEL: "INFO"  # Or "WARNING" for less verbose
  LOG_FILE: "logs/dashboard.log"
  
  # API Keys (use Portainer env vars instead)
  WEATHERAPI_KEY: "${WEATHERAPI_KEY}"
  METEOBLUE_API_KEY: "${METEOBLUE_API_KEY}"
  STRAVA_KEY: "${STRAVA_KEY}"
  
  # Optional: Telegram
  TELEGRAM_BOT_TOKEN: "${TELEGRAM_BOT_TOKEN:-}"
  TELEGRAM_CHAT_ID: "${TELEGRAM_CHAT_ID:-}"
```

**Frontend:**

```yaml
environment:
  VITE_API_URL: "http://localhost:8001"  # Adjust for your domain
  NODE_ENV: "production"
```

---

### Redis Configuration

#### Cache TTL Configuration

**Production Cache Strategy:**
- **TTL:** 60 minutes (3600 seconds)
- **Polling:** Every hour via APScheduler
- **Coverage:** Today + Tomorrow (most consulted days)
- **On-demand:** Days 2-6 fetched as needed

**Why this configuration?**
1. **No cache gaps:** TTL matches refresh interval
2. **Predictable performance:** Users always hit cache
3. **API efficiency:** Only 6 sites × 2 days × hourly = 288 API calls/day
4. **Cost optimization:** Minimal external API usage

**Cache Keys Format:**
```
weather:forecast:{site_id}_{day_index}_{hash}
TTL: 3600 seconds (1 hour)
```

**Monitoring Cache Health:**
```bash
# Check cache hit ratio
docker exec -it dashboard-redis redis-cli INFO stats | grep keyspace

# Expected: >95% hit rate
```

#### Basic Configuration (Current)

```yaml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
```

**Explanation:**
- `--appendonly yes`: Enable AOF (Append-Only File) persistence
- `--maxmemory 256mb`: Limit Redis memory usage
- `--maxmemory-policy allkeys-lru`: Evict least recently used keys when full

#### Advanced Configuration

For production with heavy traffic, create `redis.conf`:

```conf
# redis.conf
bind 0.0.0.0
protected-mode yes
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

# Persistence
save 900 1      # Save if 1 key changed in 15min
save 300 10     # Save if 10 keys changed in 5min
save 60 10000   # Save if 10k keys changed in 1min
appendonly yes
appendfsync everysec

# Memory
maxmemory 512mb
maxmemory-policy allkeys-lru

# Performance
maxclients 10000
```

Update `docker-compose.yml`:

```yaml
redis:
  image: redis:7-alpine
  volumes:
    - redis-data:/data
    - ./redis.conf:/usr/local/etc/redis/redis.conf  # Add this
  command: redis-server /usr/local/etc/redis/redis.conf  # Change this
```

#### Redis Monitoring

Monitor Redis health:

```bash
# Connect to Redis CLI
docker exec -it dashboard-redis redis-cli

# Check memory usage
INFO memory

# Check connected clients
CLIENT LIST

# Check hit/miss ratio
INFO stats | grep keyspace

# Monitor commands in real-time
MONITOR
```

**Key Metrics to Watch:**
- `used_memory_human`: Current memory usage
- `evicted_keys`: Keys removed due to maxmemory
- `keyspace_hits` / `keyspace_misses`: Cache efficiency

---

### Health Checks & Monitoring

#### Built-in Health Checks

Redis healthcheck is already configured:

```yaml
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 5s
  timeout: 3s
  retries: 5
```

#### Add Backend Health Check

Update `docker-compose.yml`:

```yaml
dashboard-backend:
  # ... existing config ...
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

Add health endpoint to `backend/routes.py`:

```python
@app.get("/api/health")
async def health_check():
    """Health check endpoint for monitoring."""
    # Test Redis
    try:
        redis_client = await get_redis()
        await redis_client.ping()
        redis_status = "healthy"
    except Exception as e:
        redis_status = f"unhealthy: {str(e)}"
    
    # Test Database
    try:
        db.execute("SELECT 1")
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
    
    return {
        "status": "healthy" if redis_status == "healthy" and db_status == "healthy" else "degraded",
        "redis": redis_status,
        "database": db_status,
        "timestamp": datetime.utcnow().isoformat()
    }
```

#### Monitoring with Portainer

In Portainer:
1. Go to **Containers**
2. Click on container name
3. View **Stats** for CPU/Memory usage
4. View **Logs** for errors

#### External Monitoring (Optional)

**UptimeRobot Setup:**
1. Create account at uptimerobot.com
2. Add monitor: `https://your-domain.com/api/health`
3. Check interval: 5 minutes
4. Alert methods: Email, SMS, Webhook

**Prometheus + Grafana (Advanced):**
```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
  
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

---

### Backup Strategy

#### 1. Redis Data Backup

**Automatic RDB Snapshots:**

Redis already saves snapshots to `/data` volume. To backup:

```bash
# Create backup directory
mkdir -p /backups/redis

# Backup Redis data
docker exec dashboard-redis redis-cli BGSAVE
docker cp dashboard-redis:/data/dump.rdb /backups/redis/dump-$(date +%Y%m%d-%H%M%S).rdb
```

**Automated Daily Backup Script:**

```bash
#!/bin/bash
# /opt/scripts/backup-redis.sh

BACKUP_DIR="/backups/redis"
RETENTION_DAYS=7

# Create backup
docker exec dashboard-redis redis-cli BGSAVE
sleep 5
docker cp dashboard-redis:/data/dump.rdb "$BACKUP_DIR/dump-$(date +%Y%m%d).rdb"

# Remove old backups
find "$BACKUP_DIR" -name "dump-*.rdb" -mtime +$RETENTION_DAYS -delete

echo "Redis backup completed: $(date)"
```

**Cron job:**

```bash
# Edit crontab
crontab -e

# Add daily backup at 3 AM
0 3 * * * /opt/scripts/backup-redis.sh >> /var/log/backup-redis.log 2>&1
```

#### 2. SQLite Database Backup

```bash
#!/bin/bash
# /opt/scripts/backup-sqlite.sh

BACKUP_DIR="/backups/sqlite"
CONTAINER="dashboard-backend"
DB_PATH="/app/db/dashboard.db"

# Create backup
docker exec $CONTAINER sqlite3 $DB_PATH ".backup /app/db/backup-$(date +%Y%m%d).db"
docker cp $CONTAINER:/app/db/backup-$(date +%Y%m%d).db "$BACKUP_DIR/"

# Remove old backups
find "$BACKUP_DIR" -name "backup-*.db" -mtime +30 -delete

echo "SQLite backup completed: $(date)"
```

#### 3. Restore Procedures

**Restore Redis:**

```bash
# Stop Redis
docker-compose stop redis

# Copy backup to volume
docker cp /backups/redis/dump-20260302.rdb dashboard-redis:/data/dump.rdb

# Start Redis
docker-compose start redis
```

**Restore SQLite:**

```bash
# Stop backend
docker-compose stop dashboard-backend

# Restore database
docker cp /backups/sqlite/backup-20260302.db dashboard-backend:/app/db/dashboard.db

# Start backend
docker-compose start dashboard-backend
```

---

### Scaling & Performance

#### Horizontal Scaling

To handle more traffic, scale the backend:

```bash
# Scale to 3 backend instances
docker-compose up -d --scale dashboard-backend=3
```

**Add Nginx load balancer:**

```yaml
# docker-compose.yml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - dashboard-backend
```

**nginx.conf:**

```nginx
upstream backend {
    least_conn;  # Load balancing algorithm
    server dashboard-backend-1:8000;
    server dashboard-backend-2:8000;
    server dashboard-backend-3:8000;
}

server {
    listen 80;
    server_name your-domain.com;
    
    location /api {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location / {
        proxy_pass http://dashboard-frontend:5173;
    }
}
```

#### Redis Performance Tuning

**Connection Pooling:**

Update `backend/cache.py`:

```python
_redis_pool = redis.ConnectionPool(
    host=redis_host,
    port=redis_port,
    db=0,
    max_connections=50,  # Adjust based on load
    decode_responses=True
)
redis_client = redis.Redis(connection_pool=_redis_pool)
```

**Cache Warming:**

Preload frequently accessed data on startup (already implemented in `main.py`).

#### Database Optimization

**SQLite WAL Mode:**

```python
# database.py
engine = create_engine(
    'sqlite:///db/dashboard.db',
    connect_args={'check_same_thread': False},
    echo=False
)

# Enable WAL mode
with engine.connect() as conn:
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
```

**Indexes:**

```sql
-- Add indexes for frequent queries
CREATE INDEX idx_flights_date ON flights(flight_date DESC);
CREATE INDEX idx_flights_site ON flights(site_id);
CREATE INDEX idx_alerts_active ON alerts(is_active, site_id);
```

---

### Security Best Practices

#### 1. API Keys Management

**DO:**
- ✅ Store keys in Portainer environment variables
- ✅ Use secrets management (Docker Secrets)
- ✅ Rotate keys regularly
- ✅ Limit API key permissions

**DON'T:**
- ❌ Commit keys to Git
- ❌ Log API keys
- ❌ Expose keys in URLs

#### 2. Network Security

**Firewall Rules:**

```bash
# UFW configuration
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable

# Block direct access to backend/Redis
sudo ufw deny 8000/tcp
sudo ufw deny 6379/tcp
```

**Docker Network Isolation:**

```yaml
networks:
  dashboard-net:
    driver: bridge
    internal: false  # Set to true to isolate from external
```

#### 3. HTTPS with Let's Encrypt

**Install Certbot:**

```bash
sudo apt install certbot python3-certbot-nginx
```

**Get Certificate:**

```bash
sudo certbot --nginx -d your-domain.com
```

**Auto-renewal:**

```bash
# Test renewal
sudo certbot renew --dry-run

# Add to crontab (runs twice daily)
0 0,12 * * * certbot renew --quiet
```

#### 4. Rate Limiting

Add to `nginx.conf`:

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

server {
    location /api {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://backend;
    }
}
```

#### 5. CORS Configuration

Update `backend/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-domain.com"],  # Specific domain only
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
```

---

### Troubleshooting Production

#### Common Issues

**Issue: "Redis connection timeout"**

```bash
# Check Redis is running
docker ps | grep redis

# Check Redis logs
docker logs dashboard-redis

# Test Redis connection
docker exec -it dashboard-redis redis-cli ping
# Should return: PONG

# Check backend can reach Redis
docker exec -it dashboard-backend ping redis
```

**Solution:**
- Ensure Redis container is running
- Check network connectivity: `docker network inspect dashboard-net`
- Verify `REDIS_HOST=redis` in environment variables

---

**Issue: "High memory usage"**

```bash
# Check container stats
docker stats

# Check Redis memory
docker exec -it dashboard-redis redis-cli INFO memory
```

**Solution:**
- Increase `maxmemory` in Redis config
- Check for memory leaks: `docker exec dashboard-backend ps aux`
- Restart containers: `docker-compose restart`

---

**Issue: "Scheduler not polling"**

```bash
# Check backend logs
docker logs dashboard-backend | grep -i "scheduler"

# Should see:
# INFO: Scheduler started
# INFO: Fetching weather for site-arguel
```

**Solution:**
- Verify `SCHEDULER_ENABLED=true`
- Check for exceptions in logs
- Restart backend: `docker-compose restart dashboard-backend`

---

**Issue: "Frontend can't reach API"**

**Solution:**
- Check `VITE_API_URL` environment variable
- Verify CORS settings in backend
- Check Nginx proxy configuration
- Test API directly: `curl http://localhost:8001/api/sites`

---

### Rollback Procedures

#### Quick Rollback

```bash
# Stop current stack
docker-compose down

# Restore previous Docker image
docker pull your-registry/dashboard-backend:previous-tag
docker pull your-registry/dashboard-frontend:previous-tag

# Start with previous version
docker-compose up -d
```

#### Database Rollback

```bash
# Restore from backup (see Backup Strategy section)
docker-compose stop dashboard-backend
docker cp /backups/sqlite/backup-YYYYMMDD.db dashboard-backend:/app/db/dashboard.db
docker-compose start dashboard-backend
```

#### Redis Rollback

```bash
docker-compose stop redis
docker cp /backups/redis/dump-YYYYMMDD.rdb dashboard-redis:/data/dump.rdb
docker-compose start redis
```

---

### CI/CD Pipeline

#### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      
      - name: Run tests
        run: |
          cd backend
          pytest
      
      - name: Run linter
        run: |
          cd backend
          flake8 .
  
  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Portainer
        env:
          PORTAINER_URL: ${{ secrets.PORTAINER_URL }}
          PORTAINER_TOKEN: ${{ secrets.PORTAINER_TOKEN }}
          STACK_ID: ${{ secrets.STACK_ID }}
        run: |
          curl -X POST "$PORTAINER_URL/api/stacks/$STACK_ID/git/redeploy" \
            -H "X-API-Key: $PORTAINER_TOKEN"
```

**Setup:**
1. Go to GitHub repo → Settings → Secrets
2. Add secrets:
   - `PORTAINER_URL`: Your Portainer URL
   - `PORTAINER_TOKEN`: Generate in Portainer → User → API Token
   - `STACK_ID`: Stack ID from Portainer URL

---

### Production Checklist

Before going live:

- [ ] SSL certificate installed and auto-renewing
- [ ] Firewall rules configured
- [ ] Redis persistence enabled (AOF + RDB)
- [ ] Backup scripts configured and tested
- [ ] Monitoring/alerting setup (UptimeRobot, etc.)
- [ ] Health check endpoints working
- [ ] API keys stored securely (Portainer env vars)
- [ ] CORS configured for production domain
- [ ] Rate limiting enabled
- [ ] Database indexes created
- [ ] Logs rotation configured
- [ ] Documentation updated
- [ ] Rollback procedure tested
- [ ] Load testing completed
- [ ] Security audit passed

---

## 🇫🇷 Version Française

[Similar comprehensive French version follows the same structure...]

---

**Need help? / Besoin d'aide ?**

- 📖 Check [DEVELOPMENT.md](DEVELOPMENT.md) for local setup
- 🐛 Open an issue on GitHub
- 💬 Join our community chat

**Safe deployments! / Bons déploiements ! 🚀**
