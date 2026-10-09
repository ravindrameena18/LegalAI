# LegalAI

## 1. Project Overview

LegalAI is an AI-powered legal document analysis and decision-support system. It helps authorized users upload PDF, DOCX, and TXT files, understand their contents, identify clauses and potential risks, ask document-aware questions, and generate evidence-backed reports.

LegalAI does not provide legal advice and is not a substitute for a qualified legal professional.

## 2. Project Goals

- Provide secure, private document workspaces.
- Extract and analyze document content without inventing unsupported facts.
- Preserve page, section, clause, and source-text references for important findings.
- Separate product, document-processing, AI-provider, storage, and retrieval concerns.
- Support production integrations without exposing secrets to the browser.

## 3. Features

Planned product capabilities include:

- Authentication, secure sessions, email verification, password reset, and RBAC.
- Dashboard metrics for documents, analyses, risks, and reports.
- Upload, validation, preview, metadata, search, filtering, sorting, rename, and deletion.
- Text extraction for PDF, DOCX, and TXT, with OCR for scanned PDFs where configured.
- Structured analysis covering summaries, parties, dates, obligations, rights, payment terms, termination, renewal, governing law, dispute resolution, confidentiality, liability, indemnity, intellectual property, non-compete, data protection, warranties, and representations.
- Clause extraction, risk detection, document-aware chat, reports, notifications, and audit logs.
- A future legal research boundary that reports `External legal research is not configured.` until a verified provider is connected.

## 4. Technology Stack

| Area | Decision | Purpose |
| --- | --- | --- |
| Web application | Next.js, React, TypeScript | Responsive authenticated product UI and server-side web concerns |
| API and workers | FastAPI, Python | Typed HTTP API, extraction, orchestration, and background jobs |
| Database | PostgreSQL | Users, permissions, document metadata, analysis, findings, reports, and audit records |
| Retrieval | pgvector initially | Embeddings and source-grounded retrieval close to relational data |
| Jobs and rate limits | Redis | Queue coordination, progress events, caching, and throttling |
| File storage | S3-compatible private bucket | Encrypted document originals and derived artifacts |
| AI | `AIProvider` interface | Switchable OpenAI, Gemini, Anthropic, or local implementations |
| OCR | Provider adapter | Optional OCR for scanned documents; no OCR service is assumed |
| Validation | Pydantic and shared TypeScript schemas | Reject malformed API and AI data before display |
| Testing | Pytest, Vitest, Playwright | Unit, integration, API, and browser coverage |

Versions are pinned by the frontend lockfile and backend `pyproject.toml` ranges. External providers remain configuration boundaries until implemented.

## 5. System Architecture

```text
Browser
  -> Next.js web application
  -> authenticated FastAPI API
      -> PostgreSQL + pgvector
      -> private object storage
      -> Redis queue / progress / rate limits
      -> document-processing worker
          -> extractors -> OCR adapter -> chunker -> metadata
          -> embedding adapter -> retrieval index
          -> AIProvider -> schema validation -> persisted findings
```

The browser never calls an AI provider directly and never receives public document URLs. Long-running analysis is asynchronous and exposes explicit processing states.

## 6. Folder Structure

The current monorepo layout is:

```text
LegalAI/
├── apps/
│   └── web/                 # Next.js product UI and typed API client
├── services/
│   └── api/                 # FastAPI API, SQLAlchemy models, Alembic, tests
├── packages/
│   ├── contracts/           # API and structured-result schemas
│   └── ui/                  # Shared UI primitives when justified
├── docker-compose.yml        # Local PostgreSQL/pgvector and Redis services
├── infrastructure/          # Future deployment manifests
├── docs/                    # Design decisions and operational runbooks
├── tests/                   # Cross-service and end-to-end tests
├── .env.example
└── README.md
```

## 7. Frontend Architecture

The web app currently has an App Router shell with shared navigation, responsive dark legal-tech styling, route entry points, and a typed health API client. Authentication is not simulated. Server state, upload workflows, source highlighting, loading/error systems, and feature modules are planned.

## 8. Backend Architecture

