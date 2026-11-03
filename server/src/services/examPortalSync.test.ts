import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchAssessmentResults, publishAssessment, requestStaffLaunch, listPortalRoles, revokeStaffAccess, requestLaunchTicket, buildStudentPayload, clearTokenCache, getSyncConfigIssues, idempotencyKey, loadStudentForSync, loadSyncConfig, syncStudent, SyncError,
} from './examPortalSync.js';

const env = {
  UMS_TENANT_ID: 'institution-001',
  EXAM_PORTAL_TOKEN_URL: 'https://portal.example.edu/oauth/token',
  EXAM_PORTAL_CLIENT_ID: 'client-1',
  EXAM_PORTAL_CLIENT_SECRET: 's3cret',
  EXAM_PORTAL_STUDENT_UPSERT_URL: 'https://portal.example.edu/api/integrations/v1/students',
  EXAM_PORTAL_SCOPE: 'students:write',
  EXAM_PORTAL_AUDIENCE: 'exam-portal-api',
};
const config = loadSyncConfig(env)!;
const student = { enrollmentNo: '123456', name: 'Ex Student', email: 'a@b.edu', status: 'active', specialisation: 'Maths', programName: 'BSc' };
const assessments = [{ id: 'exam-uuid', name: 'Midterm', semesterName: 'Semester 1' }];
const payload = () => buildStudentPayload('institution-001', student, assessments);
const code = async (p: Promise<unknown>) => { try { await p; return 'ok'; } catch (e) { return (e as SyncError).code; } };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const tokenOk = () => json({ access_token: 'tok', token_type: 'Bearer', expires_in: 300 });

/** Fake portal: records calls, routes by URL. */
const portal = (upsert: (n: number, init: RequestInit) => Response | Promise<Response>, token = tokenOk) => {
  const calls: { url: string; init: RequestInit }[] = [];
  let upserts = 0;
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return url === config.tokenUrl ? token() : upsert(++upserts, init);
  }) as unknown as typeof fetch;
  return { fn, calls };
};

beforeEach(() => clearTokenCache());

test('config: missing and non-HTTPS settings are reported by name only', () => {
  assert.equal(loadSyncConfig({}), null);
  assert.deepEqual(getSyncConfigIssues({ ...env, EXAM_PORTAL_CLIENT_SECRET: '' }).missing, ['EXAM_PORTAL_CLIENT_SECRET']);
  const prod = { ...env, NODE_ENV: 'production', EXAM_PORTAL_STUDENT_UPSERT_URL: 'http://localhost/x' };
  assert.deepEqual(getSyncConfigIssues(prod).invalid, ['EXAM_PORTAL_STUDENT_UPSERT_URL']);
  assert.equal(loadSyncConfig({ ...env, EXAM_PORTAL_TOKEN_URL: 'http://portal.example.edu/t' }), null);
  assert.ok(loadSyncConfig({ ...env, EXAM_PORTAL_TOKEN_URL: 'http://localhost:9000/t' }));
});

test('payload: minimum fields, no DOB/password, UMS ids', () => {
  const p = payload();
  assert.deepEqual(Object.keys(p).sort(), ['assigned_assessments', 'candidate_id', 'category', 'email', 'external_student_id', 'name', 'status', 'sub_category', 'tenant_id']);
  assert.equal(p.external_student_id, '123456');
  assert.deepEqual(p.assigned_assessments, [{ ums_assessment_id: 'exam-uuid', name: 'Midterm', examination: 'Semester 1' }]);
  assert.doesNotMatch(JSON.stringify(p), /dob|password|birth/i);
});

test('payload: inactive student is sent inactive with no assignments', () => {
  const p = buildStudentPayload('t', { ...student, status: 'pending' }, assessments);
  assert.equal(p.status, 'inactive');
  assert.deepEqual(p.assigned_assessments, []);
});

test('auth: client-credentials request carries scope/audience and bearer token is used', async () => {
  const { fn, calls } = portal(() => json({ ok: true, external_student_id: '123456' }, 201));
  const result = await syncStudent(config, payload(), { fetch: fn });
  assert.equal(result.outcome, 'created');
  const [tokenCall, upsertCall] = calls;
  const form = new URLSearchParams(String(tokenCall.init.body));
  assert.equal(form.get('grant_type'), 'client_credentials');
  assert.equal(form.get('scope'), 'students:write');
  assert.equal(form.get('audience'), 'exam-portal-api');
  assert.match((tokenCall.init.headers as any).Authorization, /^Basic /);
  assert.equal((upsertCall.init.headers as any).Authorization, 'Bearer tok');
  assert.equal((upsertCall.init.headers as any)['Idempotency-Key'], idempotencyKey(payload()));
  assert.doesNotMatch(String(upsertCall.init.body), /s3cret/);
});

