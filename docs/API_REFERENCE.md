# TradeSift Backend API Reference

## Base URL

All authentication endpoints are mounted under `/api/auth`.

Most endpoints use `POST`; Google OAuth uses `GET`.

The backend uses JSON request bodies and returns JSON responses, except the Google callback route which redirects the browser.

---

## Global response structure

Successful responses:

```json
{
  "success": true,
  "message": "...",
  "data": { ... }
}
```

Error responses:

```json
{
  "success": false,
  "message": "..."
}
```

---

## Authentication endpoints

### 1. Register user

- Endpoint: `POST /api/auth/register`
- Auth: no
- Purpose: start user registration and send OTP to email.

Request body:

```json
{
  "firstName": "string",
  "lastName": "string",
  "organisation": "string", // optional
  "email": "string",
  "password": "string",
  "passwordConfirmation": "string",
  "agreedToTerms": true
}
```

Response:

```json
{
  "success": true,
  "message": "OTP sent to your email.",
  "data": {
    "email": "user@example.com"
  }
}
```

Notes:
- Password must be at least 8 characters and include an uppercase letter, a number, and a special character.
- `passwordConfirmation` must match `password`.
- `agreedToTerms` must be `true`.
- The registration OTP expires in 5 minutes.

---

### 2. Resend registration OTP

- Endpoint: `POST /api/auth/register/resend-otp`
- Auth: no
- Purpose: resend the registration OTP if the previous code expired or was not received.

Request body:

```json
{
  "email": "string"
}
```

Response:

```json
{
  "success": true,
  "message": "OTP resent to your email.",
  "data": {
    "email": "user@example.com"
  }
}
```

Notes:
- OTP resend requests are rate limited. Clients should wait at least 30 seconds between resend attempts.

---

### 3. Verify registration OTP

- Endpoint: `POST /api/auth/register/verify-otp`
- Auth: no
- Purpose: verify registration OTP and create the user account.

Request body:

```json
{
  "email": "string",
  "otp": "string"
}
```

Response:

```json
{
  "success": true,
  "message": "Registration complete.",
  "data": {
    "id": "string",
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "organisation": "string | null",
    "createdAt": "string"
  }
}
```

Notes:
- Registration is finalized only after OTP verification.
- Incorrect OTP attempts are limited.

---

### 4. Login

- Endpoint: `POST /api/auth/login`
- Auth: no
- Purpose: authenticate user credentials and either log in immediately for a trusted device or begin OTP verification.

Request body:

```json
{
  "email": "string",
  "password": "string",
  "rememberDevice": false
}
```

Response cases:

1) Trusted device login success:

```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "user": {
      "id": "string",
      "email": "string"
    }
  }
}
```

Cookies set:
- `access_token`
- `refresh_token`

2) OTP required:

```json
{
  "success": true,
  "message": "OTP sent to your email.",
  "data": {
    "email": "string"
  }
}
```

Notes:
- If a valid `trusted_device_id` cookie exists, login may complete immediately without OTP.
- If `rememberDevice` is `true`, the backend may later set a trusted device cookie during OTP verification.
- The login flow may require a second `login/verify-otp` step.
- The direct trusted-device login user object may include additional profile fields when available.

---

### 5. Resend login OTP

- Endpoint: `POST /api/auth/login/resend-otp`
- Auth: no
- Purpose: resend OTP for a login attempt that requires verification.

Request body:

```json
{
  "email": "string"
}
```

Response:

```json
{
  "success": true,
  "message": "OTP resent to your email.",
  "data": {
    "email": "string"
  }
}
```

Notes:
- OTP resend requests are rate limited. Clients should wait at least 30 seconds between resend attempts.

---

### 6. Verify login OTP

- Endpoint: `POST /api/auth/login/verify-otp`
- Auth: no
- Purpose: complete login with OTP and set auth cookies.

Request body:

```json
{
  "email": "string",
  "otp": "string"
}
```

Response:

```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "user": {
      "id": "string",
      "email": "string"
    }
  }
}
```