FastAPI currently exposes `GET /health`, CORS, security headers, request IDs, structured error handling, environment settings, and OpenAPI. Routers remain thin; authorization, domain services, repositories, storage adapters, and job orchestration remain separate. Resource authorization and background workers are planned.

## 9. AI Architecture

The AI layer will depend on an `AIProvider` protocol rather than a vendor SDK. Provider configuration is server-only. Prompts will separate system instructions, user instructions, and untrusted document content. Models must return structured results that are validated against schemas before persistence or display. Each finding carries evidence when available and otherwise uses exactly `Not found in the provided document.`

A provider failure, timeout, invalid response, or missing configuration is surfaced as an actionable status; it is never presented as a successful analysis.

## 10. Database Architecture

Core entities and relationships:

- `User`, `Role`, and workspace membership control identity and access.
- `Document` owns versions; each `DocumentVersion` owns pages and chunks.
- `Analysis` belongs to a document version and owns `Clause`, `Risk`, and generic `Finding` records.
- `ChatSession` owns `ChatMessage` records and references document versions used for retrieval.
- `Report` belongs to a document or analysis; `Notification` belongs to a user.
- `AuditLog` records security-relevant actions without copying document contents.

Foreign keys, unique constraints, status enums, timestamps, and indexes will be defined through migrations. Large binary content stays in object storage; PostgreSQL stores metadata, extracted references, and structured results.

## 11. Document Processing Pipeline

```text
Upload -> validate -> private storage -> extract text -> OCR if needed
-> page/section-aware chunking -> metadata -> embeddings -> retrieval index
-> structured AI analysis -> schema validation -> database -> UI/report
```

Supported inputs initially are PDF, DOCX, and TXT. Extractors are adapters so additional formats can be added without changing analysis services. Processing records progress through `Uploading`, `Processing`, `Extracting text`, `Analyzing`, `Detecting clauses`, `Checking risks`, `Generating insights`, and `Completed`; failures retain a user-safe reason and an operational correlation ID.

## 12. Security Architecture

- Passwords use a modern adaptive password hash; sessions use secure, HTTP-only cookies or equivalent server-managed tokens.
- API routes require authentication and enforce resource-level authorization and roles.
- Uploads are size- and type-validated, stored privately, and processed as untrusted input.
- Malware scanning, archive abuse limits, content-disposition controls, and isolated workers are deployment requirements.
- Secrets are environment-managed and absent from client bundles and source control.
- Rate limiting, CSRF protection where applicable, structured error handling, dependency scanning, and audit logging are required before production.
- Logs exclude document text, prompts containing sensitive content, tokens, and provider secrets.

## 13. Authentication

**Status: Phase 3A Implemented**

The authentication foundation is implemented across backend and frontend:

- **Registration (`POST /api/auth/register`):**
  - Accepts `name`, `email`, `password`, `confirmPassword`, and optional `role` (defaults to `LAWYER`, allows `CLIENT` or `ADMIN`).
  - Strict input validation: email normalization (lowercased and whitespace stripped), name requirements, password strength policy (minimum 8 characters, uppercase, lowercase, number, symbol), and password confirmation match.
  - Duplicate email detection returning `409 Conflict`.
  - Password hashing using modern **Argon2** via `pwdlib[argon2]`. Plaintext passwords are never stored.
  - Generates secure JWT and sets an HTTP-only, `SameSite=Lax` cookie (`legalai_session`) alongside returning token in response body.
- **Login (`POST /api/auth/login`):**
  - Accepts `email` and `password`.
  - Verifies credentials against Argon2 hash and checks account active status (`is_active`).
  - Returns `401 Unauthorized` for invalid credentials without revealing whether email exists.
  - Sets HTTP-only `legalai_session` cookie and returns user profile and JWT token.
- **Session & Identity Check (`GET /api/auth/me`):**
  - Protected endpoint supporting dual authorization: inspects HTTP-only `legalai_session` cookie or `Authorization: Bearer <token>` header.
  - Verifies token signature, expiration (8 hours), and user status; returns current user identity and role.
- **Logout (`POST /api/auth/logout`):**
  - Clears `legalai_session` HTTP-only cookie and invalidates client session state.