test('auth: token is cached across syncs and refreshed on 401', async () => {
  const first = portal(() => json({ ok: true }, 200));
  await syncStudent(config, payload(), { fetch: first.fn });
  await syncStudent(config, payload(), { fetch: first.fn });
  assert.equal(first.calls.filter(c => c.url === config.tokenUrl).length, 1);

  clearTokenCache();
  const expired = portal(n => (n === 1 ? json({}, 401) : json({ ok: true }, 200)));
  assert.equal((await syncStudent(config, payload(), { fetch: expired.fn })).outcome, 'updated');
  assert.equal(expired.calls.filter(c => c.url === config.tokenUrl).length, 2);
});

test('auth: persistent 401/403 and token failures are reported', async () => {
  assert.equal(await code(syncStudent(config, payload(), { fetch: portal(() => json({}, 401)).fn })), 'unauthorized');
  clearTokenCache();
  assert.equal(await code(syncStudent(config, payload(), { fetch: portal(() => json({}, 403)).fn })), 'unauthorized');
  clearTokenCache();
  assert.equal(await code(syncStudent(config, payload(), { fetch: portal(() => json({}), () => json({}, 401)).fn })), 'token_rejected');
  clearTokenCache();
  assert.equal(await code(syncStudent(config, payload(), { fetch: portal(() => json({}), () => json({ access_token: 'x' })).fn })), 'token_malformed');
});

test('receiver counts and unmapped assessments are surfaced', async () => {
  const { fn } = portal(() => json({ ok: true, assigned_assessments: 1, unmapped_assessments: ['uuid-2'] }));
  const r = await syncStudent(config, payload(), { fetch: fn });
  assert.equal(r.assignedCount, 1);
  assert.deepEqual(r.unmappedAssessmentIds, ['uuid-2']);
  clearTokenCache();
  const bare = await syncStudent(config, payload(), { fetch: portal(() => json({ ok: true })).fn });
  assert.equal(bare.assignedCount, undefined);
  assert.deepEqual(bare.unmappedAssessmentIds, []);
});

test('success is not claimed without receiver confirmation', async () => {
  const cases: Response[] = [
    json({ ok: false }), json({}), new Response('not json', { status: 200 }), json({ ok: true, external_student_id: '999999' }), json({ ok: true }, 202),
  ];
  for (const bad of cases) {
    clearTokenCache();
    assert.equal(await code(syncStudent(config, payload(), { fetch: portal(() => bad.clone()).fn })), 'unconfirmed');
  }
});

test('remote errors: 400 rejected, 5xx remote_error, timeout', async () => {
  assert.equal(await code(syncStudent(config, payload(), { fetch: portal(() => json({}, 400)).fn })), 'rejected');
  clearTokenCache();
  assert.equal(await code(syncStudent(config, payload(), { fetch: portal(() => json({}, 503)).fn })), 'remote_error');
  clearTokenCache();
  const hang = ((url: string, init: RequestInit) => (url === config.tokenUrl ? Promise.resolve(tokenOk()) : new Promise((_, reject) => {
    init.signal!.addEventListener('abort', () => reject(new Error('aborted')));
  }))) as unknown as typeof fetch;
  assert.equal(await code(syncStudent(config, payload(), { fetch: hang, timeoutMs: 20 })), 'timeout');
});

test('idempotent: repeats send the same key; concurrent syncs share one request', async () => {
  const keys: string[] = [];
  const { fn, calls } = portal((n, init) => { keys.push((init.headers as any)['Idempotency-Key']); return json({ ok: true }, n === 1 ? 201 : 200); });
  const [a, b] = await Promise.all([syncStudent(config, payload(), { fetch: fn }), syncStudent(config, payload(), { fetch: fn })]);
  assert.equal(a, b);
  assert.equal(calls.filter(c => c.url === config.upsertUrl).length, 1);
  const again = await syncStudent(config, payload(), { fetch: fn });
  assert.equal(again.outcome, 'updated');
  assert.equal(keys[0], keys[1]);
});

// ---- authorization / data loading ----

