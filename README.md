# eProcurement

eProcurement is organized as a TypeScript npm monorepo for the web app, API, and shared JavaScript/TypeScript code.

## Workspaces

- `Frontend` - Next.js web application published as `@centralprocure/web`.
- `apps/api` - TypeScript Express API published as `@centralprocure/api`.
- `packages/shared` - Shared TypeScript package for reusable types and utilities.
- `Backend` - Legacy .NET backend kept for reference while business logic is ported to `apps/api`.

## Commands

Run Node commands from the repository root:

```bash
npm install
npm run dev
npm run dev:api
npm run start:api
npm run build
npm run typecheck
```

The root `package-lock.json` is the workspace lockfile. Do not run separate installs inside `Frontend` unless you intentionally want to regenerate a nested app lockfile.

## Deployment

Use the root `render.yaml` to deploy both active TypeScript services:

- `centralprocure-api` - Docker service built from `apps/api/Dockerfile`.
- `centralprocure-web` - Node service built with `npm ci && npm run build:web`.

Required production environment variables:

- API: `CORS_ALLOWED_ORIGINS`, `DATABASE_URL`, `JWT_KEY`.
- Web: `NEXT_PUBLIC_BACKEND_URL`.

The old `.NET` backend is retained only as legacy reference code and is not part of the active deployment configuration.
