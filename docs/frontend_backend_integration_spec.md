# TRADE SIFT — FRONTEND BACKEND INTEGRATION SPECIFICATION

## 1. Product Overview
TradeSift is an automation platform for off-dock terminal operators handling import/export gate-in/gate-out operations. It eliminates manual data entry by extracting information from physical terminal documents.

The primary workflow revolves around **Operations**. Documents are uploaded to an Operation, processed via AI to extract structured data, validated against business rules (and cross-referenced with other documents), reviewed by a human operator, approved, and finally mapped to the target ERP system or exported to Excel.

```text
Documents
→ AI Extraction
→ Validation
→ Structured Data
→ ERP/API/Excel
```

## 2. Product Workflow
The complete frontend flow is as follows:
```text
Create Operation
→ Add Documents (Device or Camera)
→ AI Processing (Detection, OCR, Extraction)
→ Validation (Business Rules, Cross-document checks)
→ Human Review (Confidence scores, issue resolution)
→ Approved Data (Final structured dataset)
→ Mapping (Source fields mapped to destination ERP fields)
→ Export (API payload or Excel)
```

## 3. Frontend Architecture
- **Framework:** React + Vite
- **Styling:** TailwindCSS
- **State Management:** React hooks + component-level state (No global Redux needed currently, API boundaries are abstracted in `src/services/`).
- **API Boundary:** All network calls are routed through `src/services/` (e.g., `documentService`, `processingService`). The UI components never call `fetch/axios` directly.
- **Mock Data:** Due to missing backend APIs, isolated mock constants still exist but have been bridged with placeholders inside the Service layer.

## 4. Operation Architecture
An Operation is the central parent container for the workflow. 
- **Creation:** A user creates an operation (`POST /operations`), returning an `operationId`.
- **Lifecycle:** All subsequent processing states, documents, reviews, and activity logs are strictly tied to this `operationId`.
- **Workspace:** The Operation Workspace acts as a command center containing Overview, Documents, Processing, Review, and Activity layers.

## 5. Document Architecture
**Strict Separation of Concerns:**
- **Operation Documents:** Documents belong to a specific operation. Operators add documents (up to 20 limit) directly inside the active Operation Workspace.
- **Global Documents History:** The `Documents` route in the navigation sidebar is strictly a *historical library*. It allows operators to search, filter, and inspect past documents across all operations. It does *not* support document creation/upload.

## 6. Processing Architecture
The frontend expects a pipeline of states during processing. The backend may handle this in a single worker or event queues, but the frontend needs to understand progress conceptually:
- Document Type Detection
- OCR
- Extraction
- Normalization
- Cross-Document Comparison
- Business Validation
- Human Review
- Approved

The `processingService.getProcessingStatus` expects an array of `stages` and their respective statuses (`Completed`, `Processing`, `Issue Detected`) to power the visual progress tracker.

## 7. Human Review Contract
When human review is required, the UI uses `reviewService.getExtractionData`.
**Expected Shape:**
- `fields`: Array of `{ name, value, confidence, status }`.
- `validationIssues`: Cross-document or business rules that failed, requiring human intervention.
The operator can correct fields and submit them via `reviewService.updateExtractionData`.

## 8. Approved Data
After the operator approves the review stage, the frontend transitions to the Approved Data step using `approvedDataService.getApprovedData(operationId)`.
This should return the fully normalized and structured operational payload. The frontend should *not* regenerate this payload.

## 9. Mapping
The `mappingService.getMappingData(operationId)` API represents the stage where TradeSift aligns extracted fields to the target operational terminal system. 

## 10. Export
The operator triggers `exportService.exportOperationData`. The backend handles constructing the Excel file or pushing the API payload, and returns a success status or a `downloadUrl`.

## 11. Activity Log
A chronological audit log of the operation retrieved via `activityService.getOperationActivity(operationId)`. The backend must emit events for uploads, processing status changes, reviews, and exports to be displayed in the UI timeline.

---

## 12. API CONTRACT TABLE