- **Frontend State & Protection:**
  - `AuthProvider` and `useAuth` hook manage reactive auth state (`user`, `isLoading`, `isAuthenticated`, `error`).
  - Route protection via Next.js middleware (`src/middleware.ts`) and client-side guards redirect unauthenticated access to `/login?from=...` for protected routes (`/dashboard`, `/documents`, `/analysis`, `/assistant`, `/research`, `/reports`, `/settings`).
  - Authenticated visits to `/login` or `/register` redirect automatically to `/dashboard`.
  - App navigation shell displays real-time user name, role badge, initials avatar, and interactive sign out button.

*Planned future extensions: Email verification links, password reset via SMTP, refresh token rotation, and multi-factor authentication (MFA).*

## 14. Authorization / Roles
## 14. Authorization / Roles & RBAC

- **ADMIN:** System configuration, user administration, security auditing, and operational management.
- **LAWYER:** Full workspace access: document uploading, AI analysis, clause extraction, risk assessment, and report generation.
- **CLIENT:** Read/review access: view assigned documents, summaries, and generated reports.
**Status: Phase 3B Implemented**

Role enforcement is performed at the API layer with `require_roles(...)` dependencies (deny-by-default), preventing client-side bypass. Default registration assigns the `LAWYER` role unless explicitly registered as `CLIENT`.
Role-based access control (RBAC) and document ownership boundaries are enforced at the API layer with deny-by-default dependencies:

- **Roles & Permissions Matrix:**
  - **ADMIN:** Full administrative governance. Permissions: `users:manage`, `system:manage`, `audit:view`, `document:view`, `report:view`.
  - **LAWYER:** Legal professional workbench. Permissions: `document:upload`, `document:view`, `document:delete`, `document:analyze`, `assistant:use`, `report:generate`, `report:view`.
  - **CLIENT:** Client portal review. Permissions: `document:upload`, `document:view`, `report:view`.
- **Document Ownership Isolation:**
  - Every document possesses a strict owner boundary (`owner_id` foreign key).
  - User A cannot access User B's private documents.
  - To prevent existence enumeration oracles, cross-user document access returns `404 Not Found` rather than `403 Forbidden`.
- **Audit Logging Foundation:**
  - Dedicated service (`app.services.audit`) recording structured operational and security events (`auth.register`, `auth.login`, `auth.login_failed`, `auth.logout`).
  - Zero-credential scrubbing: passwords, tokens, API keys, and authorization headers are recursively redacted prior to persistence.
- **Rate Limiting:**
  - Adaptive rate limiter (`app.security.rate_limit`) protecting authentication endpoints.
  - Connects to Redis when available; falls back immediately to an in-memory window cache when Redis is unconfigured in development.
- **Frontend Role Awareness:**
  - The frontend navigation and interface adapt based on the authenticated user's role (`LAWYER` receives workbench tools; `CLIENT` sees client portal; `ADMIN` sees system audit logs).
  - *Security Notice:* Frontend role tailoring is for user ergonomics; the backend API enforces all permissions and ownership boundaries.

## 15. API Documentation

### Implemented Authentication Endpoints (Phase 3A)
### Implemented Authentication & RBAC Endpoints (Phase 3)

```text
POST /api/auth/register    # Register a new user (assigns LAWYER or CLIENT)
POST /api/auth/login       # Authenticate credentials, issue cookie + token
POST /api/auth/logout      # Clear session cookie and invalidate session
GET  /api/auth/me          # Fetch current user profile (cookie or Bearer)
POST /api/auth/register       # Register new user (assigns LAWYER or CLIENT, rate limited)
POST /api/auth/login          # Authenticate credentials, issue cookie + token (rate limited)
POST /api/auth/logout         # Invalidate session and clear session cookie
GET  /api/auth/me             # Retrieve authenticated user profile (cookie or Bearer)
GET  /api/documents           # List documents belonging to authenticated user (ownership bound)
GET  /api/documents/{id}      # Access specific document (verifies ownership; 404 on unowned)
GET  /api/admin/audit-logs    # Access audit records (restricted to ADMIN via audit:view)
```