Cookies set:
- `access_token`
- `refresh_token`
- `trusted_device_id` (only when the login session requested device remember)

Notes:
- The cookie `trusted_device_id` is only created when `rememberDevice` was true during the initial `login` request.
- Incorrect OTP attempts are limited and can expire the pending login session.

---

### 7. Google OAuth redirect

- Endpoint: `GET /api/auth/google`
- Auth: no
- Purpose: redirect the browser to Google OAuth consent.

Response:
- Redirects the user to Google’s OAuth consent screen.

---

### 8. Google OAuth callback

- Endpoint: `GET /api/auth/google/callback`
- Auth: no
- Purpose: complete Google sign-in and create or sign in a user.

Behavior:
- On success, the backend sets `access_token` and `refresh_token` cookies and redirects the browser to the frontend dashboard.
- On error, the backend redirects to the frontend login page with an error query parameter.

Notes:
- Google sign-in bypasses the OTP/trusted-device flow.
- This endpoint does not return JSON in the current implementation; it uses redirects.

---

### 9. Logout

- Endpoint: `POST /api/auth/logout`
- Auth: no
- Purpose: clear auth session and cookies.

Request body: none

Response:

```json
{
  "success": true,
  "message": "Logged out successfully.",
  "data": null
}
```

Notes:
- The backend reads the `refresh_token` cookie if present to revoke the session.
- It always clears auth cookies after logout.

---

### 10. Refresh token

- Endpoint: `POST /api/auth/refresh`
- Auth: no
- Purpose: renew the user's access session using the refresh token cookie.

Request body: none

Response:

```json
{
  "success": true,
  "message": "Token refreshed.",
  "data": null
}
```

Cookies set:
- `access_token`
- `refresh_token`

Notes:
- This endpoint requires the `refresh_token` cookie.
- It issues a new `access_token` and a new `refresh_token`.
- If the refresh token is invalid or expired, the session is revoked and the client must log in again.

---

### 11. Change password

- Endpoint: `POST /api/auth/change-password`
- Auth: yes
- Purpose: change a logged-in user's password.

Request body:

```json
{
  "currentPassword": "string", // optional if the account has no existing password
  "newPassword": "string",
  "newPasswordConfirmation": "string"
}
```

Response:

```json
{
  "success": true,
  "message": "Password changed successfully. Please log in again.",
  "data": null
}
```

Notes:
- This endpoint requires a valid `access_token` cookie.
- If the user has an existing password, `currentPassword` is required.
- After a successful password change, all sessions and trusted devices are revoked and auth cookies are cleared.

---

### 12. Forgot password request

- Endpoint: `POST /api/auth/forgot-password`
- Auth: no
- Purpose: start password reset by sending a reset OTP to email.

Request body:

```json
{
  "email": "string"
}
```

Response:

```json
{
  "success": true,
  "message": "If an account exists, a code has been sent.",
  "data": null
}
```

Notes:
- The response is intentionally generic and does not reveal whether the email exists.

---

### 13. Resend forgot-password OTP

- Endpoint: `POST /api/auth/forgot-password/resend-otp`
- Auth: no
- Purpose: resend the password reset OTP.

Request body:

```json
{
  "email": "string"
}
```

Response:

```json
{
  "success": true,
  "message": "If an account exists, a new code has been sent.",
  "data": null
}
```

Notes:
- The response remains generic even if the email is not associated with an account.
- OTP resend is rate limited and may reject too-frequent requests.

---

### 14. Verify forgot-password OTP

- Endpoint: `POST /api/auth/forgot-password/verify-otp`
- Auth: no
- Purpose: verify the reset OTP before allowing password reset.

Request body:

```json
{
  "email": "string",
  "otp": "string"
}
```

Response:

```json
{
  "success": true,
  "message": "OTP verified. You may now set a new password.",
  "data": null
}
```

Notes:
- OTP verification enables the next step and preserves the pending password reset session for a short time.

---

