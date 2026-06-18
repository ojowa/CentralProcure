# CentralProcure API

TypeScript Express API for CentralProcure.

## Local

```bash
npm run dev:api
```

The API defaults to `http://localhost:5000`.

## Environment

- `PORT` - API port. Defaults to `5000`.
- `CORS_ALLOWED_ORIGINS` - Comma-separated frontend origins, for example `http://localhost:6006`.
- `DATABASE_URL` - PostgreSQL connection string.
- `JWT_KEY` - JWT signing key for the final auth implementation.
- `JWT_ISSUER` - Defaults to `nis-eproc-identity`.
- `JWT_AUDIENCE` - Defaults to `nis-eproc-clients`.
- `JWT_DURATION_MINUTES` - Defaults to `1440`.

## Deploy

Use the root `render.yaml`. It builds this service with `apps/api/Dockerfile` and exposes `/health`.
