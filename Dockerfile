# ============================================
# Stage 1: Build Frontend with Nx
# ============================================
FROM node:24-alpine AS frontend-builder

WORKDIR /workspace

# Installer pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copier fichiers de configuration Nx et pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.base.json ./

# Copier libs/shared-types (dépendance du frontend)
COPY libs/shared-types ./libs/shared-types

# Copier frontend
COPY apps/frontend ./apps/frontend

# Installer toutes les dépendances (root + frontend)
RUN pnpm install --frozen-lockfile

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

# Installer dépendances système pour Playwright et FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copier requirements et installer packages Python
COPY apps/backend/requirements.txt ./

# Upgrade pip et installer dépendances
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Installer Playwright et navigateur Chromium
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
