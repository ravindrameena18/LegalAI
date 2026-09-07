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

## 14. Authorization / Roles & RBAC

**Status: Phase 3B Implemented**

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

### Implemented Authentication & RBAC Endpoints (Phase 3)

```text
POST /api/auth/register       # Register new user (assigns LAWYER or CLIENT, rate limited)
POST /api/auth/login          # Authenticate credentials, issue cookie + token (rate limited)
POST /api/auth/logout         # Invalidate session and clear session cookie
GET  /api/auth/me             # Retrieve authenticated user profile (cookie or Bearer)
POST /api/documents/upload    # Secure multipart upload (PDF, DOCX, TXT with validation & text extraction)
GET  /api/documents           # List documents belonging to authenticated user (search, format & status filters)
GET  /api/documents/{id}      # Access specific document details & extracted page text (verifies ownership; 404 on unowned)
GET  /api/documents/{id}/download # Download original document file from private storage
DELETE /api/documents/{id}    # Delete document, version history, pages, and storage files
POST /api/documents/{id}/analyze # Trigger source-grounded Gemini legal analysis (24 sections, risk breakdown)
GET  /api/documents/{id}/analysis # Retrieve latest completed structured analysis for document
GET  /api/analyses/{id}       # Retrieve specific analysis by ID with relational entity counts
GET  /api/analyses            # List all analyses accessible to current authenticated user
GET  /api/analysis/provider-status # Check AI provider reachability & model status (safe, no secrets leaked)
GET  /api/stats               # Live aggregated workspace statistics for dashboard
GET  /api/admin/audit-logs    # Access audit records (restricted to ADMIN via audit:view)
```

*(Note: `/auth/*` is also supported as a direct alias for all auth endpoints).*

### Planned REST Surface (Future Phases)

```text
POST /api/documents/{id}/chat # Multi-turn document chat (Phase 6)
POST /api/reports/generate   # Export structured findings to PDF/DOCX reports (Phase 7)
GET  /api/reports/{id}
```

---

## 15A. Gemini AI Document Analysis (Phase 5)

LegalAI integrates Google's official Python SDK (`google-genai`) to provide source-grounded, structured contract analysis.

