import { createHash } from 'crypto';

// UMS -> Exam Portal student provisioning (server-to-server, OAuth 2.0 client credentials).
// The endpoint, token URL, audience and scope are NOT verified against a deployed Exam Portal;
// they come entirely from server configuration. See server/README.md.

export class SyncError extends Error {
  constructor(public statusCode: number, message: string, public code = 'sync_failed') {
    super(message);
  }
}

type Env = Record<string, string | undefined>;

export interface SyncConfig {
  tenantId: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  upsertUrl: string;
  scope?: string;
  audience?: string;
  launchTicketUrl: string;
  staffLaunchTicketUrl: string;
  assessmentsUrl: string;
}

const REQUIRED = [
  'UMS_TENANT_ID', 'EXAM_PORTAL_TOKEN_URL', 'EXAM_PORTAL_CLIENT_ID',
  'EXAM_PORTAL_CLIENT_SECRET', 'EXAM_PORTAL_STUDENT_UPSERT_URL',
] as const;

const isLocalHost = (host: string) => ['localhost', '127.0.0.1', '[::1]'].includes(host);

const validUrl = (value: string, production: boolean) => {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return false;
    if (url.protocol === 'https:') return true;
    return !production && url.protocol === 'http:' && isLocalHost(url.hostname);
  } catch {
    return false;
  }
};

/** Names of missing/invalid settings; never includes values. */
export const getSyncConfigIssues = (env: Env = process.env) => {
  const production = env.NODE_ENV === 'production';
  const missing = REQUIRED.filter(name => !env[name]?.trim());
  const invalid = (['EXAM_PORTAL_TOKEN_URL', 'EXAM_PORTAL_STUDENT_UPSERT_URL', 'EXAM_PORTAL_LAUNCH_TICKET_URL'] as const)
    .filter(name => env[name]?.trim() && !validUrl(env[name]!.trim(), production));
  return { missing: [...missing], invalid };
};

export const loadSyncConfig = (env: Env = process.env): SyncConfig | null => {
  const issues = getSyncConfigIssues(env);
  if (issues.missing.length || issues.invalid.length) return null;
  return {
    tenantId: env.UMS_TENANT_ID!.trim(),
    tokenUrl: env.EXAM_PORTAL_TOKEN_URL!.trim(),
    clientId: env.EXAM_PORTAL_CLIENT_ID!.trim(),
    clientSecret: env.EXAM_PORTAL_CLIENT_SECRET!,
    upsertUrl: env.EXAM_PORTAL_STUDENT_UPSERT_URL!.trim(),
    launchTicketUrl: env.EXAM_PORTAL_LAUNCH_TICKET_URL?.trim()
      || env.EXAM_PORTAL_STUDENT_UPSERT_URL!.trim().replace(/\/students\/?$/, '/launch-tickets'),
    staffLaunchTicketUrl: env.EXAM_PORTAL_STUDENT_UPSERT_URL!.trim().replace(/\/students\/?$/, '/staff-launch-tickets'),
    assessmentsUrl: env.EXAM_PORTAL_STUDENT_UPSERT_URL!.trim().replace(/\/students\/?$/, '/assessments'),
    scope: env.EXAM_PORTAL_SCOPE?.trim() || undefined,
    audience: env.EXAM_PORTAL_AUDIENCE?.trim() || undefined,
  };
};

// ---- Payload mapping -------------------------------------------------------------------

export interface SyncStudent {
  enrollmentNo: string;
  name: string;
  email: string;
  status: string;
  specialisation?: string | null;
  programName: string;
}

export interface SyncAssessment {
  id: string;
  name: string;
  semesterName?: string | null;
}

/** Minimum fields only. Never DOB, passwords, phone, address or exam answers. */
export const buildStudentPayload = (tenantId: string, student: SyncStudent, assessments: SyncAssessment[]) => {
  const active = student.status === 'active';
  return {
    tenant_id: tenantId,
    external_student_id: student.enrollmentNo,
    candidate_id: student.enrollmentNo,
    name: student.name,
    email: student.email,
    category: student.programName,
    sub_category: student.specialisation || '',
    status: active ? 'active' : 'inactive',
    // Inactive students are sent with no assignments so the portal revokes access.
    assigned_assessments: active
      ? assessments.map(a => ({ ums_assessment_id: a.id, name: a.name, examination: a.semesterName || '' }))
      : [],
  };
};

