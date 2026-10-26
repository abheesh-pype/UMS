import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'crypto';
import jwt from 'jsonwebtoken';
import {
  clearJwksCache, getReceiverConfigIssues, loadReceiverConfig, ReceiverError, upsertCandidate, validateStudentPayload, verifyBearerToken,
} from './examPortalReceiver.js';

const env = {
  UMS_TENANT_ID: 'institution-001',
  INTEGRATION_TOKEN_ISSUER: 'https://idp.example.edu/',
  INTEGRATION_TOKEN_JWKS_URL: 'https://idp.example.edu/jwks.json',
  INTEGRATION_TOKEN_AUDIENCE: 'ums-api',
  INTEGRATION_REQUIRED_SCOPE: 'students:write',
};
const config = loadReceiverConfig(env)!;
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', use: 'sig', alg: 'RS256' };
const jwks = (async () => new Response(JSON.stringify({ keys: [jwk] }))) as typeof fetch;
const sign = (over: any = {}, opts: any = {}) => jwt.sign(
  { scope: 'students:write', ...over }, privateKey,
  { algorithm: 'RS256', keyid: 'k1', issuer: env.INTEGRATION_TOKEN_ISSUER, audience: env.INTEGRATION_TOKEN_AUDIENCE, expiresIn: 300, ...opts },
);
const code = async (p: Promise<unknown>) => { try { await p; return 200; } catch (e) { return (e as ReceiverError).statusCode; } };

beforeEach(() => clearJwksCache());

const body = (over: any = {}) => ({
  tenant_id: 'institution-001', external_student_id: '123456', candidate_id: '123456', name: 'Ex Student',
  email: 'a@b.edu', category: 'UG', sub_category: 'Y1', status: 'active',
  assigned_assessments: [{ ums_assessment_id: 42, name: 'Midterm', examination: 'Sem 1' }], ...over,
});

test('config: missing / non-HTTPS settings disable the receiver', () => {
  assert.equal(loadReceiverConfig({}), null);
  assert.deepEqual(getReceiverConfigIssues({ ...env, INTEGRATION_REQUIRED_SCOPE: '' }).missing, ['INTEGRATION_REQUIRED_SCOPE']);
  assert.equal(loadReceiverConfig({ ...env, NODE_ENV: 'production', INTEGRATION_TOKEN_JWKS_URL: 'http://localhost/jwks' }), null);
});

test('token: valid token accepted; scp array scope also accepted', async () => {
  await verifyBearerToken(`Bearer ${sign()}`, config, jwks);
  await verifyBearerToken(`Bearer ${sign({ scope: undefined, scp: ['students:write'] })}`, config, jwks);
});

test('token: missing, malformed, expired, wrong issuer/audience, forged key => 401', async () => {
  assert.equal(await code(verifyBearerToken(undefined, config, jwks)), 401);
  assert.equal(await code(verifyBearerToken('Bearer abc', config, jwks)), 401);
  assert.equal(await code(verifyBearerToken(`Bearer ${sign({}, { expiresIn: -120 })}`, config, jwks)), 401);
  assert.equal(await code(verifyBearerToken(`Bearer ${sign({}, { issuer: 'https://evil' })}`, config, jwks)), 401);
  assert.equal(await code(verifyBearerToken(`Bearer ${sign({}, { audience: 'other' })}`, config, jwks)), 401);
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  const forged = jwt.sign({ scope: 'students:write' }, other, { algorithm: 'RS256', keyid: 'k1', issuer: env.INTEGRATION_TOKEN_ISSUER, audience: env.INTEGRATION_TOKEN_AUDIENCE, expiresIn: 60 });
  assert.equal(await code(verifyBearerToken(`Bearer ${forged}`, config, jwks)), 401);
  const none = jwt.sign({ scope: 'students:write' }, '', { algorithm: 'none' } as any);
  assert.equal(await code(verifyBearerToken(`Bearer ${none}`, config, jwks)), 401);
});

test('token: wrong scope => 403; JWKS outage => 503', async () => {
  assert.equal(await code(verifyBearerToken(`Bearer ${sign({ scope: 'read' })}`, config, jwks)), 403);
  clearJwksCache();
  const down = (async () => new Response('', { status: 500 })) as typeof fetch;
  assert.equal(await code(verifyBearerToken(`Bearer ${sign()}`, config, down)), 503);
});

test('payload: valid body is mapped; numeric assessment id kept; unknown fields (dob/password) dropped', () => {
  const data = validateStudentPayload(body({ dob: '2000-01-01', password: 'x' }), config);
  assert.equal(data.externalStudentId, '123456');
  assert.deepEqual(data.assignedAssessments, [{ ums_assessment_id: 42, name: 'Midterm', examination: 'Sem 1' }]);
  assert.ok(!JSON.stringify(data).includes('2000-01-01'));
});

test('payload: tenant mismatch => 403, malformed => 400', () => {
  const status = (b: any) => { try { validateStudentPayload(b, config); return 200; } catch (e) { return (e as ReceiverError).statusCode; } };
  assert.equal(status(body({ tenant_id: 'other' })), 403);
  assert.equal(status(null), 400);
  assert.equal(status(body({ external_student_id: '' })), 400);
  assert.equal(status(body({ status: 'banned' })), 400);
  assert.equal(status(body({ assigned_assessments: 'x' })), 400);
  assert.equal(status(body({ assigned_assessments: [{ name: 'x' }] })), 400);
});

test('payload: inactive candidate stores no assignments', () => {
  assert.deepEqual(validateStudentPayload(body({ status: 'inactive' }), config).assignedAssessments, []);
});

const fakeDb = () => {
  const rows = new Map<string, any>();
  const k = (w: any) => `${w.tenantId_externalStudentId.tenantId}:${w.tenantId_externalStudentId.externalStudentId}`;
  return {
    rows,
    examPortalCandidate: {
      findUnique: async ({ where }: any) => rows.get(k(where)) ?? null,
      upsert: async ({ where, create, update }: any) => { rows.set(k(where), rows.has(k(where)) ? { ...rows.get(k(where)), ...update } : create); },
    },
  };
};

test('upsert: create, then update, then identical idempotency key is a no-op; no duplicates', async () => {
  const db = fakeDb();
  const data = validateStudentPayload(body(), config);
  assert.equal(await upsertCandidate(db, data, 'key-1'), 'created');
  assert.equal(await upsertCandidate(db, data, 'key-1'), 'unchanged');
  assert.equal(await upsertCandidate(db, { ...data, name: 'Renamed' }, 'key-2'), 'updated');
  assert.equal(db.rows.size, 1);
  assert.equal([...db.rows.values()][0].name, 'Renamed');
  assert.equal(await upsertCandidate(db, validateStudentPayload(body({ status: 'inactive' }), config)), 'updated');
  assert.equal([...db.rows.values()][0].status, 'inactive');
});
