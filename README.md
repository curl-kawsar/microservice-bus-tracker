# Bus Tracker Microservice System

A microservice-based Bus Tracking web application built with Bun, Hono.js, MongoDB, RabbitMQ, and Next.js.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│                           Port: 3000                             │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway (Hono)                        │
│                           Port: 4000                             │
└─────────────────────────────────────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  Auth Service   │   │   Bus Service   │   │Tracking Service │
│   Port: 4001    │   │   Port: 4002    │   │   Port: 4003    │
└─────────────────┘   └─────────────────┘   └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
    ┌─────────┐            ┌─────────┐            ┌─────────┐
    │ MongoDB │            │ MongoDB │            │ MongoDB │
    └─────────┘            └─────────┘            └─────────┘
                                                         │
                                                         ▼
                                                  ┌──────────────┐
                                                  │   RabbitMQ   │
                                                  └──────────────┘
                                                         │
         ┌───────────────────────────────────────────────┘
         ▼
┌─────────────────────┐   ┌─────────────────────┐
│  Analytics Worker   │──▶│  Analytics Service  │
│  (RabbitMQ Consumer)│   │     Port: 4004      │
└─────────────────────┘   └─────────────────────┘
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| web | 3000 | Next.js frontend with Shadcn UI |
| gateway | 4000 | API Gateway with JWT validation |
| auth-service | 4001 | Authentication & Excel import |
| bus-service | 4002 | Bus & Tracker management |
| tracking-service | 4003 | GPS ingest & position storage |
| analytics-service | 4004 | Daily stats & predictions |
| analytics-worker | - | RabbitMQ consumer for analytics |

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Bun (for local development)

### Running with Docker

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Default Credentials

**Admin:**
- Username: `admin`
- Password: `admin123`

**Students (imported via Excel):**
- Username: `<studentId from Excel>`
- Password: `baiustbus123#`

## API Endpoints

### Auth Service (via Gateway)
- `POST /api/auth/login` - Login
- `POST /api/auth/verify` - Verify JWT token
- `POST /api/admin/students/import` - Import students from Excel

### Bus Service (via Gateway)
- `POST /api/admin/buses` - Create bus
- `GET /api/admin/buses` - List all buses
- `GET /api/admin/buses/:id` - Get bus details

### Tracking Service (via Gateway)
- `POST /api/tracking/ingest` - Ingest GPS data
- `GET /api/buses/:id/current-position` - Get current position
- `GET /api/buses/:id/today-path` - Get today's path

### Analytics Service (via Gateway)
- `GET /api/admin/buses/:id/daily-stats` - Get daily statistics

## Excel Import Format

The Excel file (.xlsx) for student import must have these columns:
- `studentId` - Unique student identifier
- `name` - Student's full name

## Environment Variables

See `.env.example` for all required environment variables.

## Development

```bash
# Install dependencies for a service
cd services/auth-service
bun install

# Run a service locally
bun run dev
```

## License

MIT