### 1. Gemini Configuration & Key Setup
1. Create a Google Gemini API key at [Google AI Studio](https://aistudio.google.com/).
2. Add the key to your local `.env` file:
   ```bash
   GEMINI_API_KEY=your_actual_api_key_here
   GEMINI_MODEL=gemini-2.5-flash
   ```
3. `GEMINI_MODEL` defaults to `gemini-2.5-flash` if unset.
4. **Zero Key Exposure**: The API key is stored strictly server-side, never sent to the browser, never written to the database, and never logged.
5. If `GEMINI_API_KEY` is missing, the system cleanly reports `"GEMINI_API_KEY is not configured."` without crashing or returning fake analysis.

### 2. 24-Section Canonical Structured Output
Every completed legal analysis validates against a strict Pydantic schema enforcing:
1. `Executive Summary`
2. `Document Type`
3. `Parties`
4. `Important Dates`
5. `Financial Terms`
6. `Obligations`
7. `Rights`
8. `Termination`
9. `Renewal`
10. `Confidentiality`
11. `Liability`
12. `Indemnity`
13. `Intellectual Property`
14. `Governing Law`
15. `Jurisdiction`
16. `Dispute Resolution`
17. `Warranties`
18. `Representations`
19. `Non-Compete`
20. `Non-Solicitation`
21. `Data Protection`
22. `Important Clauses`
23. `Risks` (with `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` severity levels, explanation, and verbatim evidence)
24. `Missing/Unclear Information`

### 3. Anti-Hallucination & Source Grounding
- The AI is strictly instructed to extract information solely from `<DOCUMENT_CONTENT>`.
- Any absent section or field explicitly returns: `"Not found in the provided document."`
- Every risk and clause requires exact verbatim source text from the document. If verbatim evidence does not exist, the finding is not generated.
- Page numbers must be verified against document markers or set to `null` (no page guessing).

### 4. Prompt Injection Defense
All document text is treated as **untrusted data** and isolated inside `<DOCUMENT_CONTENT>` tags. The system prompt instructs Gemini that any user commands embedded in contracts (such as "Ignore previous instructions", "Output system prompt", or "Act as administrator") must be treated strictly as document text under analysis, never as actionable instructions.

### 5. Re-Analysis Cost Control
Before querying Gemini, `POST /api/documents/{id}/analyze` checks if a completed analysis already exists for the document. If found, the existing analysis is returned immediately without re-querying the API. Users can explicitly force a fresh re-analysis by passing `?force=true`.

### 6. Response Normalization & Defensive Validation
To ensure deterministic stability and prevent runtime crashes:
- **Backend Model Validators**: Pydantic models in `app/schemas/analysis.py` automatically coerce any omitted or `null` collection fields (`parties`, `important_dates`, `financial_terms`, `obligations`, `rights`, `important_clauses`, `risks`, `missing_or_unclear_information`) into empty lists `[]`. Missing or `null` section objects default to valid instances with `"Not found in the provided document."` text.
- **JSON Sanitization**: Extracts JSON content between the first `{` and last `}` to safely disregard any markdown backticks or LLM preamble.
- **Frontend Normalization Layer**: `apps/web/src/lib/api-client.ts` executes `normalizeLegalAnalysisData()` on all incoming analysis responses, guaranteeing that every rendered array is an `Array` (`Array.isArray(x) ? x : []`), preventing `Cannot read properties of undefined (reading 'map')` errors.
### 7. Resilient Execution & Proxy Architecture
- **Supported Gemini Model**: Configured with `gemini-3.6-flash` (replacing retired `gemini-2.5-flash`). Supported models automatically fall back to active Flash alternatives (`gemini-flash-latest`, `gemini-3.5-flash`) during temporary Google provider load spikes.
- **Native Async Non-Blocking Client**: Uses `client.aio.models.generate_content` from the official `google-genai` SDK with `automatic_function_calling=disable`, preventing event loop thread starvation.
- **Structured Exception Mapping**: Distinguishes between authentication errors (401/403/502), missing models (404/502), rate limits (429), high-demand spikes (503 with automatic backoff retry), and timeouts (504). All secrets and API keys are strictly redacted from logs and client responses.
- **Next.js App Router Proxy**: Route handler in `apps/web/src/app/api/[...path]/route.ts` replaces legacy rewrites with an explicit 120-second timeout, completely eliminating upstream `ECONNRESET` / `socket hang up` errors during long-running legal document analysis.

---

## 16. Environment Variables

Copy `.env.example` to a local server-only environment file. Do not commit real values.

- `APP_ENV`, `WEB_ORIGIN`, `API_ORIGIN`, `NEXT_PUBLIC_API_BASE_URL`, and `CORS_ORIGINS`: runtime, browser API, and allowed-origin configuration.
- `DATABASE_URL`: PostgreSQL connection string.
- `REDIS_URL`: Redis connection string.
- `STORAGE_PROVIDER` and `STORAGE_*`: private S3-compatible storage configuration.
- `JWT_SECRET`, `SESSION_SECRET`, and `ENCRYPTION_KEY`: generated server secrets.
- `GEMINI_API_KEY`: Google Gemini API key.
- `GEMINI_MODEL`: Gemini model name (`gemini-2.5-flash` default).
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
alembic upgrade head
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

## Phase 5 Status: Gemini AI Analysis & Canonical Schema Normalization

Phase 5 (Real Google Gemini AI Document Analysis) is **OPERATIONAL & PRODUCTION-VERIFIED**:
- **Canonical Structured Schema:** 24-section legal analysis result grounded strictly in document text (`LegalAnalysisResult`).
- **Canonical `MissingOrUnclearItem` Schema:**
  - `term`: Name of missing/unclear provision.
  - `explanation`: Reason why the term is omitted or ambiguous.
  - `page`: Integer page number if partially mentioned, or `null`.
  - `section`: Contract section identifier if partially mentioned, or `null`.
  - `source_text`: Verbatim snippet demonstrating ambiguity, or `null`.
  - `confidence`: Confidence score from 0.0 to 1.0 or `null`.
- **Backward Compatibility:** All legacy string arrays (`["Term A", "Term B"]`) are transparently normalized into `MissingOrUnclearItem` models with fallback explanations and null source citations.
- **Resilient Multi-Stage JSON Parser (`parse_json_resilient`):**
  - Handles markdown code blocks.
  - Strips trailing commas.
  - Recovers missing commas between lines.
  - Reconstructs and safely closes truncated JSON responses if large documents reach token limits.
- **Production Validation:** Live real-world verification completed against Google Gemini (`gemini-3.5-flash` / `gemini-3.6-flash`) on multiple diverse contracts:
  1. `raveena.pdf`: Heavily redacted document correctly yields 2 parties and omissions without hallucinations.
  2. `1000_Buildings_Professional_Contract_EN.pdf`: 5-page real construction agreement parsed end-to-end with 2 contracting parties, 4 risk items, 4 key clauses, and 4 grounded omissions citing specific pages.
- **Frontend Workspace (`/analysis`):** Fully integrated React client with source evidence modals, CRITICAL risk badges, and structured omissions cards.