*(Note: `/auth/*` is also supported as a direct alias for all auth endpoints).*

### Planned REST Surface (Future Phases)

```text
POST /api/documents/upload
GET  /api/documents
GET  /api/documents/{id}
DELETE /api/documents/{id}
POST /api/documents/upload    # Multipart document upload (Phase 4)
DELETE /api/documents/{id}    # Delete document & versions (Phase 4)
POST /api/documents/{id}/analyze
GET  /api/documents/{id}/analysis
GET  /api/documents/{id}/clauses
GET  /api/documents/{id}/risks
POST /api/documents/{id}/chat
POST /api/reports/generate
GET  /api/reports/{id}
```

OpenAPI generated by FastAPI will be the executable API reference. Every endpoint will define authentication, authorization, validation, errors, pagination, and rate-limit behavior before implementation.

## 16. Environment Variables

Copy `.env.example` to a local server-only environment file. Do not commit real values.

- `APP_ENV`, `WEB_ORIGIN`, `API_ORIGIN`, `NEXT_PUBLIC_API_BASE_URL`, and `CORS_ORIGINS`: runtime, browser API, and allowed-origin configuration.
- `DATABASE_URL`: PostgreSQL connection string.
- `REDIS_URL`: Redis connection string.
- `STORAGE_PROVIDER` and `STORAGE_*`: private S3-compatible storage configuration.
- `JWT_SECRET`, `SESSION_SECRET`, and `ENCRYPTION_KEY`: generated server secrets.
- `AI_PROVIDER`, `AI_API_KEY`, and model settings: optional server-side AI configuration.
- `OCR_PROVIDER` and OCR credentials: optional scanned-document support.
- `SMTP_*`: optional email delivery for verification and password reset.

Unset integrations must produce explicit configuration errors rather than fake results.

## 17. Installation Instructions

Prerequisites are Node.js/npm, Python/pip, Docker Desktop for local PostgreSQL and Redis, and Git. PostgreSQL and Redis clients were not available on the development machine; Docker Compose is provided instead. From the repository root:

```text
cd apps/web
npm install
npm run dev
```

In a second terminal:

```text
cd services/api
python -m pip install -e ".[test]"
uvicorn app.main:app --reload --port 8000
```

Copy `.env.example` to `.env` at the repository root before running configured services. No real secrets are included.

## 18. Development Instructions

Work in phases. Keep secrets out of Git, run focused tests after each change, and update this README whenever a capability or integration boundary changes. Prefer small domain modules and typed contracts over duplicated request-specific logic. Start local infrastructure with `docker compose up -d postgres redis`, then run `cd services/api; alembic upgrade head` after installing backend dependencies.

## 19. Production Deployment

The intended deployment separates the web app, API, worker, PostgreSQL, Redis, object storage, and observability. Use TLS, private networking, encrypted backups, managed secret storage, least-privilege service identities, retention policies, malware scanning, migrations, health checks, and tested restore procedures. A deployment provider is intentionally not selected in Phase 1.

## 20. Testing

### Backend Tests
Execute unit and API tests across authentication, password hashing, role enforcement, and health checks:
```bash
cd services/api
python -m pytest
```

### Frontend Tests, Lint, and Build
Execute frontend testing suite (Vitest + Testing Library), code quality checks, and production build:
```bash
cd apps/web
npm test
npm run lint
npm run build
```

## 21. Troubleshooting

- **AI unavailable:** verify `AI_PROVIDER` and server-side credentials; the UI should show configuration or provider failure, not a fabricated result.
- **Scanned PDF has no text:** configure the OCR adapter and inspect processing status.
- **Upload rejected:** check supported extension, detected MIME type, size limit, and malware-scan result.
- **Permission denied:** verify authenticated session and workspace membership; do not broaden access as a workaround.
- **Stalled processing:** inspect worker health, Redis, storage, database, and correlation ID in operational logs.

## 22. Known Limitations

