# Commands Reference

## Docker Compose (local development)

```bash
# Start all services
docker compose up --build

# Run in background
docker compose up -d --build

# Stop all services
docker compose down

# Reset database (removes volumes)
docker compose down -v && docker compose up --build

# View logs for a specific service
docker compose logs -f auth-service
docker compose logs -f todo-service
```

---

## API Testing

> Local base URLs: `http://localhost:5001` (auth), `http://localhost:5002` (todos)
> Kubernetes URLs: `https://localhost:8443/api/auth`, `https://localhost:8443/api/todos`

### Register

```bash
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"rajdeep","email":"rajdeep@example.com","password":"password123"}'
```

### Login

```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rajdeep@example.com","password":"password123"}'
# Copy the token from the response
```

### Todo Operations

```bash
TOKEN="paste-your-jwt-token-here"

# List todos
curl http://localhost:5002/api/todos \
  -H "Authorization: Bearer $TOKEN"

# Create todo
curl -X POST http://localhost:5002/api/todos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Learn Kubernetes"}'

# Update todo
curl -X PUT http://localhost:5002/api/todos/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"completed":true}'

# Delete todo
curl -X DELETE http://localhost:5002/api/todos/1 \
  -H "Authorization: Bearer $TOKEN"
```

### Health checks

```bash
curl http://localhost:5001/health
curl http://localhost:5002/health
curl http://localhost:5001/metrics
curl http://localhost:5002/metrics
```

---

## Testing and Linting

```bash
# Lint all packages
npm run lint

# Build frontend
npm run build:frontend

# Run tests for auth-service
cd apps/auth-service && npm test

# Run tests with coverage
cd apps/auth-service && npm run test:coverage
cd apps/todo-service && npm run test:coverage
```

---

## PostgreSQL (inside Docker)

```bash
# Open psql shell
docker exec -it $(docker compose ps -q postgres) psql -U postgres -d todoapp

# Inside psql:
\dt                          -- list tables
SELECT * FROM users;
SELECT * FROM todos;
\q                           -- quit
```

---

## Kubernetes (via GitOps — no manual apply needed)

After Flux bootstraps, deployment is automatic. These are verification commands only:

```bash
kubectl get pods -n todo-platform
kubectl get svc -n todo-platform
kubectl get ingress -n todo-platform
kubectl logs deployment/todo-platform-auth-service -n todo-platform --tail=30
kubectl logs deployment/todo-platform-todo-service -n todo-platform --tail=30

# Force Flux reconciliation
flux reconcile helmrelease todo-platform -n flux-system
```

