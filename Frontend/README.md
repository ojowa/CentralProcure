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

This repo can be deployed on Render as a Web Service using the included `render.yaml`.

Deploy flow:

1. Create a new Blueprint or Web Service from this repository.
2. Use the Node runtime.
3. Set `NEXT_PUBLIC_BACKEND_URL` to your deployed backend base URL, for example `https://centralprocure-backend.onrender.com`.
4. Set `NEXT_PUBLIC_APP_BASE_PATH` only if you are serving the app from a subpath.

Render notes:

-   Build command: `npm install && npm run build`
-   Start command: `npm start`
-   The production start script uses `next start`, which lets Render provide the port via the `PORT` environment variable.
-   `NEXT_PUBLIC_*` variables are compiled into the frontend bundle at build time, so changing them requires a new deploy.

## Coding Standards & Naming Conventions

-   **Frontend (React/TypeScript):** All components, variables, properties, and types must use **PascalCase**.
-   **Database (PostgreSQL):** All schemas, tables, and columns must use **snake_case**.
-   **API Data Transformation:** Ensure that API responses in snake_case are mapped to PascalCase objects in the frontend as required.
