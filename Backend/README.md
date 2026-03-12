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
$env:DOTNET_MSBUILD_SDK_RESOLVER_SDKS_DIR='C:\Users\OJOWA\Documents\Project 4\CentralProcure\.dotnet-sdks\Sdks'
$env:MSBuildSDKsPath='C:\Users\OJOWA\Documents\Project 4\CentralProcure\.dotnet-sdks\Sdks'
dotnet build "Backend\eProcurement.Api\eProcurement.Api.csproj" -v:normal --no-restore /p:NETCoreSdkBundledVersionsProps="C:\Program Files\dotnet\sdk\10.0.103\Microsoft.NETCoreSdk.BundledVersions.props" /p:BuildInParallel=false
```

## Run
```powershell
dotnet run --project "Backend\eProcurement.Api\eProcurement.Api.csproj"
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
