FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Directory.Build.props ./
COPY eProcurement.Api.csproj ./
COPY Shared/eProcurement.Shared.csproj Shared/
COPY Modules/eProcurement.Modules.Identity/eProcurement.Modules.Identity.csproj Modules/eProcurement.Modules.Identity/
COPY Modules/eProcurement.Modules.VendorSourcing/eProcurement.Modules.VendorSourcing.csproj Modules/eProcurement.Modules.VendorSourcing/
COPY Modules/eProcurement.Modules.ProcurementWorkflow/eProcurement.Modules.ProcurementWorkflow.csproj Modules/eProcurement.Modules.ProcurementWorkflow/
COPY Modules/eProcurement.Modules.PostAward/eProcurement.Modules.PostAward.csproj Modules/eProcurement.Modules.PostAward/
COPY Modules/eProcurement.Modules.Governance/eProcurement.Modules.Governance.csproj Modules/eProcurement.Modules.Governance/

RUN dotnet restore eProcurement.Api.csproj

COPY . .
RUN dotnet publish eProcurement.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "eProcurement.Api.dll"]
