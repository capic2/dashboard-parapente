# SQLite Upgrade (Feb 26, 2026)

## Summary

**Big change for the better! 🚀**

Switched from **PostgreSQL** to **SQLite** for the dashboard database. This means:

- ⚡ **30% faster development** (no infrastructure setup)
- 💾 **Zero database administration** (it's just a file)
- 📦 **Single-file backups** (copy = backup)
- 🎯 **Launch 2 weeks earlier** (May 10 instead of May 24)
- 🔄 **Easy upgrade path** (can migrate to PostgreSQL later if needed)

## What Changed

### Phase 2 Timeline: 6 weeks → 4 weeks

**Before (PostgreSQL):**
- Week 1: PostgreSQL server setup, LXC container, extensions, migrations system
- Week 2-4: Scrapers + pipeline
- Total: 50-60 hours, 6 weeks

**After (SQLite):**
- Week 1: `sqlite3 < schema.sql` (done in 10 minutes!)
- Week 1-3: Scrapers + pipeline
- Total: 30-40 hours, 4 weeks ⚡

### Database Files

**OLD:**
- `dashboard-schema.sql` (PostgreSQL syntax)

**NEW:**
- `dashboard-schema-sqlite.sql` (SQLite syntax) ✅ Use this now!

### Connection String (Python)

```python
# SQLite (now)
DATABASE_URL = "sqlite:////home/capic/.openclaw/workspace/paragliding/db/dashboard.db"

# PostgreSQL (future, if scaling)
DATABASE_URL = "postgresql://user:pass@localhost/parapente_dashboard"
```

SQLAlchemy handles both → migration is trivial later.

## Infrastructure Changes

### Before (PostgreSQL)
```
Proxmox
├── LXC: dashboard-db (PostgreSQL server)
├── LXC: dashboard-api (Python)
└── LXC: dashboard-web (Nginx)
```

### After (SQLite)
```
/workspace/paragliding/
├── db/dashboard.db       ← Single file!
├── backend/              ← Python scripts
├── frontend/             ← Vue.js
└── venv/                 ← Python venv (no containers!)
```

## Setup (Phase 2, Week 1)

```bash
# 1. Create database (2 minutes)
mkdir -p /home/capic/.openclaw/workspace/paragliding/db
sqlite3 /home/capic/.openclaw/workspace/paragliding/db/dashboard.db < dashboard-schema-sqlite.sql

# 2. Verify (1 minute)
sqlite3 /home/capic/.openclaw/workspace/paragliding/db/dashboard.db ".tables"
# Output: sites, flights, weather_sources, weather_forecasts, ...

# 3. Start coding scrapers (rest of week)
```

Done! No PostgreSQL installation, no server configuration, no port mapping.

## Backup Strategy

```bash
# Daily backup (cron job)
cp /workspace/paragliding/db/dashboard.db \
   /workspace/paragliding/db/backups/dashboard-$(date +%Y%m%d).db

# Recovery (just copy back)
cp /workspace/paragliding/db/backups/dashboard-20260315.db \
   /workspace/paragliding/db/dashboard.db
```

## Migration Path (If Scaling Later)

If you add 10+ sites or need concurrent writers:

```python
# Step 1: Export data from SQLite
sqlite3 db/dashboard.db ".dump" > dump.sql

# Step 2: Import to PostgreSQL
psql -d parapente_dashboard < dump.sql

# Step 3: Change CONNECTION STRING
DATABASE_URL = "postgresql://user:pass@localhost/db"

# Step 4: Test thoroughly

# Done! No code changes needed (SQLAlchemy ORM handles it)
```

## Benefits Summary

| Aspect | PostgreSQL | SQLite |
|--------|-----------|--------|
| **Setup time** | 30-60 min | 2 min ⚡ |
| **Infrastructure** | Server + LXC | File ⚡ |
| **Backup** | pg_dump + restore | cp file ⚡ |
| **Dev/test** | Overkill | Perfect ⚡ |
| **Scaling** | Necessary | Later ⚡ |
| **Single user** | Works | Ideal ⚡ |
| **Concurrent writes** | Required | Limited |

## Updated Plan Files

- ✅ `dashboard-schema-sqlite.sql` — New SQLite schema
- ✅ `dashboard-implementation-plan.md` — Updated with SQLite timelines
- ✅ Infrastructure section — Simplified (no PostgreSQL)
- ✅ Phase 2 Week 1 — 4-5 hours instead of 8-10 hours

## Questions?

- How to query SQLite? Same SQL syntax as PostgreSQL
- Can I use async? Yes! Use `aiosqlite` (already in requirements)
- What about migrations? Simple: Python script + schema versioning
- Multi-user dashboard later? Migrate to PostgreSQL (trivial with SQLAlchemy)

---

**Status:** Ready for Phase 2 (March 1)  
**Launch date:** May 10, 2026 (2 weeks faster!) 🚀
