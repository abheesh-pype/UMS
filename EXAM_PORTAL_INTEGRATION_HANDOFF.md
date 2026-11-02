# UMS ↔ Exam Portal integration: developer handoff

Two separate apps with separate codebases and databases. UMS is the source of students, examinations and registrations; the Exam Portal runs the exams.

| App | Repo | Stack | Local URL |
| --- | --- | --- | --- |
| UMS client | `UMS/client` | Vite + React | http://localhost:5578 |
| UMS server | `UMS/server` | Express + Prisma + Postgres | `127.0.0.1:5050` (see port note) |
| Exam Portal | `Examination-Portal` | Next.js + `pg` | http://localhost:3000 |

## 1. What the integration does

| Flow | Starts in | Result |
| --- | --- | --- |
| Student sync | UMS (Integration tab, or automatically on Launch exam) | Student + assigned exams created/updated in the portal. No DOB or password is sent. |
| Student launch | UMS student dashboard → **Launch exam** | UMS asks the portal for a single-use 60 s link; student lands in the portal signed in. |
| Examination publish | UMS Academic Admin → Examination → Manage Examination → **Create Exam Portal** → **Open Exam Portal** | Assessment created/updated in the portal (idempotent on the UMS examination id). Result is also saved on the UMS `examinations.portal` column. |
| Academic Admin sign-in | Same card → **Open Exam Portal (questions & bulk upload)** | Single-use link signs them into the portal with the restricted "UMS Academic Staff" role (questions + assessments only, enforced server-side). |

Authentication between servers is OAuth 2.0 client-credentials. The Exam Portal has its own token issuer (RS256 JWT, JWKS at `/.well-known/jwks.json`). UMS never sends credentials to the browser.

Things the portal does **not** do: results are not sent back to UMS; question bank and assessments are shared across tenants (not isolated per institution).

## 2. Configuration (names only; never commit values)

**UMS `server/.env`**
```
UMS_TENANT_ID=<tenant id, e.g. institution-001>
EXAM_PORTAL_TOKEN_URL=<portal>/api/integrations/oauth/token
EXAM_PORTAL_CLIENT_ID=<client id>
EXAM_PORTAL_CLIENT_SECRET=<secret, shown once when the client is created>
EXAM_PORTAL_STUDENT_UPSERT_URL=<portal>/api/integrations/v1/students
EXAM_PORTAL_SCOPE="students:write students:launch staff:launch assessments:write"
EXAM_PORTAL_AUDIENCE=exam-portal-api
```
**Exam Portal `.env`** (besides `DATABASE_URL`)
```
INTEGRATION_ISSUER_URL=<portal public URL>
PORTAL_PUBLIC_URL=<portal public URL>
INTEGRATION_SIGNING_KEY=<from: node scripts/generate-signing-key.mjs>
INTEGRATION_TENANTS=[{"tenant_id":"<same tenant id as UMS>","builtin":true}]
```
Production URLs must be HTTPS. `UMS_TENANT_ID` must equal a `tenant_id` in `INTEGRATION_TENANTS`.

**Register the UMS client (once per environment)**, from `Examination-Portal`:
```
node --env-file=.env scripts/create-integration-client.mjs --tenant-id <tenant> --client-id ums \
  --scopes "students:write students:launch staff:launch assessments:write"
```
It prints the secret once. To fix scopes later without changing the secret add `--scopes-only`; to replace the secret add `--rotate`.
**A missing scope shows up as "The Exam Portal rejected UMS credentials (check scope …)"**. The portal silently narrows a token to the client's scopes, so check the client's scopes first.

## 3. Run locally

```bash
# 1) Exam Portal
cd Examination-Portal && npm install && npm run dev                 # :3000

# 2) UMS API  (port 5000 is taken by macOS AirPlay, so use 5050)
cd UMS/server && npm install && npx prisma migrate deploy && PORT=5050 npm run dev

# 3) UMS client
cd UMS/client && npm install && API_PROXY_TARGET=http://127.0.0.1:5050 npm run dev   # :5578
```
Local `.env` files may point at hosted databases: check `DATABASE_URL` before creating test data, and never run `server/src/scripts/seed.ts` (it truncates every table) against a shared database.

## 4. Test the whole flow in the UI

1. **Setup check:** both apps are running, the env variables from section 2 are set, and the integration client exists with all four scopes.
2. **Academic Admin (UMS):** Examination → Create Examination → Manage Examination → Create Exam Portal: pick session + examination, **a future date**, session and time → **Open Exam Portal**. Expect "Exam Portal confirmed: assessment created/updated".
3. Same card → **Open Exam Portal (questions & bulk upload)** (allow pop-ups) → add questions manually or bulk upload.
4. **Student (UMS):** must be active and registered for the examination → dashboard → **Launch exam** → portal opens signed in.
5. **Admin check:** University/Org Admin → **Integration** tab → "Provision a student" shows *Configured* or the missing settings.
6. The UMS sidebar **Examination → Examination Portal** lists published exams (read from the server).

Gotcha: the exam window is `start → start + duration + 30 min`. The portal dashboard's default **Started** filter hides windows that already ended; use **All** or **Previous**.

## 5. Automated tests

```bash
cd UMS/server && npm run test:exam-portal     # sender, launch tickets, staff sign-in, publish (26 tests)
cd Examination-Portal && npm test             # token issuer, validators, OIDC helpers (23 tests)
cd UMS/client && npm run build                # type-check + build
cd Examination-Portal && npm run build        # type-check + build (any DATABASE_URL works)
```

## 6. Where the code is

**UMS server:** `src/services/examPortalSync.ts` (all portal calls), `src/controllers/examIntegrationController.ts` (sync, launch, staff sign-in, publish), `src/routes/operationsRoutes.ts` (`/operations/exam-portal/staff-launch`, `/operations/examinations/:id/exam-portal`, `/operations/universities/:id/exam-portal-sync`), `src/routes/studentRoutes.ts` (`/students/examinations/:id/launch`).
**UMS client:** `src/pages/AcademicAdminPanel.tsx` (Create Exam Portal card, Examination Portal tab), `src/pages/ModernUniversityDashboard.tsx` (Integration tab).
**Exam Portal:** `lib/integrations/*` (tokens, issuer, payload validation, store, request helper), `app/api/integrations/**` (token, students, assessments, launch tickets, staff tickets), `app/api/auth/launch`, `lib/auth.ts` (restricted staff gate), `docs/INTEGRATIONS.md`, `scripts/*.mjs`.

## 7. Known issues and decisions for the next developer

- The Exam Portal repo currently contains **two implementations** of the integration (a parallel one by another developer was merged with this one). Both use the same table names, so do not change `integration_*` table schemas without checking both (`lib/integrations.ts`/`m2m.ts` and `lib/integrations/store.ts`).
- Prisma migration history cannot be replayed on an empty database (an old migration refers to a table created outside migrations). For a scratch database use `prisma db push`.
- Exams published before the `examinations.portal` column existed show no entry in the Examination Portal tab until **Open Exam Portal** is clicked again.
- Open/Close Portal now updates the portal assessment's status as well as UMS state.
- Not built: sending results back to UMS, tenant isolation of the question bank, automatic re-publish when an exam's date changes in UMS, student SSO through an external identity provider (OIDC code exists but is dormant).
