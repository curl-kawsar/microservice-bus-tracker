# Bus Tracker - VPS Deployment Guide

This guide covers deploying the Bus Tracker application on a VPS (Virtual Private Server).

## Prerequisites

- **VPS Requirements**:
  - Ubuntu 22.04 LTS (recommended) or similar Linux distribution
  - Minimum 2GB RAM, 2 CPU cores
  - 20GB storage
  - Open ports: 80, 443, 4000 (or your chosen port)

- **Domain** (optional but recommended):
  - A domain name pointed to your VPS IP address

---

## Step 1: Initial Server Setup

### 1.1 Connect to your VPS

```bash
ssh root@your-server-ip
```

### 1.2 Update system packages

```bash
apt update && apt upgrade -y
```

### 1.3 Create a non-root user (recommended)

```bash
adduser bustracker
usermod -aG sudo bustracker
su - bustracker
```

---

## Step 2: Install Docker & Docker Compose

### 2.1 Install Docker

```bash
# Install dependencies
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### 2.2 Install Docker Compose

```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker-compose --version
```

---

## Step 3: Clone & Configure the Application

### 3.1 Clone the repository

```bash
cd ~
git clone https://github.com/your-username/bus-tracker.git
cd bus-tracker
```

Or upload your project files via SCP:

```bash
# From your local machine
scp -r ./Bus bustracker@your-server-ip:~/bus-tracker
```

### 3.2 Create environment file

```bash
nano .env
```

Add the following environment variables:

```env
# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# MongoDB URIs (using Docker internal network)
AUTH_MONGO_URI=mongodb://auth-mongo:27017/auth_db
BUS_MONGO_URI=mongodb://bus-mongo:27017/bus_db
TRACKING_MONGO_URI=mongodb://tracking-mongo:27017/tracking_db
ANALYTICS_MONGO_URI=mongodb://analytics-mongo:27017/analytics_db

# RabbitMQ
RABBITMQ_URL=amqp://rabbitmq:5672

# Service URLs (internal Docker network)
AUTH_SERVICE_URL=http://auth-service:4001
BUS_SERVICE_URL=http://bus-service:4002
TRACKING_SERVICE_URL=http://tracking-service:4003
ANALYTICS_SERVICE_URL=http://analytics-service:4004

# Production settings
NODE_ENV=production
```

### 3.3 Update docker-compose.yml for production

Create or update `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  # MongoDB instances
  auth-mongo:
    image: mongo:7
    volumes:
      - auth-mongo-data:/data/db
    restart: always

  bus-mongo:
    image: mongo:7
    volumes:
      - bus-mongo-data:/data/db
    restart: always

  tracking-mongo:
    image: mongo:7
    volumes:
      - tracking-mongo-data:/data/db
    restart: always

  analytics-mongo:
    image: mongo:7
    volumes:
      - analytics-mongo-data:/data/db
    restart: always

  # RabbitMQ
  rabbitmq:
    image: rabbitmq:3-management
    volumes:
      - rabbitmq-data:/var/lib/rabbitmq
    restart: always

  # Microservices
  auth-service:
    build: ./services/auth-service
    environment:
      - AUTH_MONGO_URI=mongodb://auth-mongo:27017/auth_db
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - auth-mongo
    restart: always

  bus-service:
    build: ./services/bus-service
    environment:
      - BUS_MONGO_URI=mongodb://bus-mongo:27017/bus_db
    depends_on:
      - bus-mongo
    restart: always

  tracking-service:
    build: ./services/tracking-service
    environment:
      - TRACKING_MONGO_URI=mongodb://tracking-mongo:27017/tracking_db
      - RABBITMQ_URL=amqp://rabbitmq:5672
    depends_on:
      - tracking-mongo
      - rabbitmq
    restart: always

  analytics-service:
    build: ./services/analytics-service
    environment:
      - ANALYTICS_MONGO_URI=mongodb://analytics-mongo:27017/analytics_db
      - RABBITMQ_URL=amqp://rabbitmq:5672
    depends_on:
      - analytics-mongo
      - rabbitmq
    restart: always

  # API Gateway
  gateway:
    build: ./apps/gateway
    ports:
      - "4000:4000"
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - AUTH_SERVICE_URL=http://auth-service:4001
      - BUS_SERVICE_URL=http://bus-service:4002
      - TRACKING_SERVICE_URL=http://tracking-service:4003
      - ANALYTICS_SERVICE_URL=http://analytics-service:4004
    depends_on:
      - auth-service
      - bus-service
      - tracking-service
      - analytics-service
    restart: always

  # Frontend
  web:
    build: ./apps/web
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://your-domain.com:4000
    depends_on:
      - gateway
    restart: always

volumes:
  auth-mongo-data:
  bus-mongo-data:
  tracking-mongo-data:
  analytics-mongo-data:
  rabbitmq-data:
```

---

## Step 4: Build & Deploy

### 4.1 Build and start the application

```bash
# Build all images
docker-compose -f docker-compose.prod.yml build

