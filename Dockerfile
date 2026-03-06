# ============================================
# Stage 1: Build Frontend
# ============================================
FROM node:24-alpine AS frontend-builder

WORKDIR /app/frontend

# Copier fichiers de dépendances
COPY frontend/package*.json ./

# Installer dépendances
RUN npm ci --legacy-peer-deps

# Copier code source
COPY frontend/ ./

# Build production
RUN npm run build

# ============================================
# Stage 2: Backend Python avec Playwright
# ============================================
FROM python:3.13-slim

WORKDIR /app

# Métadonnées
LABEL maintainer="Dashboard Parapente"
LABEL version="1.0.0"
LABEL description="Paragliding weather dashboard with Para-Index scoring"

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
COPY backend/requirements.txt ./

# Upgrade pip et installer dépendances
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Installer Playwright et navigateur Chromium
RUN playwright install --with-deps chromium

# Copier code backend
COPY backend/ ./

# Copier frontend build depuis stage 1
COPY --from=frontend-builder /app/frontend/dist ./static

# Créer répertoires pour la base de données et les exports vidéo
RUN mkdir -p /app/db && chmod 755 /app/db && \
    mkdir -p /app/exports/videos && chmod 755 /app/exports/videos

# Exposer port
EXPOSE 8001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8001/ || exit 1

# Lancer application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--proxy-headers", "--forwarded-allow-ips", "*"]