export const idempotencyKey = (payload: unknown) =>
  createHash('sha256').update(JSON.stringify(payload)).digest('hex');

// ---- OAuth client credentials ----------------------------------------------------------

interface Deps {
  fetch?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}

let tokenCache: { key: string; token: string; expiresAt: number } | null = null;
export const clearTokenCache = () => { tokenCache = null; };

const safeJson = async (response: Response): Promise<any> => {
  try { return await response.json(); } catch { return null; }
};

const MIN_TOKEN_TTL_MS = 30_000;

export const getAccessToken = async (config: SyncConfig, deps: Deps = {}, forceRefresh = false) => {
  const now = (deps.now ?? Date.now)();
  const cacheKey = `${config.tokenUrl}|${config.clientId}|${config.scope}|${config.audience}`;
  if (!forceRefresh && tokenCache?.key === cacheKey && tokenCache.expiresAt - MIN_TOKEN_TTL_MS > now) {
    return tokenCache.token;
  }

  const form = new URLSearchParams({ grant_type: 'client_credentials' });
  if (config.scope) form.set('scope', config.scope);
  if (config.audience) form.set('audience', config.audience);

  let response: Response;
  try {
    response = await (deps.fetch ?? fetch)(config.tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: form,
      signal: AbortSignal.timeout(deps.timeoutMs ?? 10_000),
      redirect: 'error',
    });
  } catch {
    throw new SyncError(504, 'Could not reach the Exam Portal authorization server', 'token_unreachable');
  }
  if (!response.ok) {
    throw new SyncError(502, `Exam Portal authorization server rejected the client credentials (HTTP ${response.status})`, 'token_rejected');
  }
  const body = await safeJson(response);
  const type = typeof body?.token_type === 'string' ? body.token_type.toLowerCase() : '';
  const expiresIn = Number(body?.expires_in);
  if (typeof body?.access_token !== 'string' || !body.access_token || type !== 'bearer' || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new SyncError(502, 'Exam Portal authorization server returned an invalid token response', 'token_malformed');
  }
  tokenCache = { key: cacheKey, token: body.access_token, expiresAt: now + expiresIn * 1000 };
  return body.access_token as string;
};

// ---- Upsert ----------------------------------------------------------------------------

export interface SyncResult {
  externalStudentId: string;
  outcome: 'created' | 'updated';
  status: 'active' | 'inactive';
  assessmentCount: number;
  /** Assignments the portal reports it applied; undefined if the receiver did not say. */
  assignedCount?: number;
  /** UMS assessment ids the portal could not match to one of its assessments. */
  unmappedAssessmentIds: string[];
  syncedAt: string;
}

const inFlight = new Map<string, Promise<SyncResult>>();

/** Success is reported only for a 200/201 whose JSON body confirms `ok: true` for the same student. */
export const syncStudent = (
  config: SyncConfig,
  payload: ReturnType<typeof buildStudentPayload>,
  deps: Deps = {},
): Promise<SyncResult> => {
  const lock = `${payload.tenant_id}:${payload.external_student_id}`;
  const running = inFlight.get(lock);
  if (running) return running; // concurrent clicks share one request: no duplicate side effects

  const run = (async () => {
    const key = idempotencyKey(payload);
    const send = async (token: string) => {
      try {
        return await (deps.fetch ?? fetch)(config.upsertUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Idempotency-Key': key,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(deps.timeoutMs ?? 10_000),
          redirect: 'error',
        });
      } catch {
        throw new SyncError(504, 'The Exam Portal did not respond in time. The sync was not confirmed; retry later.', 'timeout');
      }
    };

    let response = await send(await getAccessToken(config, deps));
    if (response.status === 401) {
      // Token may have been revoked or expired early: refresh once, then retry once.
      clearTokenCache();
      response = await send(await getAccessToken(config, deps, true));
    }

    if (response.status === 401 || response.status === 403) {
      throw new SyncError(502, 'The Exam Portal rejected UMS credentials (check audience, scope and client registration)', 'unauthorized');
    }
    if (response.status === 400 || response.status === 422) {
      throw new SyncError(502, 'The Exam Portal rejected the student record as invalid', 'rejected');
    }
    if (!response.ok) {
      throw new SyncError(502, `The Exam Portal returned an error (HTTP ${response.status})`, 'remote_error');
    }
    const body = await safeJson(response);
    if (response.status !== 200 && response.status !== 201) {
      throw new SyncError(502, 'The Exam Portal returned an unexpected success status; sync not confirmed', 'unconfirmed');
    }
    if (body?.ok !== true || (body.external_student_id !== undefined && String(body.external_student_id) !== payload.external_student_id)) {
      throw new SyncError(502, 'The Exam Portal response did not confirm the sync', 'unconfirmed');
    }
    return {
      externalStudentId: payload.external_student_id,
      outcome: response.status === 201 ? 'created' : 'updated',
      status: payload.status as 'active' | 'inactive',
      assessmentCount: payload.assigned_assessments.length,
      assignedCount: Number.isInteger(body.assigned_assessments) ? body.assigned_assessments : undefined,
      unmappedAssessmentIds: Array.isArray(body.unmapped_assessments) ? body.unmapped_assessments.map(String) : [],
      syncedAt: new Date((deps.now ?? Date.now)()).toISOString(),
    } as SyncResult;
  })().finally(() => inFlight.delete(lock));

  inFlight.set(lock, run);
  return run;
};