const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 5 * 86_400_000);
const fakeDb = (over: any = {}) => ({
  student: { findFirst: async ({ where }: any) => (where.enrollmentNo === '123456' && where.organizationId === 'org1' ? { id: 's1', enrollmentNo: '123456', name: 'X', email: 'x@y', status: 'active', programId: 'p1', ...over.student } : null) },
  program: { findFirst: async ({ where }: any) => (where.id === 'p1' && where.universityId === 'uni1' ? { name: 'BSc' } : null) },
  examinationRegistration: {
    findMany: async () => over.regs ?? [
      { examination: { id: 'e1', examinationName: 'Open', endDate: future, status: 'published', semester: { semesterName: 'S1' } } },
      { examination: { id: 'e2', examinationName: 'Old', endDate: past, status: 'published', semester: { semesterName: 'S1' } } },
      { examination: { id: 'e3', examinationName: 'Draft', endDate: future, status: 'draft', semester: { semesterName: 'S1' } } },
    ],
  },
});
const admin = { organizationId: 'org1', role: 'org_admin' };

test('authorization: only current, non-draft assignments are loaded', async () => {
  const { assessments: list } = await loadStudentForSync(fakeDb(), admin, 'uni1', '123456');
  assert.deepEqual(list.map(a => a.id), ['e1']);
});

test('authorization: invalid ID, unknown student, other university/org are rejected', async () => {
  assert.equal(await code(loadStudentForSync(fakeDb(), admin, 'uni1', '12 3;')), 'invalid_candidate');
  assert.equal(await code(loadStudentForSync(fakeDb(), admin, 'uni1', '654321')), 'invalid_student');
  assert.equal(await code(loadStudentForSync(fakeDb(), admin, 'uni2', '123456')), 'invalid_student');
  assert.equal(await code(loadStudentForSync(fakeDb(), { ...admin, organizationId: 'org2' }, 'uni1', '123456')), 'invalid_student');
  assert.equal(await code(loadStudentForSync(fakeDb(), { organizationId: 'org1', role: 'university_admin', universityId: 'uni2' }, 'uni1', '123456')), 'not_found');
  assert.equal(await code(loadStudentForSync(fakeDb(), { organizationId: 'org1', role: 'university_admin', universityId: 'uni1' }, 'uni1', '123456')), 'ok');
});

test('inactive student loads and maps to inactive with no assignments', async () => {
  const { student: s, assessments: list } = await loadStudentForSync(fakeDb({ student: { status: 'inactive' } }), admin, 'uni1', '123456');
  const p = buildStudentPayload('t', s, list);
  assert.equal(p.status, 'inactive');
  assert.deepEqual(p.assigned_assessments, []);
});

// ---- launch ticket ----

test('launch ticket: derived URL, bearer token, same-origin HTTPS URL accepted', async () => {
  assert.equal(config.launchTicketUrl, 'https://portal.example.edu/api/integrations/v1/launch-tickets');
  const { fn, calls } = portal(() => json({ ok: true, launch_url: 'https://portal.example.edu/api/auth/launch?ticket=abc', expires_in: 60 }));
  assert.equal(await requestLaunchTicket(config, '123456', { fetch: fn }), 'https://portal.example.edu/api/auth/launch?ticket=abc');
  assert.equal(calls[1].url, config.launchTicketUrl);
  assert.deepEqual(JSON.parse(String(calls[1].init.body)), { tenant_id: 'institution-001', external_student_id: '123456' });
  assert.equal((calls[1].init.headers as any).Authorization, 'Bearer tok');
});

test('launch ticket: foreign origin, http, missing ok, 404, 403 and timeout are rejected', async () => {
  for (const bad of [
    json({ ok: true, launch_url: 'https://evil.example/api/auth/launch?ticket=x' }),
    json({ ok: true, launch_url: 'http://portal.example.edu/api/auth/launch?ticket=x' }),
    json({ ok: true, launch_url: 'https://user:pw@portal.example.edu/x' }),
    json({ launch_url: 'https://portal.example.edu/x' }),
    json({ ok: true }),
  ]) {
    clearTokenCache();
    assert.equal(await code(requestLaunchTicket(config, '123456', { fetch: portal(() => bad.clone()).fn })), 'unconfirmed');
  }
  clearTokenCache();
  assert.equal(await code(requestLaunchTicket(config, '123456', { fetch: portal(() => json({}, 404)).fn })), 'invalid_student');
  clearTokenCache();
  assert.equal(await code(requestLaunchTicket(config, '123456', { fetch: portal(() => json({}, 403)).fn })), 'unauthorized');
  clearTokenCache();
  const hang = ((url: string, init: RequestInit) => (url === config.tokenUrl ? Promise.resolve(tokenOk()) : new Promise((_, reject) => {
    init.signal!.addEventListener('abort', () => reject(new Error('aborted')));
  }))) as unknown as typeof fetch;
  assert.equal(await code(requestLaunchTicket(config, '123456', { fetch: hang, timeoutMs: 20 })), 'timeout');
});

