# Transcribe AI - Monolithic Docker Container

## Descripción

Contenedor Docker único que incluye:
- **Frontend**: Next.js (puerto 6001)
- **Backend**: Node.js/Express API (puerto 6002)
- **Worker**: Bull MQ worker para procesamiento
- **PostgreSQL 15**: Base de datos
- **Redis 7**: Cache y cola de mensajes
- **Nginx**: Proxy reverso
- **Supervisor**: Gestión de procesos

## Instalación Rápida con GitHub Container Registry

```bash
# Login a GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u TU_USUARIO --password-stdin

# Pull imagen
docker pull ghcr.io/pecha2k2/transcribe-ai:master

# Ejecutar
docker run -d \
  --name transcribe-ai \
  --hostname transcribe-ai \
  --privileged \
  -p 6001:6001 \
  -p 6002:6002 \
  -v /mnt/user/appdata/transcribe-ai-monolith/.env:/app/.env \
  -v /mnt/user/commons/transcribe-ai/postgres:/var/lib/postgresql/data \
  -v /mnt/user/commons/transcribe-ai/redis:/data \
  -v /mnt/user/commons/transcribe-ai/uploads:/app/backend/uploads \
  -v /mnt/user/commons/transcribe-ai/logs:/var/log \
  --restart unless-stopped \
  ghcr.io/pecha2k2/transcribe-ai:master
```

**Importante**: El archivo `.env` con tus secretos debe montarse desde el host (`-v /path/to/.env:/app/.env`). La imagen no contiene variables de entorno sensibles.

## Configuración de Variables de Entorno

Edita tu `.env` local y móntalo en el contenedor:

```bash
# Variables requeridas
OPENAI_API_KEY=tu_token_openai
DATABASE_URL=postgresql://postgres:tu_password@localhost:5432/transcribeai
REDIS_URL=redis://localhost:6379
JWT_SECRET=tu_jwt_secret
POSTGRES_PASSWORD=tu_password_postgres
```

## Puertos

| Puerto | Servicio |
|--------|----------|
| 6001 | Frontend (Next.js) |
| 6002 | Backend API |

## Estructura del Proyecto

```
transcribe-ai-monolith/
├── docker-compose.yml      # Docker Compose configuration
├── Dockerfile              # Container image definition
├── .env.example            # Environment variables template
├── README.md               # This file
├── config/
│   ├── nginx/              # Nginx configuration
│   └── supervisor/         # Supervisor configs
├── scripts/                # Entrypoint scripts
└── frontend/               # Next.js frontend
    └── backend/            # Express API backend
```

## Comandos Útiles

```bash
# Ver estado de servicios
docker exec transcribe-ai supervisorctl status

# Ver logs
docker exec transcribe-ai tail -f /var/log/supervisor/supervisord.log
docker exec transcribe-ai tail -f /var/log/supervisor/backend.log

# Reiniciar servicios
docker exec transcribe-ai supervisorctl restart all

# Backup PostgreSQL
docker exec transcribe-ai pg_dump -U postgres transcribeai > backup.sql
```

## Actualización

```bash
# Detener y remover contenedor
docker stop transcribe-ai && docker rm transcribe-ai

# Pull nueva imagen
docker pull ghcr.io/pecha2k2/transcribe-ai:master

# Iniciar de nuevo (tus datos persisten en los volúmenes)
docker run -d [tus_opciones] ghcr.io/pecha2k2/transcribe-ai:master
```

## Construcción Local

```bash
git clone https://github.com/pecha2k2/transcribe-ai.git
cd transcribe-ai/transcribe-ai-monolith
docker build -t transcribe-ai:local .
```

## Notas de Seguridad

1. **No expongas los puertos** 6001/6002 directamente a Internet
2. Usa un proxy reverso con SSL (Nginx Proxy Manager, Traefik, etc.)
3. Los volúmenes montados contienen datos sensibles
4. Cambia todas las contraseñas antes de producción

## Licencia

MIT
