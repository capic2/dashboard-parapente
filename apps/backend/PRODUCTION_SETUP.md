# Production Setup Guide

## Prerequisites

### System Dependencies

The video export feature requires the following system packages:

#### FFmpeg
FFmpeg is required for video encoding (WebM to MP4 conversion).

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y ffmpeg
```

**Alpine Linux (Docker):**
```bash
apk add --no-cache ffmpeg
```

**Verify installation:**
```bash
ffmpeg -version
```

#### Playwright Browsers
Playwright requires Chromium browser and dependencies.

**Install Playwright browsers:**
```bash
# Activate virtual environment first
source venv/bin/activate

# Install Playwright browsers
python -m playwright install chromium

# Install browser dependencies (Ubuntu/Debian)
python -m playwright install-deps chromium
```

**For Docker/Alpine:**
```dockerfile
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont
```

### Environment Variables

Ensure these are set in production:

```bash
# API Configuration
VITE_API_URL=https://your-domain.com
VITE_ENABLE_MSW=false

# Database
DATABASE_URL=sqlite:///./db/dashboard.db

# Redis (optional, for caching)
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Docker Setup (Recommended)

If using Docker, update your `Dockerfile`:

```dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    chromium \
    chromium-driver \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Copy application
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers
RUN python -m playwright install chromium --with-deps

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
```

## Verification

After installation, verify all dependencies:

```bash
# Check FFmpeg
ffmpeg -version

# Check Playwright
python -c "from playwright.sync_api import sync_playwright; print('Playwright OK')"

# Check Chromium
python -m playwright install --dry-run chromium
```

## Troubleshooting

### FFmpeg not found
If you get `[Errno 2] No such file or directory: 'ffmpeg'`:
1. Install FFmpeg (see above)
2. Verify it's in PATH: `which ffmpeg`
3. Restart the backend service

### Playwright browser not found
If you get `Browser not found` error:
1. Install browsers: `python -m playwright install chromium`
2. Install dependencies: `python -m playwright install-deps chromium`

### Headless mode issues
If video export fails in headless mode:
1. Ensure all browser dependencies are installed
2. Check logs for GPU/WebGL errors
3. Try with `--disable-gpu` flag if GPU unavailable

### Permission issues
Ensure the exports directory is writable:
```bash
mkdir -p exports/videos
chmod 755 exports/videos
```

## Performance Tuning

### FFmpeg encoding speed
To speed up encoding, adjust preset in `video_export.py`:
- Current: `medium` (balanced)
- Faster: `fast` or `veryfast` (larger file size)
- Slower: `slow` or `veryslow` (better quality)

### Memory usage
Video export can be memory-intensive. Recommended:
- Minimum: 2GB RAM
- Recommended: 4GB+ RAM for 1080p exports

### Concurrent exports
Current implementation uses threads. For multiple concurrent exports:
- Consider using Celery with Redis/RabbitMQ
- Or limit concurrent exports to 1-2 at a time
