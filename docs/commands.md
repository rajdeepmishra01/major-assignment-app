# Commands

## Docker Compose

```bash
docker compose up --build
```

## API Test

Register:

```bash
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"rajdeep","email":"rajdeep@example.com","password":"12345"}'
```

Login:

```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rajdeep@example.com","password":"12345"}'
```

Create Todo:

```bash
TOKEN="paste-token-here"
curl -X POST http://localhost:5002/api/todos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Learn Kubernetes"}'
```

## Kubernetes

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/postgres/
kubectl apply -f k8s/auth-service/
kubectl apply -f k8s/todo-service/
kubectl apply -f k8s/frontend/
```
