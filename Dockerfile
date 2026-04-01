# ============================================
# Transcribe AI — Multi-stage build
# Stage 1: Backend (TypeScript compile)
# Stage 2: Frontend (Next.js standalone)
# Stage 3: Runtime (Node + PG + Redis + Nginx + Supervisor)
# ============================================

# ── Stage 1: Backend builder ─────────────────
FROM node:20-slim AS backend-builder
WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/ ./
RUN npx prisma generate && npm run build && npm prune --omit=dev

# ── Stage 2: Frontend builder ────────────────
FROM node:20-slim AS frontend-builder
WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
ARG NEXT_PUBLIC_API_URL=http://localhost:6002
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# ── Stage 3: Runtime ─────────────────────────
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Europe/Madrid

# Install Node.js + runtime services only (no Chromium, no Python, no dev tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends \
        nodejs \
        postgresql-14 \
        postgresql-client-14 \
        redis-server \
        nginx \
        supervisor \
        dumb-init \
    && rm -rf /var/lib/apt/lists/*

# ── PostgreSQL setup ──────────────────────────
RUN mkdir -p /var/lib/postgresql/data && \
    chown -R postgres:postgres /var/lib/postgresql

# ── Redis setup ───────────────────────────────
RUN mkdir -p /var/lib/redis && chown redis:redis /var/lib/redis && \
    printf 'bind 127.0.0.1 ::1\nprotected-mode yes\nport 6379\ndaemonize no\ndir /data\ndbfilename dump.rdb\nappendonly no\n' \
    > /etc/redis/redis.conf

# ── Nginx setup ───────────────────────────────
RUN mkdir -p /var/www/html /var/log/nginx && \
    chown -R www-data:www-data /var/www/html

# ── Directories ───────────────────────────────
RUN mkdir -p /app /data /app/uploads /var/log/supervisor /var/run/supervisor && \
    chmod 777 /app/uploads /data

# ── Copy backend artifacts ────────────────────
COPY --from=backend-builder /app/dist           /app/backend/dist
COPY --from=backend-builder /app/node_modules   /app/backend/node_modules
COPY --from=backend-builder /app/prisma         /app/backend/prisma
COPY --from=backend-builder /app/package.json   /app/backend/package.json

# ── Copy frontend artifacts (standalone) ──────
COPY --from=frontend-builder /app/.next/standalone  /app/frontend
COPY --from=frontend-builder /app/.next/static      /app/frontend/.next/static
COPY --from=frontend-builder /app/public            /app/frontend/public

# ── Config files ──────────────────────────────
COPY config/supervisor/supervisord.conf /etc/supervisor/supervisord.conf
COPY config/supervisor/*.conf           /etc/supervisor/conf.d/
COPY config/nginx/nginx.conf            /etc/nginx/nginx.conf
COPY config/nginx/sites-available/*    /etc/nginx/sites-available/

RUN ln -sf /etc/nginx/sites-available/transcribe-ai.conf /etc/nginx/sites-enabled/ && \
    rm -f /etc/nginx/sites-enabled/default

# ── Env template (overridden at runtime via volume/.env) ──
COPY .env.example /app/.env

# ── Startup scripts ───────────────────────────
COPY scripts/*.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh

WORKDIR /app

RUN touch /var/log/supervisor/supervisord.log \
          /var/log/supervisor/transcribe-ai.log \
          /var/log/nginx/access.log \
          /var/log/nginx/error.log && \
    chown -R root:adm /var/log/supervisor /var/log/nginx

EXPOSE 6001 6002

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