### 15. Reset password

- Endpoint: `POST /api/auth/forgot-password/reset-password`
- Auth: no
- Purpose: finalize password reset with a new password.

Request body:

```json
{
  "email": "string",
  "newPassword": "string",
  "newPasswordConfirmation": "string"
}
```

Response:

```json
{
  "success": true,
  "message": "Password reset successfully. Please log in.",
  "data": null
}
```

Notes:
- This endpoint requires a previously verified forgot-password OTP session.
- After reset, all sessions and trusted devices for the account are revoked.

---

## User endpoints

### 1. Get current profile

- Endpoint: `GET /api/users/me`
- Auth: yes
- Purpose: fetch the authenticated user's profile.

Response:

```json
{
  "success": true,
  "message": "Profile fetched.",
  "data": {
    "id": "string",
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "organisation": "string | null"
  }
}
```

Notes:
- Requires a valid `access_token` cookie.
- Returns a sanitized user object without the password.

---

### 2. Update current profile

- Endpoint: `PATCH /api/users/me`
- Auth: yes
- Purpose: update the authenticated user's allowed profile fields.

Request body:

```json
{
  "firstName": "string", // optional
  "lastName": "string", // optional
  "organisation": "string" // optional
}
```

Response:

```json
{
  "success": true,
  "message": "Profile updated.",
  "data": {
    "id": "string",
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "organisation": "string | null"
  }
}
```

Notes:
- Requires a valid `access_token` cookie.
- Only the provided fields are updated.

---

### 3. Delete current account

- Endpoint: `DELETE /api/users/me`
- Auth: yes
- Purpose: delete the authenticated user's account and clear auth cookies.

Request body: none

Response:

```json
{
  "success": true,
  "message": "Account deleted.",
  "data": null
}
```

Notes:
- Requires a valid `access_token` cookie.
- Deletes the user account and associated sessions/trusted devices.
- Clears `access_token`, `refresh_token`, and `trusted_device_id` cookies.

---

### 4. Get all users (development only)

- Endpoint: `GET /api/users/`
- Auth: no
- Purpose: retrieve all user accounts for testing.

Response:

```json
{
  "success": true,
  "message": "All users fetched.",
  "data": [
    {
      "id": "string",
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "organisation": "string | null"
    }
  ]
}
```

Notes:
- Available only when `NODE_ENV !== 'production'`.
- This route is intended for development/testing only.

---

### 5. Delete all users (development only)

- Endpoint: `DELETE /api/users/`
- Auth: no
- Purpose: delete all user accounts and related test data.

Response:

```json
{
  "success": true,
  "message": "All users deleted.",
  "data": null
}
```

Notes:
- Available only when `NODE_ENV !== 'production'`.
- Deletes all users, sessions, trusted devices, and cooldown records.

---

## Cookies used by frontend

- `access_token` – HTTP-only auth access token
- `refresh_token` – HTTP-only refresh token
- `trusted_device_id` – HTTP-only trusted device identifier

Notes:
- `access_token` is required for `POST /api/auth/change-password`.
- `refresh_token` is required for `POST /api/auth/refresh` and is used by `POST /api/auth/logout` when present.
- `trusted_device_id` is used to skip OTP when the device is trusted.
- Set `credentials: 'include'` on frontend requests to include cookies.
- All auth cookies are HTTP-only and not readable by client-side JavaScript.
- Cookies are set with `SameSite=Lax` and `Secure` in production.

---

## Frontend request guidance

- Use `Content-Type: application/json`.
- Use `credentials: 'include'` for requests that depend on cookies.
- Required cookie-based requests include `login` when a trusted device login succeeds, `login/verify-otp`, `refresh`, `logout`, and `change-password`.
- Validate frontend forms to match backend input requirements:
  - email must be valid
  - password rules require uppercase, number, and special character
  - OTP must be numeric and fixed length

---

## Notes for frontend developers

