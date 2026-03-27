#!/bin/bash
# ============================================
# Transcribe AI - Build Script
# ============================================
# This script builds the Docker image for the monolithic container
# It assumes the backend and frontend source code exist in sibling directories

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOLITH_DIR="${SCRIPT_DIR}"

echo "========================================="
echo "Transcribe AI - Monolith Build Script"
echo "========================================="

# Check if source directories exist
TRANSCRIBE_AI_SOURCE="${MONOLITH_DIR}/../transcribe-ai"

if [ -d "${TRANSCRIBE_AI_SOURCE}/backend" ] && [ -d "${TRANSCRIBE_AI_SOURCE}/frontend" ]; then
    echo "[1/4] Copying source code from ${TRANSCRIBE_AI_SOURCE}..."
    
    mkdir -p "${MONOLITH_DIR}/backend"
    mkdir -p "${MONOLITH_DIR}/frontend"
    
    cp -r "${TRANSCRIBE_AI_SOURCE}/backend/"* "${MONOLITH_DIR}/backend/" 2>/dev/null || true
    cp -r "${TRANSCRIBE_AI_SOURCE}/frontend/"* "${MONOLITH_DIR}/frontend/" 2>/dev/null || true
    
    echo "    ✓ Source code copied"
else
    echo "[!] Warning: Could not find transcribe-ai source at ${TRANSCRIBE_AI_SOURCE}"
    echo "    Please ensure backend and frontend directories exist"
fi

# Create .env from example if it doesn't exist
if [ ! -f "${MONOLITH_DIR}/.env" ]; then
    echo "[2/4] Creating .env file from template..."
    cp "${MONOLITH_DIR}/.env.example" "${MONOLITH_DIR}/.env"
    echo "    ✓ .env created from .env.example"
    echo "    ⚠ Please edit .env and add your API keys!"
else
    echo "[2/4] .env already exists, skipping..."
fi

# Build the Docker image
echo "[3/4] Building Docker image..."
docker build -t transcribe-ai:latest -f "${MONOLITH_DIR}/Dockerfile" "${MONOLITH_DIR}"
echo "    ✓ Image built: transcribe-ai:latest"

# Create data directories on host if they don't exist
echo "[4/4] Creating data directories..."
mkdir -p /mnt/user/commons/transcribe-ai
mkdir -p /mnt/user/commons/transcribe-ai/uploads
mkdir -p /mnt/user/commons/transcribe-ai/postgres
mkdir -p /mnt/user/commons/transcribe-ai/redis
mkdir -p /mnt/user/commons/transcribe-ai/logs
echo "    ✓ Data directories created at /mnt/user/commons/transcribe-ai/"

echo ""
echo "========================================="
echo "Build complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Edit .env and add your API keys:"
echo "   nano ${MONOLITH_DIR}/.env"
echo ""
echo "2. Start the container:"
echo "   cd ${MONOLITH_DIR}"
echo "   docker compose up -d"
echo ""
echo "3. Check logs:"
echo "   docker logs -f transcribe-ai"
echo "   docker exec transcribe-ai supervisorctl status"
echo ""
echo "4. Access the application:"
echo "   Frontend: http://localhost:6001"
echo "   Backend:  http://localhost:6002"
echo ""
