# Troubleshooting — Application

## Docker Compose Issues

### Port already in use

```bash
# Find what's using the port
lsof -i :5001   # auth-service
lsof -i :5002   # todo-service
lsof -i :5173   # frontend
lsof -i :5432   # postgres

# Stop any running compose stack first
docker compose down
```

### Image pull timeout (postgres or node)

```bash
# Pull manually first
docker pull postgres:16-alpine
docker pull node:20-alpine

# Then retry
docker compose up --build
```

### Database reset (schema errors, stale data)

```bash
docker compose down -v   # removes volumes
docker compose up --build
```

### Container exits immediately

```bash
docker compose logs auth-service
docker compose logs todo-service
```

Common causes:
- `DATABASE_URL` is wrong or postgres is not ready yet — services retry on start, but if postgres takes too long, increase the `depends_on` healthcheck timeout in `docker-compose.yml`
- Missing env variable — check the `environment:` block in `docker-compose.yml`

---

## API Issues

### 401 Unauthorized on /api/todos

Token is missing or malformed. Ensure:
```bash
# Header must be exactly:
Authorization: Bearer eyJ...

# Not:
Authorization: eyJ...
Authorization: bearer eyJ...
```

### 400 Bad Request on register/login

Check the request body — field names must match exactly:
- Register: `{ username, email, password }`
- Login: `{ email, password }`

### Cannot connect to auth-service from todo-service

In Docker Compose, use the service name as hostname:
```
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/todoapp
```
Not `localhost` — that only works on the host machine.

---

## Test / CI Issues

### SonarCloud coverage upload fails

The LCOV path in `sonar-project.properties` must be relative to the repo root:
```properties
sonar.javascript.lcov.reportPaths=apps/auth-service/coverage/lcov.info,apps/todo-service/coverage/lcov.info
```

### Vitest tests fail with DB connection error

Unit tests should mock the database. If integration tests need a real DB, run:
```bash
docker compose up -d postgres
cd apps/auth-service && npm test
```

### ESLint errors blocking CI

Run locally first:
```bash
npm run lint
```
Fix all errors before pushing. Warnings are allowed; errors fail the pipeline.

---

## Docker Build Issues

### COPY failed — file not found

Each Dockerfile's COPY paths are relative to the **service directory** (the build context), not the repo root.

```dockerfile
# Correct — build context is apps/auth-service/
COPY package.json .
COPY src/ ./src/

# Wrong — src/app.js does not exist at the repo root level
COPY apps/auth-service/src/app.js .
```

### Image too large

Use multi-stage builds and `.dockerignore` to exclude `node_modules/`, `coverage/`, and `*.test.js` files.