// ---- Launch ticket (student signs in to the Exam Portal through UMS) ---------------------

/** Authenticated JSON request to the Exam Portal: one token refresh + retry on 401, explicit timeout, no redirects. */
const portalRequest = async (config: SyncConfig, method: string, url: string, body: unknown, deps: Deps = {}) => {
  const send = async (token: string) => {
    try {
      return await (deps.fetch ?? fetch)(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(deps.timeoutMs ?? 10_000),
        redirect: 'error',
      });
    } catch {
      throw new SyncError(504, 'The Exam Portal did not respond in time', 'timeout');
    }
  };
  let response = await send(await getAccessToken(config, deps));
  if (response.status === 401) {
    clearTokenCache();
    response = await send(await getAccessToken(config, deps, true));
  }
  return response;
};

/** Only accepts a sign-in URL that is HTTPS (or localhost outside production) and on the portal's own origin. */
const trustedPortalUrl = (config: SyncConfig, value: unknown) => {
  let url: URL;
  try { url = new URL(String(value)); } catch { throw new SyncError(502, 'The Exam Portal returned an invalid launch URL', 'unconfirmed'); }
  const production = process.env.NODE_ENV === 'production';
  const secure = url.protocol === 'https:' || (!production && url.protocol === 'http:' && isLocalHost(url.hostname));
  if (!secure || url.origin !== new URL(config.launchTicketUrl).origin || url.username || url.password) {
    throw new SyncError(502, 'The Exam Portal returned an invalid launch URL', 'unconfirmed');
  }
  return url.toString();
};

/** Asks the Exam Portal for a single-use sign-in link for an already-provisioned student. */
export const requestLaunchTicket = async (config: SyncConfig, externalStudentId: string, deps: Deps = {}) => {
  const response = await portalRequest(config, 'POST', config.launchTicketUrl, { tenant_id: config.tenantId, external_student_id: externalStudentId }, deps);
  if (response.status === 401 || response.status === 403) {
    throw new SyncError(502, 'The Exam Portal rejected UMS credentials (check scope students:launch)', 'unauthorized');
  }
  if (response.status === 404) throw new SyncError(502, 'The student is not provisioned in the Exam Portal', 'invalid_student');
  if (!response.ok) throw new SyncError(502, `The Exam Portal returned an error (HTTP ${response.status})`, 'remote_error');
  const body = await safeJson(response);
  if (body?.ok !== true) throw new SyncError(502, 'The Exam Portal returned an invalid launch URL', 'unconfirmed');
  return trustedPortalUrl(config, body.launch_url);
};

// ---- Staff single sign-on (Academic Admin -> Exam Portal question/assessment authoring) ----

export const portalStaffId = (userId: string) => `ums-user:${userId}`;

/** Single-use sign-in link for a UMS staff member. The portal creates/updates a restricted account for them. */
export const requestStaffLaunch = async (config: SyncConfig, user: { id: string; name: string; email: string }, deps: Deps = {}) => {
  const response = await portalRequest(config, 'POST', config.staffLaunchTicketUrl,
    { tenant_id: config.tenantId, external_user_id: portalStaffId(user.id), name: user.name, email: user.email }, deps);
  if (response.status === 401 || response.status === 403) {
    throw new SyncError(502, 'The Exam Portal rejected UMS credentials (check scope staff:launch)', 'unauthorized');
  }
  if (response.status === 409) {
    throw new SyncError(409, 'An Exam Portal account with your email already exists. Ask the portal administrator to resolve it.', 'account_conflict');
  }
  if (response.status === 400) throw new SyncError(502, 'The Exam Portal rejected the account details', 'rejected');
  if (!response.ok) throw new SyncError(502, `The Exam Portal returned an error (HTTP ${response.status})`, 'remote_error');
  const body = await safeJson(response);
  if (body?.ok !== true) throw new SyncError(502, 'The Exam Portal returned an invalid launch URL', 'unconfirmed');
  return trustedPortalUrl(config, body.launch_url);
};