// ---- staff sign-in & assessment publishing ----

test('staff launch: derived URL, identity sent, trusted URL returned; conflicts and scope errors surfaced', async () => {
  assert.equal(config.staffLaunchTicketUrl, 'https://portal.example.edu/api/integrations/v1/staff-launch-tickets');
  const ok = portal(() => json({ ok: true, launch_url: 'https://portal.example.edu/api/auth/launch?ticket=abc' }));
  assert.equal(await requestStaffLaunch(config, { id: 'u1', name: 'Ann', email: 'ann@x.edu' }, { fetch: ok.fn }), 'https://portal.example.edu/api/auth/launch?ticket=abc');
  assert.deepEqual(JSON.parse(String(ok.calls[1].init.body)), { tenant_id: 'institution-001', external_user_id: 'ums-user:u1', name: 'Ann', email: 'ann@x.edu' });
  clearTokenCache();
  assert.equal(await code(requestStaffLaunch(config, { id: 'u1', name: 'A', email: 'a@x.edu' }, { fetch: portal(() => json({}, 409)).fn })), 'account_conflict');
  clearTokenCache();
  assert.equal(await code(requestStaffLaunch(config, { id: 'u1', name: 'A', email: 'a@x.edu' }, { fetch: portal(() => json({}, 403)).fn })), 'unauthorized');
  clearTokenCache();
  assert.equal(await code(requestStaffLaunch(config, { id: 'u1', name: 'A', email: 'a@x.edu' }, { fetch: portal(() => json({ ok: true, launch_url: 'https://evil.example/x' })).fn })), 'unconfirmed');
});

test('staff launch with a portal role: role sent, unknown role surfaced; roles listed from the portal', async () => {
  const ok = portal(() => json({ ok: true, launch_url: 'https://portal.example.edu/api/auth/launch?ticket=abc' }));
  await requestStaffLaunch(config, { id: 'u2', name: 'Eve', email: 'e@x.edu', portalRole: 'Evaluator' }, { fetch: ok.fn });
  assert.equal(JSON.parse(String(ok.calls[1].init.body)).role, 'Evaluator');
  clearTokenCache();
  assert.equal(await code(requestStaffLaunch(config, { id: 'u2', name: 'Eve', email: 'e@x.edu', portalRole: 'Gone' }, { fetch: portal(() => json({ error: 'unknown_role' }, 400)).fn })), 'unknown_role');
  clearTokenCache();
  const roles = portal(() => json({ ok: true, roles: [{ name: 'Evaluator', administrator_access: false }, { name: 'UMS Administrator', administrator_access: true }, { nope: 1 }] }));
  assert.deepEqual(await listPortalRoles(config, { fetch: roles.fn }), [{ name: 'Evaluator', administratorAccess: false }, { name: 'UMS Administrator', administratorAccess: true }]);
  assert.equal(roles.calls[1].url, 'https://portal.example.edu/api/integrations/v1/roles?tenant_id=institution-001');
  assert.equal(roles.calls[1].init.method, 'GET');
  clearTokenCache();
  assert.equal(await code(listPortalRoles(config, { fetch: portal(() => json({}, 403)).fn })), 'unauthorized');
});

test('revoke staff access: identity sent, confirmation required', async () => {
  const ok = portal(() => json({ ok: true, revoked: true }));
  assert.equal(await revokeStaffAccess(config, 'u9', { fetch: ok.fn }), true);
  assert.equal(ok.calls[1].url, 'https://portal.example.edu/api/integrations/v1/staff-revocations');
  assert.deepEqual(JSON.parse(String(ok.calls[1].init.body)), { tenant_id: 'institution-001', external_user_id: 'ums-user:u9' });
  clearTokenCache();
  assert.equal(await code(revokeStaffAccess(config, 'u9', { fetch: portal(() => json({}, 200)).fn })), 'unconfirmed');
  clearTokenCache();
  assert.equal(await code(revokeStaffAccess(config, 'u9', { fetch: portal(() => json({}, 403)).fn })), 'unauthorized');
});

const assessment = { externalAssessmentId: 'exam-1', name: 'Midterm', examination: 'Semester 1', startDate: new Date('2026-11-01T04:00:00Z'), endDate: new Date('2026-11-01T06:30:00Z'), totalTimeMinutes: 120, active: true };

