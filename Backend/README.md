# Backend (.NET)

## Location
- Repository root: `./`
- API host: `eProcurement.Api.csproj`
- Modules: `Modules/`
- Shared library: `Shared/`

## Build
```powershell
dotnet build ".\eProcurement.Api.csproj"
```

### Build Command (sandbox-safe)
```powershell
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE='1'
$env:DOTNET_CLI_HOME='C:\Users\OJOWA\Documents\Project 4\CentralProcure\.dotnet'
$env:MSBuildEnableWorkloadResolver='false'
dotnet restore ".\eProcurement.Api.csproj"
dotnet build ".\eProcurement.Api.csproj" -v:minimal --no-restore
```

## Run
```powershell
dotnet run --project ".\eProcurement.Api.csproj"
```

## Docker
Build the backend image from the repository root:

```powershell
docker build -t centralprocure-backend .
```

Run the backend container against an existing PostgreSQL instance:

```powershell
docker run --rm -p 8080:8080 `
  -e ASPNETCORE_URLS=http://+:8080 `
  -e ConnectionStrings__Primary="Host=host.docker.internal;Port=5432;Database=NIS_EPROCUREMENT;Username=postgres;Password=postgres" `
  -e Jwt__Key="CHANGE_THIS_TO_A_LONG_RANDOM_SECRET_AT_LEAST_32_CHARS" `
  -e Jwt__Issuer="nis-eproc-identity" `
  -e Jwt__Audience="nis-eproc-clients" `
  centralprocure-backend
```

## Render
This repo includes a Render Blueprint at `render.yaml` for a Docker web service only. It does not auto-create or auto-bootstrap a database.

Deploy flow:

1. Create a new Blueprint service in Render from this repository.
2. When Render reads `render.yaml`, set `ConnectionStrings__Primary` to your existing Render Postgres internal connection string.
3. Set `Jwt__Key` to a strong secret.

If you prefer the dashboard, create a new Web Service from this repository and use the same environment variable names manually.

Render-specific notes:
- The backend is proxy-aware and respects Render forwarded headers.
- The app can bind to Render's injected `PORT` automatically.
- Health check path is `/health`.
- This repo now includes `../database_schema/render-bootstrap.sql` plus its referenced migrations, procedures, and seed files for initializing a brand-new PostgreSQL database.
- Apply that bootstrap manually before first use of a new database.

Bootstrap example:

```powershell
psql "<render-internal-or-external-db-url>?sslmode=require" -f "..\\database_schema\\render-bootstrap.sql"
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
