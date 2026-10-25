# ============================================
# Stage 1: Build Frontend with Nx
# ============================================
FROM node:24-alpine AS frontend-builder

WORKDIR /workspace

ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
ENV NX_NO_CLOUD=true

# Installer pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copier fichiers de configuration Nx et pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.base.json ./

# Copier uniquement les manifests pour conserver le cache des dépendances
# lorsque seul le code frontend change.
COPY libs/shared-types/package.json ./libs/shared-types/package.json
COPY libs/design-system/package.json ./libs/design-system/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json

# Installer toutes les dépendances (root + frontend)
RUN pnpm install --frozen-lockfile --config.enable-global-virtual-store=false

# Copier les sources après l'installation pour préserver le cache pnpm.
COPY libs/shared-types ./libs/shared-types
COPY libs/design-system ./libs/design-system
COPY apps/frontend ./apps/frontend

# Build frontend avec Nx
RUN --mount=type=secret,id=VITE_CESIUM_ION_TOKEN,env=VITE_CESIUM_ION_TOKEN,required=false \
    pnpm exec nx build frontend --configuration=production

# ============================================
# Stage 2: Backend Python avec Playwright
# ============================================
FROM python:3.15-slim AS backend-base

WORKDIR /app

ARG CODEX_CLI_VERSION=0.146.0
ENV CODEX_HOME=/app/codex-home

# Métadonnées
LABEL maintainer="Dashboard Parapente"
LABEL version="2.0.0-nx"
LABEL description="Paragliding weather dashboard - Nx Monorepo"
LABEL com.centurylinklabs.watchtower.enable="false"

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
    libegl1 \
    libegl-mesa0 \
    libgbm1 \
    libgl1-mesa-dri \
    libva-drm2 \
    libva2 \
    libgtk-3-0 \
    libavif16 \
    libfreetype6 \
    libjpeg62-turbo \
    liblcms2-2 \
    libopenjp2-7 \
    libraqm0 \
    libtiff6 \
    libwebp7 \
    libwebpdemux2 \
    libwebpmux3 \
    libxcb1 \
    zlib1g \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    mesa-vulkan-drivers \
    mesa-va-drivers \
    xdg-utils \
    curl \
    ffmpeg \
    rclone \
    patch \
    nodejs \
    npm \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Codex uses the persisted ChatGPT login mounted at CODEX_HOME in production.
RUN npm install --global "@openai/codex@${CODEX_CLI_VERSION}" && codex --version

# Copier requirements et installer packages Python
COPY apps/backend/requirements.txt ./

# Upgrade pip et installer dépendances
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Compile pinned overlay dependencies when wheels are unavailable for Python 3.15.
# Keep compilers and development headers out of the final runtime image.
FROM backend-base AS gopro-overlay-builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libc6-dev \
    pkg-config \
    libavif-dev \
    libfreetype6-dev \
    libjpeg62-turbo-dev \
    liblcms2-dev \
    libopenjp2-7-dev \
    libraqm-dev \
    libtiff-dev \
    libwebp-dev \
    libxcb1-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Installer GoPro Dashboard Overlay dans un venv créé dans l'image.
COPY --from=gopro-overlay-src / /app/gopro-overlay
# Enable time-bounded transparent GPX overlay renders, and prevent floating-point
# frame timestamps from repeatedly restarting the PIP decoder.
COPY docker/gopro-overlay/video-frame-source.patch /tmp/video-frame-source.patch
COPY docker/gopro-overlay/enable-gpx-overlay-time-ranges.py /tmp/enable-gpx-overlay-time-ranges.py
RUN rm -rf /app/gopro-overlay/venv && \
    patch -d /app/gopro-overlay -p1 < /tmp/video-frame-source.patch && \
    python /tmp/enable-gpx-overlay-time-ranges.py /app/gopro-overlay/gopro_overlay/arguments.py && \
    rm /tmp/video-frame-source.patch /tmp/enable-gpx-overlay-time-ranges.py && \
    python -m venv /app/gopro-overlay/venv && \
    /app/gopro-overlay/venv/bin/pip install --no-cache-dir --upgrade pip setuptools wheel && \
    /app/gopro-overlay/venv/bin/pip install --no-cache-dir -e /app/gopro-overlay

# The editable install and its venv retain the same path in the runtime image.
FROM backend-base AS backend
COPY --from=gopro-overlay-builder /app/gopro-overlay /app/gopro-overlay
RUN /app/gopro-overlay/venv/bin/pip check && \
    /app/gopro-overlay/venv/bin/python -c 'from PIL import ImageFont; ImageFont.load_default(size=16)' && \
    /app/gopro-overlay/venv/bin/python /app/gopro-overlay/bin/gopro-dashboard.py --help > /dev/null

# Installer Chromium pour Playwright
RUN playwright install chromium

# Copier code backend
COPY apps/backend/ ./

# Copier frontend build depuis stage 1 (Nx output)
COPY --from=frontend-builder /workspace/dist/apps/frontend ./static

# Créer répertoires pour la base de données et les exports vidéo
RUN mkdir -p /app/db && chmod 755 /app/db && \
    mkdir -p /app/exports/videos && chmod 755 /app/exports/videos && \
    mkdir -p /app/emagram-cache && chmod 755 /app/emagram-cache && \
    mkdir -p "$CODEX_HOME" && chmod 700 "$CODEX_HOME"

# Rendre les scripts de maintenance exécutables
RUN chmod +x entrypoint.sh database_backup.sh

# This changes for every deployment, so keep it after the expensive dependency
# layers to preserve their BuildKit cache.
ARG BACKEND_DEPLOY_VERSION
ENV BACKEND_DEPLOY_VERSION=${BACKEND_DEPLOY_VERSION}
ARG BACKEND_RELEASE_NOTES_URL
ENV BACKEND_RELEASE_NOTES_URL=${BACKEND_RELEASE_NOTES_URL}

# Exposer port
EXPOSE 8001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Lancer application avec migration automatique
CMD ["./entrypoint.sh"]
