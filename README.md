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

## Estructura del Proyecto

```
transcribe-ai-monolith/
├── docker-compose.yml      # Docker Compose configuration
├── Dockerfile              # Container image definition
├── .env.example            # Environment variables template
├── README.md               # This file
├── config/
│   ├── nginx/
│   │   ├── nginx.conf      # Nginx main config
│   │   └── sites-available/transcribe-ai.conf
│   └── supervisor/
│       ├── supervisord.conf
│       ├── postgres.conf
│       ├── redis.conf
│       ├── backend.conf
│       └── worker.conf
├── scripts/
│   └── init.sh             # Initialization script
└── data/                   # (created at runtime)
    ├── uploads/            # Audio file uploads
    ├── postgres/           # PostgreSQL data
    ├── redis/              # Redis data
    └── logs/               # Application logs
```

## Configuración para Unraid

### Requisitos

- Unraid 6.12+ con Docker plugin
- Mínimo 4GB RAM (8GB recomendado)
- 20GB de espacio en disco para datos
- Usuario "nobody" o personalizado para el contenedor

### Pasos de Instalación

#### 1. Descargar la Imagen

En Unraid, ve a **Docker** > **Docker Repos** o usa terminal:

```bash
# Opción A: Build desde Dockerfile
git clone <repo-url> /mnt/user/appdata/transcribe-ai-monolith
cd /mnt/user/appdata/transcribe-ai-monolith
docker build -t transcribe-ai:latest .
```

#### 2. Configuración de Directorios

Crea los siguientes directorios en Unraid:

```bash
# Directorio principal de datos
mkdir -p /mnt/user/commons/transcribe-ai
mkdir -p /mnt/user/commons/transcribe-ai/uploads
mkdir -p /mnt/user/commons/transcribe-ai/postgres
mkdir -p /mnt/user/commons/transcribe-ai/redis
mkdir -p /mnt/user/commons/transcribe-ai/logs
```

#### 3. Configurar Docker en Unraid

Usa **Docker > Add Container** o crea el XML de configuración manualmente.

##### Opción A: UI de Unraid

1. **Configuración básica**:
   - Name: `transcribe-ai`
   - Repository: `transcribe-ai:latest` (o tu imagen personalizada)
   - Priority: CPU priority normal

2. **Puertos**:
   - Mapear `6001` (Frontend)
   - Mapear `6002` (Backend API)

3. **Volúmenes (Path Mappings)**:

   | Container Path | Host Path | Description |
   |----------------|-----------|-------------|
   | `/data` | `/mnt/user/commons/transcribe-ai` | Main data directory |
   | `/app/uploads` | `/mnt/user/commons/transcribe-ai/uploads` | Audio uploads |
   | `/var/lib/postgresql/data` | `/mnt/user/commons/transcribe-ai/postgres` | PostgreSQL data |
   | `/data` | `/mnt/user/commons/transcribe-ai/redis` | Redis data |
   | `/var/log` | `/mnt/user/commons/transcribe-ai/logs` | Application logs |

4. **Variables de Entorno**:
   ```
   POSTGRES_DB=transcribeai
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=<your_secure_password>
   REDIS_PASSWORD=<your_redis_password>
   JWT_SECRET=<your_jwt_secret>
   DATABASE_URL=postgresql://postgres:<your_password>@localhost:5432/transcribeai
   ```

5. **Recursos** (sin límites si no se especifica)

##### Opción B: Configuración XML Manual

Crea `/mnt/user/appdata/transcribe-ai/docker.cfg` o usa la terminal:

```bash
# Crear red Docker
docker network create transcribe-ai-network 2>/dev/null || true

# Ejecutar contenedor
docker run -d \
  --name transcribe-ai \
  --hostname transcribe-ai \
  --network transcribe-ai-network \
  -p 6001:6001 \
  -p 6002:6002 \
  -v /mnt/user/commons/transcribe-ai:/data \
  -v /mnt/user/commons/transcribe-ai/uploads:/app/uploads \
  -v /mnt/user/commons/transcribe-ai/postgres:/var/lib/postgresql/data \
  -v /mnt/user/commons/transcribe-ai/redis:/data \
  -v /mnt/user/commons/transcribe-ai/logs:/var/log \
  -e POSTGRES_DB=transcribeai \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=your_secure_password \
  -e JWT_SECRET=your_jwt_secret \
  -e DATABASE_URL=postgresql://postgres:your_secure_password@localhost:5432/transcribeai \
  -e REDIS_HOST=localhost \
  -e REDIS_PORT=6379 \
  -e USE_LOCAL_STORAGE=true \
  -e LOCAL_STORAGE_PATH=/app/uploads \
  -e FRONTEND_URL=http://localhost:6001 \
  -e NEXT_PUBLIC_API_URL=http://localhost:6002 \
  --restart unless-stopped \
  --privileged \
  transcribe-ai:latest
```