| Feature | Frontend Service | Required Endpoint | Request | Response | Status | Notes |
|---------|------------------|-------------------|---------|----------|--------|-------|
| Create Operation | `operationService.js` | `POST /operations` | `{ type, referenceNo, ... }` | `{ operation }` | **AVAILABLE** | |
| List Operations | `operationService.js` | `GET /operations` | - | `{ operations: [...] }` | **AVAILABLE** | |
| Fetch Operation | `operationService.js` | `GET /operations/:id` | - | `{ operation }` | **AVAILABLE** | |
| Upload Document | `documentService.js` | `POST /operations/:id/documents` | FormData (files) | `{ documents: [...] }` | **AVAILABLE** | |
| List Op Documents | `documentService.js` | `GET /operations/:id/documents` | - | `{ documents: [...] }` | **AVAILABLE** | |
| Delete Document | `documentService.js` | `DELETE /documents/:id` | - | - | **AVAILABLE** | |
| Global Docs History | `documentService.js` | `GET /documents` | `?search=&type=` | `{ documents: [...] }` | BACKEND TODO | Required for the global library view |
| Document File URL | `documentService.js` | N/A (Storage) | - | Secure Cloudinary URL | **AVAILABLE** | Storage via Cloudinary |
| Start Processing | `processingService.js` | `POST /operations/:id/process` | - | `{ success }` | **AVAILABLE** | Triggers BullMQ + AI |
| Processing Status | `processingService.js` | `GET /operations/:id/processing-status`| - | `{ status, stages: [] }` | **AVAILABLE** | Powers the pipeline tracker |
| Get Extraction | `reviewService.js` | `GET /operations/:id/extraction` | - | `{ data: [...] }` | **AVAILABLE** | Populates Human Review |
| Update Extraction | `reviewService.js` | `PATCH /extractions/:id` | `{ editedFields: {...} }` | `{ success }` | **AVAILABLE** | Saves operator corrections |
| Get Approved Data | `approvedDataService.js`| `GET /operations/:id/approved-data` | - | `{ referenceNo, ... }` | BACKEND TODO | The final operational payload |
| Approve Extraction| `approvedDataService.js`| `POST /extractions/:id/approve` | - | `{ success }` | **AVAILABLE** | Marks data as clean |
| Export Data | `exportService.js` | `POST /exports/:id/export` | `{ type: 'EXCEL' }` | Excel Buffer | **AVAILABLE** | Generate Excel export |
| Activity Timeline | `activityService.js` | `GET /operations/:id/activity` | - | `{ activities: [] }` | BACKEND TODO | Chronological event history |
| Dashboard Summary | `dashboardService.js` | `GET /dashboard/summary` | - | `{ stats, ... }` | **AVAILABLE** | High-level statistics |

---

## 13. Frontend → Backend Data Flow
```text
React Component (UI)
      ↓ (Calls)
Service Wrapper (e.g., reviewService.js)
      ↓ (Axios/Fetch)
API Endpoint (e.g., /documents/:id/extraction)
      ↓
Backend Logic (Prisma/Controller)
      ↓
AI / Database
      ↓
Response Payload
      ↓
Service Layer (Transforms to UI schema if necessary)
      ↓
UI Updates State
```

## 14. AI → Backend → Frontend Flow
The frontend does **NOT** want raw AI data. The flow must be:
```text
Document Image → AI Pipeline → Field Extraction → Validation Engine → Backend Controller → Normalized JSON Payload → Frontend
```
The frontend expects `Gross Weight: 12,450 KG`, not bounding box coordinates without context.

## 15. Integration Instructions
The frontend services are completely ready. Inside every service file (e.g., `src/services/reviewService.js`), you will find a placeholder:
```javascript
// =====================================================
// BACKEND INTEGRATION REQUIRED
// =====================================================
```
When you complete the API on the backend, simply replace the `// MOCK RESPONSE` block with a real `apiClient` call and adjust any frontend mapping if your JSON schema differs slightly from the mock expectations. You do not need to rewrite the React components.

## 16. Missing Backend APIs
- [ ] Global Documents Library (`GET /documents`)
- [ ] Get Approved Data Fetcher (`GET /operations/:id/approved-data`)
- [ ] Mapping Configuration API
- [ ] Activity Log Audit (`GET /operations/:id/activity`)

## 17. Existing Backend APIs (Integrated)
- [✓] Create Operation (`POST /operations`)
- [✓] Fetch Operation Details (`GET /operations/:id`)
- [✓] List All Operations (`GET /operations`)
- [✓] Upload Documents to Operation (`POST /operations/:id/documents`)
- [✓] List Operation Documents (`GET /operations/:id/documents`)
- [✓] Delete Document (`DELETE /documents/:id`)
- [✓] Document Cloud Storage / Previews (Cloudinary Integration)
- [✓] Pipeline Trigger (`POST /operations/:id/process`)
- [✓] Pipeline Status Tracker (`GET /operations/:id/processing-status`)
- [✓] Review Data Fetcher (`GET /operations/:id/extraction`)
- [✓] Review Data Saver (`PATCH /extractions/:id`)
- [✓] Approve Extraction (`POST /extractions/:id/approve`)
- [✓] Export Generator Excel (`POST /exports/:id/export`)
- [✓] Dashboard Summary (`GET /dashboard/summary`)

## 18. Backend Implementation Guidance
You are free to build the AI and processing engines however you see fit (Queues, Webhooks, Polling, CRONs). The frontend does not care *how* you process the documents. The frontend only cares that when it asks `GET /operations/:id/processing-status`, it receives a clear status, and when it asks for extraction data, it receives the normalized fields.

## 19. AI Engineering Dependencies
The frontend relies heavily on the AI layer providing:
- **Confidence Scores:** Needed for the visual trust indicators on the Review page.
- **Validation Comparisons:** Required to power the discrepancy alerts (e.g., "Invoice weight doesn't match Bill of Lading weight").

## 20. Integration Strategy (Recommended Order)
1. Complete Cloudinary/S3 integration so Document Previews actually render the images/PDFs.
2. Build the Activity Log API (easiest to start dropping audit events).
3. Connect the Processing/Pipeline trigger APIs.
4. Build the core Extraction and Review endpoints to power the human loop.
5. Finish with Approved Data and Exports.