# Start all services in detached mode
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 4.2 Create initial admin user

```bash
# Access auth-service container
docker exec -it $(docker ps -qf "name=auth-service") sh

# Or create via API
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-secure-password",
    "name": "Administrator",
    "role": "ADMIN"
  }'
```

---

## Step 5: Setup Nginx Reverse Proxy (Recommended)

### 5.1 Install Nginx

```bash
sudo apt install -y nginx
```

### 5.2 Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/bustracker
```

Add the following configuration:

```nginx
# Frontend
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# API Gateway
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5.3 Enable the site

```bash
sudo ln -s /etc/nginx/sites-available/bustracker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Step 6: Setup SSL with Let's Encrypt (Recommended)

### 6.1 Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 6.2 Obtain SSL certificates

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com -d api.your-domain.com
```

### 6.3 Auto-renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot automatically adds a cron job for renewal
```

---

## Step 7: Setup Firewall

```bash
# Allow SSH
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Step 8: Monitoring & Maintenance

### View logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f gateway
docker-compose -f docker-compose.prod.yml logs -f web
```

### Restart services

```bash
# Restart all
docker-compose -f docker-compose.prod.yml restart

# Restart specific service
docker-compose -f docker-compose.prod.yml restart gateway
```

### Update application

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

### Backup MongoDB data

```bash
# Create backup directory
mkdir -p ~/backups

# Backup all databases
docker exec $(docker ps -qf "name=auth-mongo") mongodump --out /dump
docker cp $(docker ps -qf "name=auth-mongo"):/dump ~/backups/auth-mongo-$(date +%Y%m%d)

docker exec $(docker ps -qf "name=bus-mongo") mongodump --out /dump
docker cp $(docker ps -qf "name=bus-mongo"):/dump ~/backups/bus-mongo-$(date +%Y%m%d)

docker exec $(docker ps -qf "name=tracking-mongo") mongodump --out /dump
docker cp $(docker ps -qf "name=tracking-mongo"):/dump ~/backups/tracking-mongo-$(date +%Y%m%d)

docker exec $(docker ps -qf "name=analytics-mongo") mongodump --out /dump
docker cp $(docker ps -qf "name=analytics-mongo"):/dump ~/backups/analytics-mongo-$(date +%Y%m%d)
```

---

## Troubleshooting

### Check container status

```bash
docker-compose -f docker-compose.prod.yml ps
```

### View container logs

```bash
docker logs <container-name> --tail 100
```

### Restart a stuck container

```bash
docker-compose -f docker-compose.prod.yml restart <service-name>
```

### Check disk space

```bash
df -h
docker system df
```

### Clean up unused Docker resources

```bash
docker system prune -a
```

### MongoDB connection issues

```bash
# Check if MongoDB is running
docker exec -it $(docker ps -qf "name=auth-mongo") mongosh --eval "db.adminCommand('ping')"
```

---

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT tokens | `your-super-secret-key` |
| `NODE_ENV` | Environment mode | `production` |
| `AUTH_MONGO_URI` | Auth service MongoDB URI | `mongodb://auth-mongo:27017/auth_db` |
| `BUS_MONGO_URI` | Bus service MongoDB URI | `mongodb://bus-mongo:27017/bus_db` |
| `TRACKING_MONGO_URI` | Tracking service MongoDB URI | `mongodb://tracking-mongo:27017/tracking_db` |
| `ANALYTICS_MONGO_URI` | Analytics service MongoDB URI | `mongodb://analytics-mongo:27017/analytics_db` |
| `RABBITMQ_URL` | RabbitMQ connection URL | `amqp://rabbitmq:5672` |

---

## Architecture Overview

```
                    ┌─────────────┐
                    │   Nginx     │
                    │ (SSL/Proxy) │
                    └──────┬──────┘
                           │
            ┌──────────────┴──────────────┐
            │                             │
            ▼                             ▼
     ┌─────────────┐              ┌─────────────┐
     │  Frontend   │              │   Gateway   │
     │  (Next.js)  │              │   (Hono)    │
     │   :3000     │              │   :4000     │
     └─────────────┘              └──────┬──────┘
                                         │
         ┌───────────┬───────────┬───────┴───────┐
         │           │           │               │
         ▼           ▼           ▼               ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
   │   Auth   │ │   Bus    │ │ Tracking │ │Analytics │
   │ Service  │ │ Service  │ │ Service  │ │ Service  │
   │  :4001   │ │  :4002   │ │  :4003   │ │  :4004   │
   └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
        │            │            │            │
        ▼            ▼            ▼            ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ MongoDB  │ │ MongoDB  │ │ MongoDB  │ │ MongoDB  │
   │  (Auth)  │ │  (Bus)   │ │(Tracking)│ │(Analytics│
   └──────────┘ └──────────┘ └──────────┘ └──────────┘
                                  │
                                  ▼
                           ┌──────────┐
                           │ RabbitMQ │
                           └──────────┘
```

---

## Support

For issues or questions, please open an issue on the GitHub repository.
