# Major Assignment — Application Repository

Source code for the PERN microservices-based Todo Platform.

## Architecture

```text
Browser
  └── React Frontend (Vite, port 5173)
        ├── POST /api/auth/*  → Auth Service (Express, port 5001)
        └── GET/POST/PUT/DELETE /api/todos/*  → Todo Service (Express, port 5002)
                                                        ↓
                                                  PostgreSQL (port 5432)
```

## Services

| Service | Port | Description |
|---|---:|---|
| frontend | 5173 | React + Vite UI served by nginx |
| auth-service | 5001 | Register / login / JWT (2 h expiry) |
| todo-service | 5002 | JWT-protected todo CRUD |
| postgres | 5432 | PostgreSQL 16 database |

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2
- Node.js 20+ (for local development without Docker)

## Quick Start — Docker Compose

```bash
docker compose up --build
```

Open `http://localhost:5173`.

Health checks:

```bash
curl http://localhost:5001/health
curl http://localhost:5002/health
```

## App Flow

1. **Register** — create an account at `/register`
2. **Login** — authenticate at `/login`; a JWT is stored in `localStorage`
3. **Todos** — create, complete, and delete todos on the Dashboard; every request is validated by the Todo Service using the JWT

## Project Structure

```text
.
├── apps/
│   ├── auth-service/       # Node.js/Express — register, login, JWT
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       ├── server.js
│   │       ├── config/db.js
│   │       ├── middleware/errorHandler.js
│   │       └── routes/auth.routes.js
│   ├── todo-service/       # Node.js/Express — JWT-protected todo CRUD
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       ├── server.js
│   │       ├── config/db.js
│   │       ├── middleware/auth.middleware.js
│   │       ├── middleware/errorHandler.js
│   │       └── routes/todo.routes.js
│   ├── frontend/           # React 18 + Vite + React Router
│   │   ├── Dockerfile
│   │   ├── index.html
│   │   ├── nginx.conf
│   │   ├── vite.config.js
│   │   ├── package.json
│   │   └── src/
│   │       ├── App.jsx
│   │       ├── main.jsx
│   │       ├── index.css
│   │       ├── api/axios.js
│   │       └── pages/
│   │           ├── Login.jsx
│   │           ├── Register.jsx
│   │           └── Dashboard.jsx
│   └── database/
│       └── init.sql        # Schema bootstrap (users + todos tables)
├── docs/
│   ├── architecture.md
│   ├── commands.md
│   ├── demo-script.md
│   └── troubleshooting.md
├── docker-compose.yml
├── package.json            # Root — lint + frontend build scripts
└── .gitignore
```

## API Reference

### Auth Service — `/api/auth`

| Method | Path | Body | Description |
|---|---|---|---|
| POST | `/register` | `{ username, email, password }` | Create account, returns JWT |
| POST | `/login` | `{ email, password }` | Authenticate, returns JWT |

### Todo Service — `/api/todos` *(requires `Authorization: Bearer <token>`)*

| Method | Path | Body | Description |
|---|---|---|---|
| GET | `/` | — | List todos for authenticated user |
| POST | `/` | `{ title }` | Create todo |
| PUT | `/:id` | `{ title?, completed? }` | Update todo |
| DELETE | `/:id` | — | Delete todo |

## Environment Variables

Each service reads its config from environment variables (see `docker-compose.yml`).

| Variable | Service | Description |
|---|---|---|
| `DATABASE_URL` | auth, todo | PostgreSQL connection string |
| `JWT_SECRET` | auth, todo | Secret used to sign/verify JWTs |
| `PORT` | auth, todo | Listening port |
| `VITE_AUTH_API_URL` | frontend | Auth service base URL (build-time) |
| `VITE_TODO_API_URL` | frontend | Todo service base URL (build-time) |

Copy `.env.example` in each service directory and adjust values for local development.

## Local Development (without Docker)

```bash
# Install root dev dependencies (ESLint)
npm install

# Start PostgreSQL separately, then in each service:
cd apps/auth-service && npm install && npm run dev
cd apps/todo-service && npm install && npm run dev
cd apps/frontend    && npm install && npm run dev
```

## Linting & CI

```bash
npm run lint            # ESLint across all apps
npm run build:frontend  # Production build of the React app
npm run ci              # lint + build:frontend
```

## Docs

| File | Description |
|---|---|
| [docs/architecture.md](docs/architecture.md) | System design and component overview |
| [docs/commands.md](docs/commands.md) | Useful Docker / kubectl commands |
| [docs/demo-script.md](docs/demo-script.md) | Step-by-step demo walkthrough |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Common issues and fixes |