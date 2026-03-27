#!/bin/bash

echo "========================================="
echo "Transcribe AI - Entrypoint"
echo "========================================="

echo "[1/5] Creating directories..."
mkdir -p /var/lib/postgresql/data /data /app/uploads /var/log/supervisor /var/log/nginx /tmp/mermaid
chown -R postgres:postgres /var/lib/postgresql 2>/dev/null || true
chown -R redis:redis /data 2>/dev/null || true
chmod 777 /app/uploads /data

if [ -f "/app/.env" ]; then
    echo "[2/5] Loading environment from /app/.env..."
    set -a
    source /app/.env
    set +a
fi

echo "[3/5] Initializing PostgreSQL..."
if [ ! -f /var/lib/postgresql/data/postgresql.conf ]; then
    mkdir -p /var/lib/postgresql/data
    chown postgres:postgres /var/lib/postgresql/data
    su postgres -c '/usr/lib/postgresql/14/bin/initdb -D /var/lib/postgresql/data' 2>/dev/null || true
fi

echo "[4/5] Starting PostgreSQL and waiting for it to be ready..."
su postgres -c '/usr/lib/postgresql/14/bin/postgres -D /var/lib/postgresql/data' &
POSTGRES_PID=$!

for i in {1..30}; do
    if su postgres -c "psql -c 'SELECT 1' > /dev/null 2>&1"; then
        echo "PostgreSQL is ready!"
        break
    fi
    echo "Waiting for PostgreSQL... ($i/30)"
    sleep 1
done

echo "[5/5] Setting up database..."
su postgres -c "createdb transcribeai" 2>/dev/null || true
su postgres -c "psql -d transcribeai -c \"ALTER USER postgres WITH PASSWORD '${POSTGRES_PASSWORD:-transcribeai_postgres_pass}';\"" 2>/dev/null || true
su postgres -c "psql -d transcribeai -c \"GRANT ALL PRIVILEGES ON DATABASE \\\"transcribeai\\\" TO postgres;\"" 2>/dev/null || true

cd /app/backend && DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD:-transcribeai_postgres_pass}@localhost:5432/transcribeai" npx prisma db push --skip-generate 2>/dev/null || true

echo "========================================="
echo "Starting services via supervisord..."
echo "========================================="

exec "$@"
