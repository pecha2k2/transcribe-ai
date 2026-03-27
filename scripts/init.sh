#!/bin/bash
set -e

echo "========================================="
echo "Transcribe AI - Initialization Script"
echo "========================================="

# Initialize PostgreSQL if not already done
echo "[1/5] Checking PostgreSQL..."
if [ ! -d "/var/lib/postgresql/data/base" ]; then
    echo "Initializing PostgreSQL data directory..."
    chown -R postgres:postgres /var/lib/postgresql/data
    su - postgres -c "/usr/lib/postgresql/14/bin/initdb -D /var/lib/postgresql/data" || true
fi

# Initialize Redis
echo "[2/5] Checking Redis..."
mkdir -p /data
chown redis:redis /data

# Create necessary directories
echo "[3/5] Creating directories..."
mkdir -p /app/uploads /data /var/log/supervisor /var/log/nginx
chmod 777 /app/uploads /data

# Set permissions
echo "[4/5] Setting permissions..."
chown -R root:root /app
chmod 755 /app/backend/dist/index.js 2>/dev/null || true

# Initialize database if needed
echo "[5/5] Database initialization..."
su - postgres -c "/usr/lib/postgresql/14/bin/pg_ctl -D /var/lib/postgresql/data -l /var/log/postgresql/postgresql.log start" 2>/dev/null || true
sleep 3

# Create database if not exists
su - postgres -c "createdb transcribeai" 2>/dev/null || true

# Run Prisma migrations
cd /app/backend
su - postgres -c "/usr/lib/postgresql/14/bin/psql -d transcribeai -c 'SELECT 1'" > /dev/null 2>&1 && \
    npx prisma migrate deploy 2>/dev/null || \
    npx prisma db push 2>/dev/null || true

echo "Initialization complete!"
