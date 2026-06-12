# Architecture — Todo Platform Application

## Services

| Service | Port (local) | Port (k8s) | Role |
|---|---|---|---|
| `frontend` | 5173 | 80 | React SPA served by Nginx |
| `auth-service` | 5001 | 3001 | User register / login / JWT |
| `todo-service` | 5002 | 3002 | JWT-protected todo CRUD |
| `postgres` | 5432 | 5432 | PostgreSQL 16 |

---

## Application Architecture

```mermaid
flowchart TD
    Browser[User Browser] --> FE[Frontend\nReact + Vite / Nginx]

    FE -- POST /api/auth/register\nPOST /api/auth/login --> AS[Auth Service\nNode.js / Express]
    FE -- GET/POST/PUT/DELETE /api/todos\nAuthorization: Bearer token --> TS[Todo Service\nNode.js / Express]

    AS -- users table --> PG[(PostgreSQL\nPort 5432)]
    TS -- todos table --> PG

    AS -. issues JWT .-> FE
    TS -. validates JWT .-> AS
```

---

## Authentication Flow

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant AS as Auth Service
    participant PG as PostgreSQL

    User->>FE: Fill register form
    FE->>AS: POST /api/auth/register { username, email, password }
    AS->>PG: INSERT INTO users (bcrypt hash)
    PG-->>AS: user row
    AS-->>FE: { token: "eyJ..." }
    FE->>FE: Store JWT in localStorage

    User->>FE: Fill login form
    FE->>AS: POST /api/auth/login { email, password }
    AS->>PG: SELECT user WHERE email = ?
    PG-->>AS: user row
    AS->>AS: bcrypt.compare(password, hash)
    AS-->>FE: { token: "eyJ..." }
```

---

## Todo Request Flow (JWT-protected)

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant TS as Todo Service
    participant PG as PostgreSQL

    User->>FE: Create / update / delete todo
    FE->>TS: POST /api/todos\nAuthorization: Bearer <token>
    TS->>TS: jwt.verify(token, JWT_SECRET)
    alt Token valid
        TS->>PG: INSERT INTO todos WHERE user_id = ?
        PG-->>TS: todo row
        TS-->>FE: 201 { id, title, completed }
    else Token invalid / missing
        TS-->>FE: 401 Unauthorized
    end
```

---

## Docker Compose Network

```mermaid
flowchart LR
    subgraph Docker[Docker Compose Network]
        FE[frontend\n:5173]
        AS[auth-service\n:5001]
        TS[todo-service\n:5002]
        PG[postgres\n:5432]
    end

    Host[localhost] --> FE
    Host --> AS
    Host --> TS
    FE --> AS
    FE --> TS
    AS --> PG
    TS --> PG
```

---

## CI/CD Pipeline Flow

```mermaid
flowchart LR
    Push[git push\nmain] --> GHA[GitHub Actions]

    subgraph Pipeline
        GHA --> Lint[ESLint]
        GHA --> Build[Vite Build]
        GHA --> TestA[Vitest\nauth-service]
        GHA --> TestT[Vitest\ntodo-service]
        TestA --> Coverage[Coverage LCOV]
        TestT --> Coverage
        Coverage --> Sonar[SonarCloud\nAnalysis]
        GHA --> Docker[Docker Build\nfrontend + auth + todo]
        Docker --> Trivy[Trivy\nVulnerability Scan]
        Docker --> Push2[Push to GHCR\n:build-number]
    end

    Push2 --> Flux[Flux Image\nAutomation]
    Flux --> GitOps[GitOps Repo\nHelmRelease updated]
    GitOps --> K8s[Kubernetes\nRolling Update]
```

---

## Database Schema

```sql
-- users table (owned by auth-service)
CREATE TABLE users (
    id       SERIAL PRIMARY KEY,
    username VARCHAR(50)  UNIQUE NOT NULL,
    email    VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,           -- bcrypt hash
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- todos table (owned by todo-service)
CREATE TABLE todos (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(255) NOT NULL,
    completed  BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Key Design Decisions

- **Auth service owns passwords.** The todo service never touches the `users` table directly. It only validates the JWT to extract `user_id`.
- **Shared `JWT_SECRET`.** Both services read `JWT_SECRET` from the same Kubernetes Secret (or Docker Compose env). Auth signs, Todo verifies.
- **User-scoped todos.** Every todo query filters by `user_id` decoded from the token — a user can only see and modify their own todos.
- **Metrics endpoint.** Both backend services expose `/metrics` (via `prom-client`) for Prometheus scraping in Kubernetes.
