FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PIP_BREAK_SYSTEM_PACKAGES=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies: Python 3, pip, ffmpeg, fonts for subtitles
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    ffmpeg \
    fontconfig \
    fonts-noto-color-emoji \
    fonts-freefont-ttf \
    python3 \
    python3-pip \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install latest yt-dlp globally
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Set working directory
WORKDIR /app

# Copy package manifests
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/requirements.txt ./server/

# Install Node dependencies and Python dependencies
RUN npm ci --prefix client && npm install --omit=dev --ignore-scripts
RUN pip3 install --no-cache-dir --break-system-packages -r server/requirements.txt

# Copy source code
COPY . .

# Build frontend client for production serving
RUN npm --prefix client run build

# Ensure uploads, exports, previews have write permissions
RUN mkdir -p server/uploads/previews server/exports server/samples server/assets/sfx \
    && chmod -R 777 server/uploads server/exports server/samples

# Default port and binary paths (10000 is default for Render; can be overridden via PORT env var)
ENV PORT=10000
ENV NODE_ENV=production
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe

# Ensure execute permissions on binary wrappers if present
RUN chmod -R 755 /app/node_modules/@ffprobe-installer /app/node_modules/ffmpeg-static 2>/dev/null || true

EXPOSE 10000

CMD ["node", "server/server.js"]
