# Backend (.NET)

## Location
- Root folder: `Backend/`
- API host: `Backend/eProcurement.Api/`
- Modules: `Backend/Modules/`
- Shared library: `Backend/Shared/`

## Build
```powershell
dotnet build "Backend\eProcurement.Api\eProcurement.Api.csproj"
```

### Build Command (sandbox-safe)
```powershell
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE='1'
$env:DOTNET_CLI_HOME='C:\Users\OJOWA\Documents\Project 4\CentralProcure\.dotnet'
$env:MSBuildEnableWorkloadResolver='false'
dotnet restore "Backend\eProcurement.Api\eProcurement.Api.csproj"
dotnet build "Backend\eProcurement.Api\eProcurement.Api.csproj" -v:minimal --no-restore
```

## Run
```powershell
dotnet run --project "Backend\eProcurement.Api\eProcurement.Api.csproj"
```

## Docker
Build the backend image from the repository root:

```powershell
docker build -f Backend\Dockerfile -t centralprocure-backend Backend
```

Run the backend container against an existing PostgreSQL instance:

```powershell
docker run --rm -p 8080:8080 `
  -e ASPNETCORE_URLS=http://+:8080 `
  -e ConnectionStrings__Primary="Host=host.docker.internal;Port=5432;Database=NIS_EPROCUREMENT;Username=postgres;Password=postgres" `
  -e Security__PasswordPepper="CHANGE_THIS_PEPPER" `
  -e Jwt__Key="CHANGE_THIS_TO_A_LONG_RANDOM_SECRET_AT_LEAST_32_CHARS" `
  -e Jwt__Issuer="nis-eproc-identity" `
  -e Jwt__Audience="nis-eproc-clients" `
  centralprocure-backend
```

Run the backend plus PostgreSQL together:

```powershell
docker compose -f compose.backend.yml up --build
```

The compose stack exposes:
- Backend API: `http://localhost:8080`
- PostgreSQL: `localhost:5432`

The PostgreSQL image now initializes the schema, functions, procedures, and seed data automatically on the first startup of a fresh `postgres_data` volume.

If you need to rebuild the database from scratch, remove the volume first:

```powershell
docker compose -f compose.backend.yml down -v
docker compose -f compose.backend.yml up --build
```

## Render
This repo now includes a Render Blueprint at `render.yaml` for a Docker web service plus a managed PostgreSQL database.

Deploy flow:

```powershell
render blueprint launch
```

If you prefer the dashboard, create a new Blueprint service from this repository and let Render read `render.yaml`.

Render-specific notes:
- The backend is proxy-aware and now respects Render forwarded headers.
- The app can bind to Render's injected `PORT` automatically.
- Health check path is `/health`.

Render managed Postgres does not execute this repo's Docker init scripts. After the database is created, apply the schema manually with `psql` using `database_schema/render-bootstrap.sql`.

Example:

```powershell
psql "<render-external-database-url>?sslmode=require" -f "database_schema/render-bootstrap.sql"
```

## Coding Standards & Naming Conventions
- **Backend Code (.NET/C#):** All classes, methods, variables, and properties must use **PascalCase**.
- **Database (PostgreSQL):** All schemas, tables, and columns must use **snake_case**.
- **Mapping:** Use explicit mapping (e.g., `[Column("column_name")]` or Dapper `ColumnNameAttribute`) to bridge the PascalCase C# properties to snake_case DB columns.

## Migration Notes
- Legacy route contracts must remain stable while services are consolidated.
- Migrate by domain in this order: identity, vendor sourcing, procurement workflow, post-award, governance.
- Preserve critical UI-facing routes first: `/api/Auth/register`, `/api/Auth/login`, `/api/TenderManagement/open`, `/api/BidSubmission/submit`, `/api/VendorManagement/profile`.
- Do not retire a legacy route until both public and internal frontends pass validation.

## Recent Build Update (2026-03-06)
- Build hardening added via `Backend/Directory.Build.props` with backend-wide global usings.
- Shared middleware now includes explicit ASP.NET Core usings for consistent compilation.
- `PackageId` set in `Backend/eProcurement.Api/eProcurement.Api.csproj` to fix static web assets manifest generation.