// ---- Assessment (examination) publishing ----

export interface PortalAssessment {
  externalAssessmentId: string;
  name: string;
  examination: string;
  startDate: Date;
  endDate: Date;
  totalTimeMinutes: number;
  active: boolean;
}

/** Creates/updates the assessment shell in the Exam Portal. Success requires the portal to confirm with its assessment id. */
export const publishAssessment = async (config: SyncConfig, a: PortalAssessment, deps: Deps = {}) => {
  const response = await portalRequest(config, 'PUT', config.assessmentsUrl, {
    tenant_id: config.tenantId,
    external_assessment_id: a.externalAssessmentId,
    name: a.name,
    examination: a.examination,
    start_date: a.startDate.toISOString(),
    end_date: a.endDate.toISOString(),
    total_time: a.totalTimeMinutes,
    status: a.active ? 'active' : 'inactive',
  }, deps);
  if (response.status === 401 || response.status === 403) {
    throw new SyncError(502, 'The Exam Portal rejected UMS credentials (check scope assessments:write)', 'unauthorized');
  }
  if (response.status === 400) throw new SyncError(502, 'The Exam Portal rejected the examination details', 'rejected');
  if (!response.ok) throw new SyncError(502, `The Exam Portal returned an error (HTTP ${response.status})`, 'remote_error');
  const body = await safeJson(response);
  if ((response.status !== 200 && response.status !== 201) || body?.ok !== true || !Number.isInteger(body.assessment_id)
    || String(body.external_assessment_id) !== a.externalAssessmentId) {
    throw new SyncError(502, 'The Exam Portal response did not confirm the examination', 'unconfirmed');
  }
  return { assessmentId: body.assessment_id as number, outcome: response.status === 201 ? 'created' as const : 'updated' as const };
};

// ---- Authorization + data loading -------------------------------------------------------

const CANDIDATE_ID = /^\d{6}$/;
const ENROLLMENT_NO = /^[A-Za-z0-9._\/-]{1,64}$/;

export const isValidCandidateId = (value: unknown): value is string =>
  typeof value === 'string' && (CANDIDATE_ID.test(value.trim()) || ENROLLMENT_NO.test(value.trim()));

/**
 * Loads the student only if it belongs to the caller's organization and the given university
 * (a university_admin is additionally pinned to their own university).
 */
export const loadStudentForSync = async (
  db: any,
  user: { organizationId: string; role: string; universityId?: string | null },
  universityId: string,
  candidateId: string,
) => {
  if (!isValidCandidateId(candidateId)) throw new SyncError(400, 'Enter a valid Candidate ID', 'invalid_candidate');
  if (user.role === 'university_admin' && user.universityId !== universityId) {
    throw new SyncError(404, 'University not found', 'not_found');
  }
  const student = await db.student.findFirst({
    where: { organizationId: user.organizationId, enrollmentNo: candidateId.trim() },
    select: { id: true, enrollmentNo: true, name: true, email: true, status: true, specialisation: true, programId: true, sessionId: true },
  });
  const program = student && await db.program.findFirst({
    where: { id: student.programId, organizationId: user.organizationId, universityId },
    select: { name: true },
  });
  // Same message for "missing" and "other university" so IDs cannot be probed across tenants.
  if (!student || !program) throw new SyncError(404, 'No student with this Candidate ID was found in this university', 'invalid_student');

  const registrations = await db.examinationRegistration.findMany({
    where: { studentId: student.id, organizationId: user.organizationId },
    select: { examination: { select: { id: true, examinationName: true, endDate: true, status: true, semester: { select: { semesterName: true } } } } },
  });
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const assessments: SyncAssessment[] = registrations
    .map((r: any) => r.examination)
    .filter((e: any) => e && e.status !== 'draft' && new Date(e.endDate) >= today)
    .map((e: any) => ({ id: e.id, name: e.examinationName, semesterName: e.semester?.semesterName }));

  return { student: { ...student, programName: program.name } as SyncStudent, assessments };
};