The frontend shell, `/health` API, and Phase 3A authentication foundation are fully implemented. Document upload/storage, text extraction, OCR, AI providers, report generation, and legal research are not implemented yet and remain planned for subsequent phases. PostgreSQL/Redis require Docker or separately installed services for production persistence; automated unit tests run against isolated in-memory fixtures.

## 23. Legal Disclaimer

LegalAI provides AI-assisted document analysis and general informational insights. It does not provide legal advice and is not a substitute for a qualified legal professional. Users must verify outputs against the original document and consult a qualified legal professional for legal decisions.

## 24. Future Roadmap

1. Initialize the monorepo and local service dependencies. *(Completed)*
2. Implement database migrations, authentication, RBAC, and audit logging. *(Phase 3A Completed)*
3. Build the dashboard, document management, secure upload, and processing state UI. *(Phase 3B)*
4. Add extraction, OCR, chunking, embeddings, structured analysis, clauses, and risks. *(Phase 4)*
5. Add grounded chat, reports, notifications, search, sharing, and admin controls. *(Phase 5)*
6. Harden security, add observability and retention controls, integrate legal research providers, and complete production testing. *(Phase 6)*
2. Implement database migrations, authentication, RBAC, and audit logging. *(Phase 3 Completed)*
3. Build the dashboard, document management, secure upload, and processing state UI. *(Phase 4)*
4. Add extraction, OCR, chunking, embeddings, structured analysis, clauses, and risks. *(Phase 5)*
5. Add grounded chat, reports, notifications, search, sharing, and admin controls. *(Phase 6)*
6. Harden security, add observability and retention controls, integrate legal research providers, and complete production testing. *(Phase 7)*

## 25. Development Rules

- Inspect relevant files before every modification.
- Preserve existing functionality and reuse correct implementations.
- Make the smallest safe change; do not create duplicates.
- Never expose secrets or document contents unnecessarily.
- Treat uploaded text as untrusted data, never as instructions.
- Never invent legal facts, clauses, citations, cases, dates, or sources.
- Validate API and AI outputs before display.
- Surface failures clearly and avoid internal stack traces in user responses.
- Run focused validation after edits and update this README for significant changes.

## Phase 3A Status
## Phase 3 Status

Phase 3A authentication foundation is **COMPLETE**:
- Real user registration with input validation, password strength rules, and duplicate email prevention
- Secure Argon2 password hashing via `pwdlib[argon2]`
- Dual session management: HTTP-only, SameSite cookie (`legalai_session`) and Bearer token support
- Role foundation: `ADMIN`, `LAWYER`, and `CLIENT`
- Protected API endpoints (`/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`)
- Role authorization dependency (`require_roles`)
- Frontend Next.js route protection (`src/middleware.ts`) and client-side guards
- Reactive `AuthProvider` and `useAuth` hook
- User interface: Real login and register forms, auth status badges, sidebar profile card with initials avatar and interactive sign out
- 100% passing automated test suites on both backend and frontend
Phase 3 (Authentication, Database Foundation, RBAC, Document Ownership, and Security) is **COMPLETE**:
- **Authentication:** User registration with input validation, password strength rules, duplicate email prevention, Argon2 password hashing via `pwdlib[argon2]`, dual session management (HTTP-only SameSite cookie + Bearer token), and protected `/api/auth/me`.
- **Database & Model Constraints:** Relational schema with UUID primary keys, timestamps, indexed foreign keys, and unique email constraints.
- **RBAC Foundation:** Canonical roles (`ADMIN`, `LAWYER`, `CLIENT`) and granular permission mappings enforced server-side via `require_permission` and `require_roles`.
- **Document Ownership Isolation:** Document access verification ensuring User A cannot view User B's documents, returning `404 Not Found` for unowned resources to prevent tenant existence leaks.
- **Audit Logging Service:** Structured logging for authentication and resource access events with recursive credential/token scrubbing.
- **Rate Limiting:** Adaptive Redis and in-memory rate limiting on sensitive endpoints.
- **Frontend Role Awareness:** Role-tailored navigation in `AppShell` with explicit notices separating UX visibility from server authorization.
- **100% Automated Test Coverage:** Passing test suites across backend API, security policies, and frontend components.

