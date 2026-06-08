# Troubleshooting

## Docker Hub TLS timeout

Retry the pull:

```bash
docker pull postgres:16-alpine
```

Or temporarily change the image in `docker-compose.yml` to:

```yaml
image: postgres:15
```

## Port already allocated

```bash
docker compose down
sudo lsof -i :5001
sudo lsof -i :5002
sudo lsof -i :5173
```

## Database reset

```bash
docker compose down -v
docker compose up --build
```
