# TradeSift Backend Development Journal

---

## 1. System Architecture Overview

TradeSift is a document-to-ERP automation platform built for off-dock terminals. The backend acts as the orchestration and business logic layer. 

### Technology Stack
- **Runtime:** Node.js with TypeScript (ESM, `nodenext` module resolution)
- **Framework:** Express 5
- **Database:** MongoDB via Prisma ORM
- **Cache / Queue:** Redis (ioredis)
- **Validation:** Zod v4
- **Logging:** Pino with pino-pretty (dev environment)
- **Authentication:** JWT (access + refresh tokens via HTTP-only cookies) + OTP / Google OAuth

---

## 2. Database Schema (MongoDB via Prisma)

The database consists of the following core collections:

1. **User**: Core identity. Stores email, hashed password, name, and organization details.
2. **Session**: Tracks active refresh tokens to manage multi-device logins and remote logout.
3. **TrustedDevice**: Tracks recognized devices using hashed device IDs to bypass restrictive security flows.
4. **CoolDownEmail**: Manages rate-limiting and cooldown periods for OTPs (Register, Login, Forgot Password).
5. **Operation**: *(Phase 1)* Represents a Gate-In or Gate-Out workflow belonging to a user. Supports statuses (`DRAFT`, `PROCESSING`, `REVIEW`, `COMPLETED`, `CANCELLED`).

---

## 3. Core Modules (Foundation)

Before feature development began, a robust foundation was established across four core security and identity modules:

### A. Auth Module (`src/modules/auth`)
Handles all authentication flows:
- **Registration & Login**: Uses an OTP-based flow or Password-based flow.
- **Google OAuth**: Integrated login via Google.
- **Token Management**: Issues HTTP-only `access_token` and `refresh_token` cookies.
- **Security**: Integrates with Trusted Devices to prevent unauthorized logins from new devices.

### B. Users Module (`src/modules/users`)
Handles user profile management.
- Enforces strict isolation: users can only fetch or update their own profiles.

### C. Sessions Module (`src/modules/sessions`)
- Every login creates a `Session` in MongoDB containing a hash of the refresh token.
- Allows users to view active sessions across devices and revoke them remotely.

### D. Trusted Devices Module (`src/modules/trusted-devices`)
- Devices are fingerprinted on the frontend and tracked here.
- Unrecognized devices require additional OTP verification before a session is granted.

---

## 4. Architecture Pattern & Conventions

Every module follows a strict 5-layer pattern:

```
Routes → Controller → Service → Repository → Prisma
```

- **Routes:** Define HTTP endpoints and apply middleware (`requireAuth`, `validate`, `validateQuery`, `validateParams`).
- **Controllers:** Thin handlers. Extract data from `req`, call the Service layer, and return standard `ApiResponse` objects. Errors are passed to `next(err)`.
- **Services:** Contains **ALL** business logic, status transitions, and data ownership checks (`userId` validation).
- **Repositories:** Pure Prisma data-access functions. No business logic.
- **Validation (Zod):** Request bodies, queries, and params are strictly validated using Zod v4 schemas. 

### Express 5 Gotchas
- **Getter Overrides:** In Express 5, `req.query` and `req.params` are read-only getters. To override them with sanitized Zod output in middlewares, we use `Object.defineProperty`:
  ```typescript
  Object.defineProperty(req, 'params', { value: result.data, writable: true, enumerable: true, configurable: true });
  ```