test('publish assessment: payload mapping and confirmed result', async () => {
  const { fn, calls } = portal(() => json({ ok: true, external_assessment_id: 'exam-1', assessment_id: 7 }, 201));
  assert.deepEqual(await publishAssessment(config, assessment, { fetch: fn }), { assessmentId: 7, outcome: 'created' });
  assert.equal(calls[1].url, 'https://portal.example.edu/api/integrations/v1/assessments');
  assert.equal(calls[1].init.method, 'PUT');
  assert.deepEqual(JSON.parse(String(calls[1].init.body)), {
    tenant_id: 'institution-001', external_assessment_id: 'exam-1', name: 'Midterm', examination: 'Semester 1',
    start_date: '2026-11-01T04:00:00.000Z', end_date: '2026-11-01T06:30:00.000Z', total_time: 120, status: 'active',
  });
});

test('publish assessment: unconfirmed, mismatched id, rejection and timeout are errors', async () => {
  for (const bad of [json({ ok: true, external_assessment_id: 'exam-1' }), json({ ok: true, external_assessment_id: 'other', assessment_id: 7 }), json({ ok: false, assessment_id: 7 }), json({ ok: true, external_assessment_id: 'exam-1', assessment_id: 7 }, 202)]) {
    clearTokenCache();
    assert.equal(await code(publishAssessment(config, assessment, { fetch: portal(() => bad.clone()).fn })), 'unconfirmed');
  }
  clearTokenCache();
  assert.equal(await code(publishAssessment(config, assessment, { fetch: portal(() => json({}, 400)).fn })), 'rejected');
  clearTokenCache();
  assert.equal(await code(publishAssessment(config, assessment, { fetch: portal(() => json({}, 403)).fn })), 'unauthorized');
});

const resultRow = (overrides: Record<string, unknown> = {}) => ({
  external_assessment_id: 'exam-1', external_student_id: 'ENR001', candidate_id: '482913',
  obtained_mark: 42, negative_mark: -3, total_mark: 60, pass_mark: 30, passed: true,
  evaluated_at: '2026-11-02T10:00:00.000Z', ...overrides,
});

test('results: GET with assessment and tenant in the query, no body, rows mapped', async () => {
  const { fn, calls } = portal(() => json({ ok: true, results: [resultRow(), resultRow({ external_student_id: 'ENR002', pass_mark: null, passed: null, negative_mark: null })] }));
  const { results, skipped } = await fetchAssessmentResults(config, 'exam-1', { fetch: fn });
  const url = new URL(calls[1].url);
  assert.equal(url.origin + url.pathname, 'https://portal.example.edu/api/integrations/v1/results');
  assert.equal(url.searchParams.get('external_assessment_id'), 'exam-1');
  assert.equal(url.searchParams.get('tenant_id'), 'institution-001');
  assert.equal(calls[1].init.method, 'GET');
  assert.equal(calls[1].init.body, undefined);
  assert.equal(skipped, 0);
  assert.deepEqual(results[0], {
    externalStudentId: 'ENR001', candidateId: '482913', obtainedMark: 42, negativeMark: -3, totalMark: 60,
    passMark: 30, passed: true, evaluatedAt: new Date('2026-11-02T10:00:00.000Z'),
  });
  assert.deepEqual([results[1].passMark, results[1].passed, results[1].negativeMark], [null, null, null]);
});

test('results: malformed rows and rows for another assessment are skipped, not imported', async () => {
  const rows = [
    resultRow(),
    resultRow({ external_assessment_id: 'other-exam' }),
    resultRow({ external_student_id: '' }),
    resultRow({ obtained_mark: 'abc' }),
    resultRow({ total_mark: null }),
    resultRow({ evaluated_at: 'not a date' }),
  ];
  const { results, skipped } = await fetchAssessmentResults(config, 'exam-1', { fetch: portal(() => json({ ok: true, results: rows })).fn });
  assert.equal(results.length, 1);
  assert.equal(skipped, 5);
});

test('results: invalid body, missing scope, unknown assessment and server errors are reported', async () => {
  const cases: [Response, string][] = [
    [json({ ok: false }), 'unconfirmed'],
    [json({ ok: true, results: 'x' }), 'unconfirmed'],
    [json({}, 403), 'unauthorized'],
    [json({}, 404), 'not_found'],
    [json({}, 500), 'remote_error'],
  ];
  for (const [response, expected] of cases) {
    clearTokenCache();
    assert.equal(await code(fetchAssessmentResults(config, 'exam-1', { fetch: portal(() => response.clone()).fn })), expected);
  }
});
