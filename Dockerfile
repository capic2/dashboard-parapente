# syntax=docker/dockerfile:1
# ============================================
# Stage 1: Build Frontend with Nx
# ============================================
FROM node:24-alpine AS frontend-builder

WORKDIR /workspace

# Installer pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copier fichiers de configuration Nx et pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.base.json ./

# Copier libs (dépendances du frontend)
COPY libs/shared-types ./libs/shared-types
COPY libs/design-system ./libs/design-system

# Copier frontend
COPY apps/frontend ./apps/frontend

# Installer toutes les dépendances (root + frontend) avec cache pnpm
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Build frontend avec Nx
RUN pnpm exec nx build frontend --configuration=production

# ============================================
# Stage 2: Backend Python avec Playwright
# ============================================
FROM python:3.14-slim

WORKDIR /app

# Métadonnées
LABEL maintainer="Dashboard Parapente"
LABEL version="2.0.0-nx"
LABEL description="Paragliding weather dashboard - Nx Monorepo"

# Installer dépendances système (curl pour healthcheck, ffmpeg pour exports vidéo)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copier requirements et installer packages Python avec cache pip
COPY apps/backend/requirements.txt ./

RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt

# Installer Playwright et navigateur Chromium (installe aussi les deps système)
RUN playwright install --with-deps chromium

# Copier code backend
COPY apps/backend/ ./

# Copier frontend build depuis stage 1 (Nx output)
COPY --from=frontend-builder /workspace/dist/apps/frontend ./static

# Créer répertoires pour la base de données et les exports vidéo
RUN mkdir -p /app/db && chmod 755 /app/db && \
    mkdir -p /app/exports/videos && chmod 755 /app/exports/videos

# Rendre le script d'entrypoint exécutable
RUN chmod +x entrypoint.sh

# Exposer port
EXPOSE 8001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8001/ || exit 1

# Lancer application avec migration automatique
CMD ["./entrypoint.sh"]