- **Zod v4 Error Messages:** Zod v4 uses the `message` property for custom errors (replacing v3's `required_error` and `invalid_type_error`).

---

## 5. Phase Log

### Phase 1 — Operations Module
**Completed:** July 2026

**Summary:** 
Implemented the Operations module — the primary business entity in TradeSift. Full CRUD with strict user-scoped data isolation.

**Key Endpoints:**
- `POST /api/operations` — Create operation (`GATE_IN` or `GATE_OUT`).
- `GET /api/operations` — List operations (paginated, filterable).
- `GET /api/operations/:id` — Get single operation.
- `PATCH /api/operations/:id` — Update operation or cancel (`status: CANCELLED`).
- `DELETE /api/operations/:id` — Hard delete operation.

**Important Decisions & Fixes:**
1. **Ownership returns 404:** When a user tries to access another user's operation, the API returns `404 Not Found` rather than `403 Forbidden` to prevent information leakage.
2. **MongoDB ObjectID Validation:** A `validateParams()` middleware was added to enforce strict 24-character hex regex validation on `:id` routes. This prevents Prisma from throwing `500 P2023` errors when malformed IDs are provided.
3. **Enum Forward-Planning:** The `OperationStatus` Prisma enum includes `PROCESSING`, `REVIEW`, and `COMPLETED` for future phases, even though Phase 1 only uses `DRAFT` and `CANCELLED`.
### Phase 2 — Document Management
**Completed:** July 2026

**Summary:** 
Implemented the Document Management module for uploading and listing operational documents. Multer memory storage is used along with a temporary `temp_<uuid>` storageKey to prepare for Phase 3 external storage.

**Files Added:**
- `src/middleware/upload.middleware.ts`
- `src/modules/documents/*` (constants, types, schema, repository, service, controller, routes)

**Files Modified:**
- `prisma/schema.prisma` (Added `Document` and `DocumentUploadStatus`)
- `src/modules/operations/operation.routes.ts` (Added nested document routes)
- `src/routes/index.ts` (Mounted `/documents`)

**Database Changes:**
- **`Document`** model added with relation to `Operation`.
- **`DocumentUploadStatus`** enum added (`UPLOADING`, `UPLOADED`, `FAILED`).

**Routes Added:**
- `POST /api/operations/:id/documents` — Upload a document to an operation (multipart/form-data).
- `GET /api/operations/:id/documents` — List documents for an operation.
- `GET /api/documents/:id` — Get document metadata.
- `DELETE /api/documents/:id` — Delete document metadata.

**Design Decisions:**
1. **Placeholder Storage:** Documents are not yet uploaded to external storage. Multer uses memory storage, and the backend generates a `temp_<uuid>` placeholder for the `storageKey`. This decouples the business logic from Cloudinary (which will be added in Phase 3).
2. **File Validation:** Configurable max size of 10MB and strict MIME type checking (PDF, Word, Excel, and various Image formats like JPG, PNG, TIFF) is enforced via Multer.
3. **Route Nesting vs Root:** The upload and list operations are nested under `operation.routes.ts` (`/:id/documents`) because they conceptually map an action on an Operation, while fetch/delete actions are mapped directly to `/documents/:id` in `document.routes.ts`.

#### Phase 2 Refactor — Multiple Document Uploads
- Refactored the `POST /api/operations/:id/documents` endpoint to accept an array of files (`files`).
- Replaced `upload.single('file')` with `upload.array('files', 20)`.
- Introduced a Prisma transaction (`$transaction`) in the Repository layer to ensure atomic creation of all documents in the batch.
- The endpoint now returns an array of safely created document metadata instead of a single object.

**Recommendations (Future):**
- Add soft deletes and scheduled deletion cron tasks for orphaned documents or expired operations.

### Phase 3 — Storage Layer
**Completed:** July 2026

**Summary:** 
Implemented a reusable Storage Layer to handle document uploads, removing the temporary memory placeholder from Phase 2. Cloudinary is integrated as the first storage provider, but the architecture abstracts it away so the Document module remains provider-independent.

**Files Added:**
- `src/integrations/storage/storage.types.ts`
- `src/integrations/storage/cloudinary.provider.ts`
- `src/integrations/storage/storage.service.ts`

**Files Modified:**
- `prisma/schema.prisma` (Added `StorageProvider` enum and `storageProvider` field to `Document`)
- `src/config/env.ts` (Added Cloudinary credentials)
- `src/modules/documents/document.repository.ts` (Updated inserts to include `storageProvider`)
- `src/modules/documents/document.service.ts` (Updated `uploadDocuments` and `deleteExistingDocument` to use `StorageService`)

**Database Changes:**
- **`StorageProvider`** enum added (currently only `CLOUDINARY`).
- **`storageProvider`** field added to `Document` (defaults to `CLOUDINARY`).

**Design Decisions:**
1. **Provider Independence:** The Document module only communicates with `StorageService`, which implements the `IStorageProvider` contract. Cloudinary specific implementation is completely encapsulated in `cloudinary.provider.ts`.
2. **Metadata Storage:** Instead of storing delivery URLs, we store the provider-specific `storageKey` (e.g., Cloudinary `public_id`). Delivery URLs are generated dynamically via `StorageService.getDocumentUrl()` and exposed in the API response as `url`, avoiding provider lock-in and handling deleted/migrated assets gracefully.
3. **Graceful Deletion:** Deleting a document first removes it from the storage provider, and only upon success deletes the database record, avoiding orphaned files.

**Recommendations (Future):**
- Add soft deletes and scheduled deletion cron tasks for orphaned documents or expired operations.

### Phase 4 — Processing Pipeline
**Completed:** August 2026

**Summary:** 
Implemented the asynchronous Processing Pipeline infrastructure using BullMQ. This phase establishes the job queues, workers, and database structures required for upcoming AI processing, using a mock worker.

**Files Added:**
- `src/modules/processing/processing.types.ts`
- `src/modules/processing/processing.constants.ts`
- `src/modules/processing/processing.repository.ts`
- `src/modules/processing/processing.queue.ts`
- `src/modules/processing/processing.worker.ts`
- `src/modules/processing/processing.service.ts`
- `src/modules/processing/processing.controller.ts`

**Files Modified:**
- `prisma/schema.prisma` (Added `ProcessingJob` model, stage fields, and `ProcessingStatus` enum)
- `src/modules/operations/operation.constants.ts` (Added workflow transitions for PROCESSING and REVIEW)
- `src/modules/operations/operation.routes.ts` (Added unified nested processing endpoint)
- `src/routes/index.ts` (Cleaned up processing routes)
- `src/server.ts` (Integrated BullMQ worker initialization and teardown)

**Queue Architecture & Lifecycle:**
1. User uploads documents and requests processing via API.
2. Service verifies ownership and checks that no other active jobs (`PENDING`, `QUEUED`, `PROCESSING`) exist for the operation.
3. Service creates a `PENDING` job in MongoDB and pushes a BullMQ job to the generic `operation-processing` queue via `ioredis`. Operation status transitions from `DRAFT` to `PROCESSING`.
4. The background worker picks up the job and requests status/stage updates via the central Service layer. The service updates database status to `PROCESSING` and emits mock progress/stage updates.
5. Worker completes, triggering the Service layer to set job status to `COMPLETED` and transition Operation status to `REVIEW`.

**Design Decisions:**
1. **Separation of Concerns:** The processing queue logic and worker logic are isolated in the `processing` module. Business rules (like duplicate prevention) are enforced synchronously before the job is queued.
2. **Worker Independence:** The worker only orchestrates status transitions and does not contain business logic. It delegates state changes entirely to `processing.service.ts`, which safely manages cross-module side effects (like updating `Operation` status).
3. **Database-first State:** We mirror the queue job state into a `ProcessingJob` MongoDB collection with dedicated fields for processing stages (`currentStage`, `stages` JSON). This ensures our API can seamlessly expose deep UI tracking without directly interrogating BullMQ.

---

## Phase 5: AI Backend Integration

**Status:** Completed
**Completed:** August 2026

**Summary:** 
Integrated the processing pipeline with the independent AI Backend microservice. This layer coordinates document extraction, exposes a deterministic mock fallback for development environments, and isolates extracted data persistence into its own domain.

**Files Added:**
- `src/integrations/ai/ai.client.ts` (Handles `fetch` requests and timeouts)
- `src/integrations/ai/ai.types.ts`, `ai.constants.ts`, `ai.errors.ts`
- `src/modules/extractions/extraction.repository.ts`, `extraction.service.ts`, `extraction.controller.ts`, `extraction.types.ts`, `extraction.constants.ts`

**Files Modified:**
- `prisma/schema.prisma` (Added `Extraction` model)
- `src/config/env.ts` (Added `AI_BACKEND_URL` and `AI_BACKEND_TIMEOUT`)
- `src/modules/operations/operation.routes.ts` (Mounted extraction endpoints)
- `src/modules/processing/processing.service.ts` (Replaced mock tracking with full AI orchestration via `executeProcessingJob`)
- `src/modules/processing/processing.worker.ts` (Simplified to invoke the centralized service logic)

**Architecture & Lifecycle:**
1. Background worker calls `executeProcessingJob(userId, jobId)` inside `processing.service.ts`.
2. Service transitions job to `PROCESSING` and fetches all document records.
3. Service calls `AIClient.extractDocuments(documents)`.
4. The `AIClient` prepares a `FormData` payload containing the downloaded documents and sends it to the AI backend. It throws an error (`AIBackendError`) if the backend is unavailable or fails, propagating the failure up.
5. The extracted data is passed to `ExtractionService.saveExtractions`, which persists it into the `Extraction` collection.
6. Processing service marks the job `COMPLETED` and transitions the parent Operation to `REVIEW`.

---

## Phase 6: Extraction Review & Approval Workflow

**Status:** Completed
**Completed:** August 2026

**Summary:** 
Introduced the Extraction Review module, which acts as the human-in-the-loop bridge between AI processing and ERP export. Extracted data can now be reviewed, edited, approved, or rejected with strict architectural boundaries preserving the original AI data.

**Files Added:**
- `src/modules/extractions/extraction.schema.ts` (Zod validation for edits and rejections)
- `src/modules/extractions/extraction.routes.ts` (New top-level `/extractions` endpoints)

**Files Modified:**
- `prisma/schema.prisma` (Added `ExtractionStatus` enum, `originalFields`, `editedFields`, `reviewerNotes`, `approvedBy`, `approvedAt`, `reviewedAt`, `version` to `Extraction`)
- `src/modules/extractions/extraction.types.ts` (Updated `SafeExtraction` interface)
- `src/modules/extractions/extraction.repository.ts` (Mapped initial AI output to `originalFields`, added unique ID fetch/update)
- `src/modules/extractions/extraction.service.ts` (Added ownership verification and state machine logic)
- `src/modules/extractions/extraction.controller.ts` (Added handlers for patch, approve, reject)
- `src/modules/operations/operation.routes.ts` (Aliased `GET /:id/extractions` to `/:id/extraction`)
- `src/routes/index.ts` (Mounted extraction routes)

**Architecture & Lifecycle:**
1. **Data Preservation:** The pristine AI output is saved directly to `originalFields` and is never overwritten. User modifications are isolated to `editedFields` (or merged dynamically).
2. **State Machine (`ExtractionStatus`):**
   - `READY_FOR_REVIEW`: Default state after AI completion.
   - `IN_REVIEW`: Triggered automatically upon the first `PATCH` edit.
   - `APPROVED`: Explicit approval via `POST /approve`. Once approved, the record becomes immutable (blocks further edits or rejections).
   - `REJECTED`: Terminal state via `POST /reject` (requires optional/mandatory reviewer notes).
3. **Security:** Every extraction endpoint enforces ownership by performing a deep lookup (`Extraction` -> `Operation` -> `userId`). If unauthorized, it returns `404 Not Found` per ADR standards to obscure data existence.

---

## Phase 7: Excel Export Module

**Status:** Completed
**Completed:** August 2026

**Summary:**
Implemented the Excel Export module allowing users to manually download `APPROVED` extraction data as `.xlsx` workbooks. This is the first export target for TradeSift before full ERP integration.

**Files Added:**
- `src/integrations/excel/*` (Builder, Constants, Service, Types mapping the `exceljs` library)
- `src/modules/exports/*` (Business logic, schema, repository, controller, routes)

**Files Modified:**
- `prisma/schema.prisma` (Added `lastExportedAt` and `exportCount` to `Extraction`)
- `src/routes/index.ts` (Mounted the export routes onto `/api/extractions`)

**Architecture & Lifecycle:**
1. **Decoupled Excel Generation:** The `exceljs` library is strictly contained within `src/integrations/excel`. The business module formats the data and simply requests a `Buffer`.
2. **Flattening Nested Data:** The Excel builder recursively flattens deeply nested JSON structures from the AI extraction into simple dot-notation properties (e.g., `invoice.number`) to fit cleanly in a 2D tabular Excel format.
3. **Immutability Rules:**
   - Only `APPROVED` extractions can be exported (`409 Conflict` otherwise).
   - Uses `editedFields` dynamically, falling back to `originalFields` if no human edits were made.
4. **Delivery:** The `exports` module controllers send raw Buffer responses with appropriate content disposition headers, entirely in-memory, skipping Cloudinary uploads.

---

## Phase 8: Dashboard Module (Post-Phase-7)

**Status:** Completed
**Completed:** August 2026

**Summary:**
Introduced the Dashboard module to provide a high-level operational summary for users on the frontend. It aggregates statistics across Operations, ProcessingJobs, and Documents.

**Files Added:**
- `src/modules/dashboard/*` (controller, service, routes)

**Files Modified:**
- `src/routes/index.ts` (Mounted the dashboard routes onto `/api/dashboard`)

**Architecture & Lifecycle:**
1. **Aggregated Stats:** Calculates total operations, pending reviews, completed exports, and a processing success rate percentage.
2. **Recent Activity:** Retrieves the 5 most recent documents with context about their parent operation type.
3. **Alerts Generation:** Dynamically generates alerts for operations needing review, failed processing jobs, and failed document uploads to prompt user action.

---

## 9. Future Phases & Next Steps

- **Audit Logging:** Every operation mutation (create, update, delete) will eventually emit an audit event.
- **Soft Deletes:** Implement an ADR-compliant deletion policy (adding `deletedAt` and background cron cleanup).