- The registration flow is two-step: `register` -> `register/verify-otp`.
- The login flow may be either direct or OTP-based depending on trusted device state.
- If login does not complete immediately, the backend sends OTP and the user must call `login/verify-otp`.
- After successful `login/verify-otp`, the backend sets `access_token` and `refresh_token` cookies, and may also set `trusted_device_id` when device trust is granted.
- The `refresh` endpoint uses the `refresh_token` cookie to issue new `access_token` and `refresh_token` cookies.
- The `change-password` route requires authentication and clears `access_token`, `refresh_token`, and `trusted_device_id` cookies.
- After successful password change, the frontend should redirect the user to the login page.
- Google OAuth uses redirect-based completion; the callback does not return a JSON payload in the current code.

---

## Operation endpoints

All operation endpoints are mounted under `/api/operations`.

All operation endpoints require authentication (`access_token` cookie).

Operations are scoped to the authenticated user. Users can only access their own operations.

---

### 1. Create operation

- Endpoint: `POST /api/operations`
- Auth: yes
- Purpose: create a new operation (Gate-In or Gate-Out).

Request body:

```json
{
  "operationType": "GATE_IN",
  "referenceNo": "string",
  "notes": "string"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| operationType | string | yes | Must be `GATE_IN` or `GATE_OUT` |
| referenceNo | string | no | Optional terminal reference number |
| notes | string | no | Optional free-text notes |

Response (201):

```json
{
  "success": true,
  "message": "Operation created.",
  "data": {
    "id": "string",
    "userId": "string",
    "operationType": "GATE_IN",
    "status": "DRAFT",
    "referenceNo": "string | null",
    "notes": "string | null",
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

Notes:
- Operations are always created with status `DRAFT`.
- The `operationType` field cannot be changed after creation.

---

### 2. List operations

- Endpoint: `GET /api/operations`
- Auth: yes
- Purpose: retrieve a paginated list of the authenticated user's operations.

Query parameters:

| Name | Type | Default | Description |
|------|------|---------|-------------|
| page | number | 1 | Page number (1-based) |
| limit | number | 10 | Items per page (max 50) |
| operationType | string | — | Filter by `GATE_IN` or `GATE_OUT` |
| status | string | — | Filter by `DRAFT`, `PROCESSING`, `REVIEW`, `COMPLETED`, or `CANCELLED` |

Response (200):

```json
{
  "success": true,
  "message": "Operations fetched.",
  "data": {
    "operations": [
      {
        "id": "string",
        "userId": "string",
        "operationType": "GATE_IN",
        "status": "DRAFT",
        "referenceNo": "string | null",
        "notes": "string | null",
        "createdAt": "string",
        "updatedAt": "string"
      }
    ],
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3
  }
}
```

Notes:
- Results are ordered by `createdAt` descending (newest first).
- Only the authenticated user's operations are returned.

---

### 3. Get operation

- Endpoint: `GET /api/operations/:id`
- Auth: yes
- Purpose: retrieve a single operation by ID.

Path parameters:

| Name | Type | Description |
|------|------|-------------|
| id | string | Operation ID |

Response (200):

```json
{
  "success": true,
  "message": "Operation fetched.",
  "data": {
    "id": "string",
    "userId": "string",
    "operationType": "GATE_IN",
    "status": "DRAFT",
    "referenceNo": "string | null",
    "notes": "string | null",
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

Error responses:

| Status | Reason |
|--------|--------|
| 400 | Invalid Operation ID format (must be 24-char hex) |
| 401 | Authentication required |
| 404 | Operation not found or does not belong to the authenticated user |

Notes:
- Returns `404` for both non-existent and non-owned operations to prevent information leakage.

---

### 4. Update operation

- Endpoint: `PATCH /api/operations/:id`
- Auth: yes
- Purpose: update operation metadata or cancel the operation.

Path parameters:

| Name | Type | Description |
|------|------|-------------|
| id | string | Operation ID |

Request body:

```json
{
  "referenceNo": "string",
  "notes": "string",
  "status": "CANCELLED"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| referenceNo | string | no | Updated reference number |
| notes | string | no | Updated notes |
| status | string | no | Can only be set to `CANCELLED` (Phase 1) |

Response (200):

```json
{
  "success": true,
  "message": "Operation updated.",
  "data": {
    "id": "string",
    "userId": "string",
    "operationType": "GATE_IN",
    "status": "CANCELLED",
    "referenceNo": "string | null",
    "notes": "string | null",
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

Error responses:

| Status | Reason |
|--------|--------|
| 400 | Invalid status transition or Invalid Operation ID format |
| 401 | Authentication required |
| 404 | Operation not found or does not belong to the authenticated user |

Validation rules:
- `status` can only be set to `CANCELLED`.
- Status transitions are validated: only `DRAFT` → `CANCELLED` is allowed in Phase 1.
- `referenceNo` must be non-empty if provided.

---

### 5. Delete operation

- Endpoint: `DELETE /api/operations/:id`
- Auth: yes
- Purpose: permanently delete an operation.

Path parameters:

| Name | Type | Description |
|------|------|-------------|
| id | string | Operation ID |

Request body: none

Response (200):

```json
{
  "success": true,
  "message": "Operation deleted.",
  "data": null
}
```

Error responses:

| Status | Reason |
|--------|--------|
| 400 | Invalid Operation ID format (must be 24-char hex) |
| 401 | Authentication required |
| 404 | Operation not found or does not belong to the authenticated user |

Notes:
- This performs a hard delete. The operation and its data are permanently removed.
- Future phases may introduce soft delete with scheduled cleanup.

---

## Notes for frontend developers (operations)

- All operation endpoints require the `access_token` cookie. Use `credentials: 'include'` on requests.
- Operations are user-scoped. The backend automatically filters by the authenticated user — no `userId` parameter is needed in requests.
- The `operationType` is set at creation and cannot be changed.
- To cancel an operation, use `PATCH /api/operations/:id` with `{ "status": "CANCELLED" }`.
- Pagination defaults to page 1 with 10 items per page. Maximum page size is 50.
- The list endpoint supports filtering by `operationType` and `status` via query parameters.

---

## Document endpoints

Document endpoints require authentication (`access_token` cookie).
Documents are scoped to operations. Users can only access documents for operations they own.

---

### 1. Upload documents

- Endpoint: `POST /api/operations/:id/documents`
- Auth: yes
- Purpose: Upload one or more documents to a specific operation.

Path parameters:

| Name | Type | Description |
|------|------|-------------|
| id | string | Operation ID |

Request format: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| files | file | yes | The files to upload (Max 20 files, Max 10MB per file). Allowed types: PDF, Word (.doc, .docx), Excel (.xls, .xlsx), and Images (JPG, JPEG, PNG, GIF, WEBP, BMP, TIFF, SVG, HEIC, HEIF). |

Response (201):

```json
{
  "success": true,
  "message": "Documents uploaded successfully.",
  "data": [
    {
      "id": "string",
      "operationId": "string",
      "originalFileName": "string",
      "mimeType": "string",
      "fileSize": 12345,
      "url": "string",
      "uploadStatus": "UPLOADED",
      "createdAt": "string",
      "updatedAt": "string"
    }
  ]
}
```

Error responses:

| Status | Reason |
|--------|--------|
| 400 | Invalid Operation ID format, No files uploaded, File too large, or Invalid file type |
| 401 | Authentication required |
| 404 | Operation not found or does not belong to the authenticated user |

Notes:
- Uses Prisma transactions. If any file fails validation, no documents are created.
- (Phase 3 Update): The document is uploaded securely to an external storage provider (Cloudinary). The API response structure remains unchanged; delivery URLs are generated internally by the backend when needed.

---

### 2. List documents for operation

- Endpoint: `GET /api/operations/:id/documents`
- Auth: yes
- Purpose: Retrieve all documents associated with an operation.

Path parameters:

| Name | Type | Description |
|------|------|-------------|
| id | string | Operation ID |

Response (200):

```json
{
  "success": true,
  "message": "Documents fetched.",
  "data": {
    "documents": [
      {
        "id": "string",
        "operationId": "string",
        "originalFileName": "string",
        "mimeType": "string",
        "fileSize": 12345,
        "url": "string",
        "uploadStatus": "UPLOADED",
        "createdAt": "string",
        "updatedAt": "string"
      }
    ]
  }
}
```

Error responses:

| Status | Reason |
|--------|--------|
| 400 | Invalid Operation ID format |
| 401 | Authentication required |
| 404 | Operation not found or does not belong to the authenticated user |

---

### 3. Get document

- Endpoint: `GET /api/documents/:id`
- Auth: yes
- Purpose: Retrieve a specific document's metadata.

Path parameters:

| Name | Type | Description |
|------|------|-------------|
| id | string | Document ID |

Response (200):

```json
{
  "success": true,
  "message": "Document fetched.",
  "data": {
    "id": "string",
    "operationId": "string",
    "originalFileName": "string",
    "mimeType": "string",
    "fileSize": 12345,
    "url": "string",
    "uploadStatus": "UPLOADED",
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

Error responses:

| Status | Reason |
|--------|--------|
| 400 | Invalid Document ID format |
| 401 | Authentication required |
| 404 | Document not found or does not belong to the authenticated user |

---

### 4. Delete document

- Endpoint: `DELETE /api/documents/:id`
- Auth: yes
- Purpose: Delete a specific document's metadata.

Path parameters:

| Name | Type | Description |
|------|------|-------------|
| id | string | Document ID |

Response (200):

```json
{
  "success": true,
  "message": "Document deleted.",
  "data": null
}
```

Error responses:

| Status | Reason |
|--------|--------|
| 400 | Invalid Document ID format |
| 401 | Authentication required |
| 404 | Document not found or does not belong to the authenticated user |

Notes:
- Deletes both the database metadata and the external file from Cloudinary (implemented in Phase 3).

---

## E. Processing

### 1. Start Processing

- Endpoint: `POST /api/operations/:id/process`
- Auth: yes
- Purpose: Create and queue a processing job for the operation.

Path parameters:

| Name | Type | Description |
|------|------|-------------|
| id | string | Operation ID |

Response (201):

```json
{
  "success": true,
  "message": "Processing job queued successfully.",
  "data": {
    "id": "string",
    "operationId": "string",
    "userId": "string",
    "status": "QUEUED",
    "progress": 0,
    "startedAt": null,
    "completedAt": null,
    "failedAt": null,
    "errorMessage": null,
    "retryCount": 0,
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

Error responses:

| Status | Reason |
|--------|--------|
| 400 | Invalid Operation ID format or no uploaded documents exist |
| 401 | Authentication required |
| 404 | Operation not found or does not belong to the authenticated user |
| 409 | An active processing job already exists for this operation |
| 500 | Failed to enqueue processing job |

---

### 2. Get Operation Processing Status

- Endpoint: `GET /api/operations/:id/processing-status`
- Auth: yes
- Purpose: Retrieve the latest processing status for a given operation.

Path parameters:

| Name | Type | Description |
|------|------|-------------|
| id | string | Operation ID |

Response (200):

```json
{
  "success": true,
  "message": "Processing status fetched.",
  "data": {
    "id": "string",
    "operationId": "string",
    "userId": "string",
    "status": "COMPLETED",
    "progress": 100,
    "currentStage": "Done",
    "estimatedCompletion": null,
    "stages": {
      "ocr": "Completed",
      "extraction": "Completed",
      "validation": "Completed"
    },
    "startedAt": "string",
    "completedAt": "string",
    "failedAt": null,
    "errorMessage": null,
    "retryCount": 0,
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

Error responses:

| Status | Reason |
|--------|--------|
| 400 | Invalid Operation ID format |
| 401 | Authentication required |
| 404 | Operation not found, does not belong to user, or no processing jobs exist |
        "url": "string",
        "uploadStatus": "UPLOADED",
        "createdAt": "string",
        "updatedAt": "string"
      }
    ]
  }
}
```

Error responses:

| Status | Reason |
|--------|--------|
| 400 | Invalid Operation ID format |
| 401 | Authentication required |
| 404 | Operation not found or does not belong to the authenticated user |

---

### 3. Get document

- Endpoint: `GET /api/documents/:id`
- Auth: yes
- Purpose: Retrieve a specific document's metadata.

Path parameters:

| Name | Type | Description |
|------|------|-------------|
| id | string | Document ID |

Response (200):

```json
{
  "success": true,
  "message": "Document fetched.",
  "data": {
    "id": "string",
    "operationId": "string",
    "originalFileName": "string",
    "mimeType": "string",
    "fileSize": 12345,
    "url": "string",
    "uploadStatus": "UPLOADED",
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

Error responses:

| Status | Reason |
|--------|--------|
| 400 | Invalid Document ID format |
| 401 | Authentication required |
| 404 | Document not found or does not belong to the authenticated user |

---

### 4. Delete document

- Endpoint: `DELETE /api/documents/:id`
- Auth: yes
- Purpose: Delete a specific document's metadata.

Path parameters:

| Name | Type | Description |
|------|------|-------------|
| id | string | Document ID |

Response (200):

```json
{
  "success": true,
  "message": "Document deleted.",
  "data": null
}
```

Error responses:

| Status | Reason |
|--------|--------|
| 400 | Invalid Document ID format |
| 401 | Authentication required |
| 404 | Document not found or does not belong to the authenticated user |

Notes:
- Deletes both the database metadata and the external file from Cloudinary (implemented in Phase 3).

---

## E. Processing

### 1. Start Processing

- Endpoint: `POST /api/operations/:id/process`
- Auth: yes
- Purpose: Create and queue a processing job for the operation.

Path parameters:

| Name | Type | Description |
|------|------|-------------|
| id | string | Operation ID |

Response (201):

```json
{
  "success": true,
  "message": "Processing job queued successfully.",
  "data": {
    "id": "string",
    "operationId": "string",
    "userId": "string",
    "status": "QUEUED",
    "progress": 0,
    "startedAt": null,
    "completedAt": null,
    "failedAt": null,
    "errorMessage": null,
    "retryCount": 0,
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

Error responses:

| Status | Reason |
|--------|--------|
| 400 | Invalid Operation ID format or no uploaded documents exist |
| 401 | Authentication required |
| 404 | Operation not found or does not belong to the authenticated user |
| 409 | An active processing job already exists for this operation |
| 500 | Failed to enqueue processing job |

---

### 2. Get Operation Processing Status

- Endpoint: `GET /api/operations/:id/processing-status`
- Auth: yes
- Purpose: Retrieve the latest processing status for a given operation.

Path parameters:

| Name | Type | Description |
|------|------|-------------|
| id | string | Operation ID |

Response (200):

```json
{
  "success": true,
  "message": "Processing status fetched.",
  "data": {
    "id": "string",
    "operationId": "string",
    "userId": "string",
    "status": "COMPLETED",
    "progress": 100,
    "currentStage": "Done",
    "estimatedCompletion": null,
    "stages": {
      "ocr": "Completed",
      "extraction": "Completed",
      "validation": "Completed"
    },
    "startedAt": "string",
    "completedAt": "string",
    "failedAt": null,
    "errorMessage": null,
    "retryCount": 0,
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

Error responses:

| Status | Reason |
|--------|--------|
| 400 | Invalid Operation ID format |
| 401 | Authentication required |
| 404 | Operation not found, does not belong to user, or no processing jobs exist |

---

## F. Extractions Module

### 1. Get Operation Extraction

- Endpoint: `GET /api/operations/:id/extraction`
- Auth: yes
- Purpose: Retrieve all extractions generated by the AI for a given operation.

Path parameters:

| Name | Type | Description |
|------|------|-------------|
| id | string | Operation ID |

Response (200):

```json
{
  "success": true,
  "message": "Extractions fetched successfully.",
  "data": [
    {
      "id": "string",
      "operationId": "string",
      "processingJobId": "string",
      "documentId": "string",
      "documentType": "Commercial Invoice",
      "confidence": 0.98,
      "originalFields": {
        "invoiceNumber": "INV-10001",
        "containerNumber": "MSCU1234567"
      },
      "editedFields": null,
      "rawResponse": null,
      "status": "READY_FOR_REVIEW",
      "approvedBy": null,
      "approvedAt": null,
      "reviewedAt": null,
      "reviewerNotes": null,
      "version": 1,
      "createdAt": "string",
      "updatedAt": "string"
    }
  ]
}
```

Error responses:

| Status | Reason |
|--------|--------|
| 400 | Invalid Operation ID format |
| 401 | Authentication required |
| 404 | Operation not found or does not belong to the user |

### 2. Update Extraction

- Endpoint: `PATCH /api/extractions/:id`
- Auth: yes
- Purpose: Update extracted fields manually.

Path parameters:

| Name | Type | Description |
|------|------|-------------|
| id | string | Extraction ID |

Body:

```json
{
  "editedFields": {
    "invoiceNumber": "INV-10002"
  },
  "reviewerNotes": "Fixed typo in invoice number."
}
```

Response (200): Returns the updated extraction object.

### 3. Approve Extraction

- Endpoint: `POST /api/extractions/:id/approve`
- Auth: yes
- Purpose: Mark an extraction as approved, preventing further edits.

Path parameters:

| Name | Type | Description |
|------|------|-------------|
| id | string | Extraction ID |

Response (200): Returns the approved extraction object.

### 4. Reject Extraction

- Endpoint: `POST /api/extractions/:id/reject`
- Auth: yes
- Purpose: Mark an extraction as rejected.

Path parameters:

| Name | Type | Description |
|------|------|-------------|
| id | string | Extraction ID |

Body:

```json
{
  "reason": "Blurry document, cannot read."
}
```

Response (200): Returns the rejected extraction object.

### 5. Export Extraction to Excel

- Endpoint: `POST /api/exports/:id/export`
- Auth: yes
- Purpose: Generate and download an Excel workbook (`.xlsx`) containing the extraction's `editedFields` (falling back to `originalFields`).

Path parameters:

| Name | Type | Description |
|------|------|-------------|
| id | string | Extraction ID |

Response (200): Returns a raw binary Buffer of the Excel file.

Headers included in the response:
- `Content-Type`: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition`: `attachment; filename="TradeSift_Extraction_<id>.xlsx"`

Error responses:

| Status | Reason |
|--------|--------|
| 401 | Authentication required |
| 404 | Extraction not found or parent operation does not belong to the user |
| 409 | Extraction status is not `APPROVED` |

---

## G. Dashboard Module

### 1. Get Dashboard Summary

- Endpoint: `GET /api/dashboard/summary`
- Auth: yes
- Purpose: Retrieve high-level operational statistics, recent activity, and alerts for the user's dashboard.

Response (200):

```json
{
  "success": true,
  "message": "Dashboard summary fetched.",
  "data": {
    "stats": {
      "totalOperations": 10,
      "pendingReview": 2,
      "completedExports": 5,
      "successRate": "95.0%"
    },
    "recentDocuments": [
      {
        "id": "string",
        "name": "invoice.pdf",
        "type": "Unknown",
        "workflow": "Import Gate-In",
        "processedAt": "string",
        "status": "Verified",
        "operationId": "string",
        "reference": "string"
      }
    ],
    "alerts": [
      {
        "id": "alert-review-123",
        "title": "Operation INV-10001 requires review",
        "action": "Review Required",
        "type": "warning",
        "operationId": "string"
      }
    ]
  }
}
```

Error responses:

| Status | Reason |
|--------|--------|
| 401 | Authentication required |
