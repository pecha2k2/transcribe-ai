# ============================================
# Transcribe AI - Monolithic Container
# Frontend + Backend + Worker + Redis + PostgreSQL
# ============================================

FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Europe/Madrid
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV CHROME_PATH=/usr/bin/chromium-browser

# Install base dependencies first (including curl for NodeSource)
RUN apt-get update && apt-get install -y \
    # Core system utilities
    wget \
    curl \
    git \
    vim \
    htop \
    net-tools \
    dnsutils \
    ca-certificates \
    gnupg \
    lsb-release \
    sudo \
    unzip \
    zip \
    bzip2 \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x from NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install remaining services
RUN apt-get update && apt-get install -y \
    # PostgreSQL
    postgresql \
    postgresql-client \
    # Redis 7
    redis-server \
    # Nginx
    nginx \
    # Supervisor
    supervisor \
    # Python3 for Mermaid rendering
    python3 \
    python3-pip \
    # Chromium for Mermaid CLI
    chromium-browser \
    # Process management
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Create application directories
RUN mkdir -p /app /data /var/log/supervisor /var/run/supervisor

# ============================================
# PostgreSQL Setup
# ============================================
RUN mkdir -p /var/lib/postgresql/main && \
    chown -R postgres:postgres /var/lib/postgresql

# Initialize PostgreSQL data directory (if not exists)
RUN mkdir -p /var/lib/postgresql/data && \
    chown -R postgres:postgres /var/lib/postgresql/data

# Configure PostgreSQL
RUN mkdir -p /etc/postgresql/main && \
    echo "host all all 0.0.0.0/0 md5" >> /etc/postgresql/main/pg_hba.conf && \
    echo "listen_addresses='*'" >> /etc/postgresql/main/postgresql.conf

# ============================================
# Redis Setup
# ============================================
RUN mkdir -p /var/lib/redis && \
    chown redis:redis /var/lib/redis

# Configure Redis
RUN echo "bind 127.0.0.1 ::1" > /etc/redis/redis.conf && \
    echo "protected-mode yes" >> /etc/redis/redis.conf && \
    echo "port 6379" >> /etc/redis/redis.conf && \
    echo "daemonize no" >> /etc/redis/redis.conf && \
    echo "dir /data" >> /etc/redis/redis.conf && \
    echo "dbfilename dump.rdb" >> /etc/redis/redis.conf && \
    echo "appendonly no" >> /etc/redis/redis.conf

# ============================================
# Nginx Setup
# ============================================
RUN mkdir -p /var/www/html /var/log/nginx && \
    chown -R www-data:www-data /var/www/html

# ============================================
# Application Setup
# ============================================

# Copy application files
COPY --chown=root:root . /app/

# Set proper ownership
RUN chown -R root:root /app

# Create uploads directory with proper permissions
RUN mkdir -p /app/uploads && \
    chmod 777 /app/uploads

# Create data directory for recordings
RUN mkdir -p /data && \
    chmod 777 /data

# ============================================
# Backend Setup
# ============================================
WORKDIR /app/backend

# Copy backend files
COPY --chown=root:root backend /app/backend

# Set environment to skip Chromium download for mermaid-cli
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV CHROME_PATH=/usr/bin/chromium-browser

# Install backend dependencies
RUN rm -rf node_modules package-lock.json && \
    npm install --legacy-peer-deps --force && \
    npx prisma generate

# Build backend
RUN npm run build || true

# ============================================
# Frontend Setup
# ============================================
WORKDIR /app/frontend

# Copy frontend files
COPY --chown=root:root frontend /app/frontend

# Install frontend dependencies - force clean install
RUN rm -rf node_modules package-lock.json .next && \
    npm install --legacy-peer-deps --force

# Build frontend
RUN NEXT_PUBLIC_API_URL=http://localhost:6002 npm run build || true

# ============================================
# Supervisor Configuration
# ============================================
COPY --chown=root:root config/supervisor/supervisord.conf /etc/supervisor/supervisord.conf
COPY --chown=root:root config/supervisor/*.conf /etc/supervisor/conf.d/

# ============================================
# Nginx Configuration
# ============================================
COPY --chown=root:root config/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --chown=root:root config/nginx/sites-available/* /etc/nginx/sites-available/

# Enable sites
RUN ln -sf /etc/nginx/sites-available/transcribe-ai.conf /etc/nginx/sites-enabled/ && \
    rm -f /etc/nginx/sites-enabled/default

# ============================================
# Environment File (template - override at runtime)
# ============================================
COPY --chown=root:root .env.example /app/.env

# ============================================
# Startup Scripts
# ============================================
COPY --chown=root:root scripts/*.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh

# ============================================
# Final Setup
# ============================================
WORKDIR /app

# Create log files
RUN touch /var/log/supervisor/supervisord.log && \
    touch /var/log/supervisor/transcribe-ai.log && \
    touch /var/log/nginx/access.log && \
    touch /var/log/nginx/error.log && \
    chown -R root:adm /var/log/supervisor /var/log/nginx

# Expose ports
EXPOSE 6001 6002

# Use entrypoint script for initialization
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Run supervisor as the main process
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