#### 4. Post-Instalación

Después de iniciar el contenedor:

1. **Acceder a la aplicación**:
   - Frontend: http://<unraid-ip>:6001
   - Backend API: http://<unraid-ip>:6002

2. **Verificar logs**:
   ```bash
   # Ver todos los logs
   docker exec transcribe-ai tail -f /var/log/supervisor/supervisord.log
   
   # Ver log específico
   docker exec transcribe-ai tail -f /var/log/supervisor/backend.log
   docker exec transcribe-ai tail -f /var/log/supervisor/worker.log
   docker exec transcribe-ai tail -f /var/log/supervisor/postgres.log
   ```

3. **Ver estado de servicios**:
   ```bash
   docker exec transcribe-ai supervisorctl status
   ```

4. **Reiniciar servicios**:
   ```bash
   docker exec transcribe-ai supervisorctl restart all
   docker exec transcribe-ai supervisorctl restart backend
   docker exec transcribe-ai supervisorctl restart worker
   ```

## Montaje de Grabaciones

El directorio `/mnt/user/commons/transcribe-ai` se usa para:

```
/mnt/user/commons/transcribe-ai/
├── uploads/          # Audio/video files uploaded for transcription
│   ├── audio_xxx.mp3
│   └── video_xxx.mp4
├── postgres/         # PostgreSQL database files (DO NOT EDIT)
├── redis/            # Redis persistence files
├── logs/             # Application logs
│   ├── supervisor/   # Supervisord and service logs
│   └── nginx/        # Nginx access/error logs
└── mermaid/         # Mermaid cache for mind map generation
```

## Comandos Útiles

### Gestionar Servicios

```bash
# Ver estado
docker exec transcribe-ai supervisorctl status

# Reiniciar backend
docker exec transcribe-ai supervisorctl restart backend

# Reiniciar worker
docker exec transcribe-ai supervisorctl restart worker

# Ver logs en tiempo real
docker exec -it transcribe-ai tail -f /var/log/supervisor/backend.log
```

### Backup

```bash
# Backup de base de datos
docker exec transcribe-ai pg_dump -U postgres transcribeai > backup_$(date +%Y%m%d).sql

# Backup de archivos de datos
tar -czvf transcribe-ai-backup.tar.gz /mnt/user/commons/transcribe-ai/

# Backup de uploads
tar -czvf uploads-backup.tar.gz /mnt/user/commons/transcribe-ai/uploads/
```

### Restaurar

```bash
# Restaurar base de datos
cat backup_20240101.sql | docker exec -i transcribe-ai psql -U postgres transcribeai

# Restaurar archivos
tar -xzvf transcribe-ai-backup.tar.gz -C /
```

## Resolución de Problemas

### El contenedor no inicia

```bash
# Ver logs de supervisor
docker logs transcribe-ai

# Ver procesos
docker exec transcribe-ai ps aux
```

### PostgreSQL no conecta

```bash
# Verificar PostgreSQL
docker exec transcribe-ai supervisorctl status postgres
docker exec transcribe-ai cat /var/log/supervisor/postgres.log

# Reiniciar PostgreSQL
docker exec transcribe-ai supervisorctl restart postgres
```

### Backend no responde

```bash
# Verificar backend
docker exec transcribe-ai supervisorctl status backend
docker exec transcribe-ai cat /var/log/supervisor/backend_err.log

# Ver si el proceso está escuchando
docker exec transcribe-ai netstat -tlnp | grep 6002
```

### Redis no conecta

```bash
# Verificar Redis
docker exec transcribe-ai supervisorctl status redis
docker exec transcribe-ai redis-cli -a <password> ping
```

### Permisos de archivos

```bash
# Corregir permisos
docker exec transcribe-ai chown -R postgres:postgres /var/lib/postgresql/data
docker exec transcribe-ai chown -R redis:redis /data
docker exec transcribe-ai chmod -R 777 /app/uploads
```

## Actualización

```bash
# Detener contenedor
docker stop transcribe-ai

# Hacer backup
cp -r /mnt/user/commons/transcribe-ai /mnt/user/commons/transcribe-ai-backup-$(date +%Y%m%d)

# Reconstruir imagen
cd /mnt/user/appdata/transcribe-ai-monolith
docker build -t transcribe-ai:latest .

# Iniciar
docker start transcribe-ai
```

## Notas de Seguridad

1. **Cambia las contraseñas** en el archivo `.env` antes de iniciar
2. **No expongas los puertos** 6001/6002 directamente a Internet en producción
3. Considera usar **Nginx Proxy Manager** o similar para SSL
4. Los archivos de datos en `/mnt/user/commons/` son accesibles por otros contenedores Docker

## Licencia

MIT
