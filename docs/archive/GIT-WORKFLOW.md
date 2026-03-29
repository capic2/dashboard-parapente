# Git Workflow - Dashboard Parapente

Complete guide to using this repository.

---

## 🚀 Getting Started

### Clone (if pushing to remote later)

```bash
cd /home/capic/.openclaw/workspace/paragliding
git clone dashboard-repo
cd dashboard-repo
```

### Current Status

```bash
# Local repository at:
/home/capic/.openclaw/workspace/paragliding/dashboard-repo

# View commit history
git log --oneline

# View current branch
git branch -a

# Check status
git status
```

---

## 🌳 Branch Strategy

```
master              ← Production branch (launches May 10)
  ├── develop       ← Integration branch (merged from features)
  │   ├── feature/phase-2-scrapers
  │   ├── feature/phase-2-pipeline
  │   ├── feature/phase-3-api
  │   └── feature/phase-3-frontend
  └── hotfix/*      ← Emergency fixes (if needed)
```

---

## 📝 Phase-by-Phase Workflow

### Phase 2: Backend (March 1 - March 28)

```bash
# 1. Create feature branches
git checkout -b develop
git push origin develop

git checkout -b feature/phase-2-setup
# Week 1 work: Database + environment

git commit -m "Phase 2 Week 1: SQLite setup + Python environment"

git checkout develop
git merge feature/phase-2-setup
git push origin develop

# 2. Repeat for each week
git checkout -b feature/phase-2-scrapers
# Week 2 work: Refactor Open-Meteo, WeatherAPI, etc.

git commit -m "Phase 2 Week 2: Refactor weather scrapers + normalize wrappers"
git push origin feature/phase-2-scrapers
# Create PR for review

# 3. Continue for Weeks 3-4
git checkout -b feature/phase-2-pipeline
git checkout -b feature/phase-2-scheduler
```

### Phase 3: Frontend (March 28 - April 25)

```bash
git checkout -b feature/phase-3-api
# Week 1: FastAPI endpoints

git checkout -b feature/phase-3-frontend
# Week 2: Vue.js components

git checkout -b feature/phase-3-deployment
# Week 3: Docker + production setup
```

---

## 📋 Commit Messages

**Format:** `[PHASE][WEEK] Task: Description`

**Examples:**

```bash
# Phase 2 work
git commit -m "[Phase 2][Week 1] Setup: Initialize SQLite database"
git commit -m "[Phase 2][Week 2] Scrapers: Refactor Open-Meteo client"
git commit -m "[Phase 2][Week 3] Pipeline: Implement data normalization"
git commit -m "[Phase 2][Week 4] Scheduler: Add APScheduler integration + tests"

# Phase 3 work
git commit -m "[Phase 3][Week 1] API: Implement weather endpoints"
git commit -m "[Phase 3][Week 2] Frontend: Create dashboard components"
git commit -m "[Phase 3][Week 3] Deploy: Add Docker + Nginx config"

# Bug fixes
git commit -m "[Bugfix] Fix Meteoblue scraper timeout issue"
```

---

## 🔄 Typical Development Day

```bash
# Morning: Start work
cd /home/capic/.openclaw/workspace/paragliding/dashboard-repo
git pull origin develop

# Throughout the day: Commit regularly
git add scrapers/openmeteo.py
git commit -m "[Phase 2][Week 2] Scrapers: Add error handling to Open-Meteo"

git add tests/test_openmeteo.py
git commit -m "[Phase 2][Week 2] Tests: Add unit tests for Open-Meteo scraper"

# Evening: Push work
git push origin feature/phase-2-scrapers

# When feature is complete
git checkout develop
git merge feature/phase-2-scrapers
git push origin develop
```

---

## 📚 Review Checklist (Before Merge)

- [ ] All tests pass: `pytest tests/ -v`
- [ ] Code coverage > 80%: `pytest --cov`
- [ ] Code style: `black . && flake8`
- [ ] Type hints: `mypy .`
- [ ] Updated README/docs if needed
- [ ] Commit messages are clear
- [ ] Feature is complete (no TODOs)

---

## 🚀 Launch Procedure (May 10)

```bash
# 1. Final testing
pytest tests/ -v
npm run build  # Frontend
npm run test

# 2. Tag release
git tag -a v1.0.0 -m "Launch: Dashboard Parapente v1.0.0"
git push origin v1.0.0

# 3. Merge to master
git checkout master
git merge develop
git push origin master

# 4. Deploy
# (Docker deployment steps here)
```

---

## 📖 References

- **[README.md](README.md)** — Project overview
- **[Backend](backend/README.md)** — Backend setup
- **[Frontend](frontend/README.md)** — Frontend setup
- **[Implementation Plan](docs/PHASE-1-DESIGN/dashboard-implementation-plan.md)** — Detailed timeline
- **[Code Reuse Plan](docs/PHASE-1-DESIGN/CODE-REUSE-PLAN.md)** — Existing code integration

---

## 🤔 Help

### Reset uncommitted changes

```bash
git reset --hard HEAD
```

### Undo last commit (unpushed)

```bash
git reset --soft HEAD~1
```

### View file changes

```bash
git diff scrapers/openmeteo.py
```

### Check history of a file

```bash
git log -p backend/requirements.txt
```

### Create a backup branch

```bash
git branch backup-before-refactor
```

---

**Repository:** `/home/capic/.openclaw/workspace/paragliding/dashboard-repo`  
**Start date:** February 26, 2026  
**Launch date:** May 10, 2026 🚀
