# Frontend (Nigeria Immigration Service)

This directory hosts the combined vendor-facing and internal user interfaces for the Nigeria Immigration Service (NIS).

This application will be built using Next.js 16 (React + TypeScript) and will provide functionalities for:

-   Departmental Dashboards
-   Procurement Requisition
-   Requisition Tracking
-   Procurement Planning
-   Tender Creation and Management
-   Bid Opening and Evaluation
-   Approval Workflows
-   Contract Management
-   Audit and Compliance Monitoring
-   User and Role Management

... and other internal administrative tasks as outlined in the project documentation, plus the vendor-facing portal.

## Render

This app is part of the root npm monorepo. Prefer deploying from the root `render.yaml`, which defines both `centralprocure-web` and `centralprocure-api`.

Deploy flow:

1. Create a new Blueprint from the repository root.
2. Use the Node runtime.
3. Set `NEXT_PUBLIC_API_URL` to your API base URL, for example `http://localhost:5000` locally.
4. Set `NEXT_PUBLIC_APP_BASE_PATH` only if you are serving the app from a subpath.

Render notes:

-   Build command: `npm ci && npm run build:web`
-   Start command: `npm run start -w @centralprocure/web`
-   The production start script uses `next start`, which lets Render provide the port via the `PORT` environment variable.
-   `NEXT_PUBLIC_*` variables are compiled into the frontend bundle at build time, so changing them requires a new deploy.

## Coding Standards & Naming Conventions

-   **Frontend (React/TypeScript):** All components, variables, properties, and types must use **PascalCase**.
-   **Database (PostgreSQL):** All schemas, tables, and columns must use **snake_case**.
-   **API Data Transformation:** Ensure that API responses in snake_case are mapped to PascalCase objects in the frontend as required.
