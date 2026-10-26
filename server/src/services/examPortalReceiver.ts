// Receiver for student records pushed by the Exam Portal (POST /api/integrations/v1/students).
// Bearer tokens are verified against the configured issuer's JWKS; nothing here is trusted from the body
// except validated fields.
import { createPublicKey } from 'crypto';
import jwt from 'jsonwebtoken';

export interface ReceiverConfig {
  tenantId: string;
  issuer: string;
  jwksUrl: string;
  audience: string;
  requiredScope: string;
}

export class ReceiverError extends Error {
  constructor(public statusCode: number, message: string, public code = 'error') {
    super(message);
  }
}

const REQUIRED_ENV = ['UMS_TENANT_ID', 'INTEGRATION_TOKEN_ISSUER', 'INTEGRATION_TOKEN_JWKS_URL', 'INTEGRATION_TOKEN_AUDIENCE', 'INTEGRATION_REQUIRED_SCOPE'] as const;

const isSafeUrl = (value: string, production: boolean) => {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return false;
    return url.protocol === 'https:' || (!production && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
  } catch {
    return false;
  }
};

export const getReceiverConfigIssues = (env: Record<string, string | undefined> = process.env) => {
  const missing: string[] = REQUIRED_ENV.filter(name => !env[name]?.trim());
  const invalid = ['INTEGRATION_TOKEN_ISSUER', 'INTEGRATION_TOKEN_JWKS_URL'].filter(
    name => env[name]?.trim() && !isSafeUrl(env[name]!.trim(), env.NODE_ENV === 'production'),
  );
  return { missing, invalid };
};

export const loadReceiverConfig = (env: Record<string, string | undefined> = process.env): ReceiverConfig | null => {
  const { missing, invalid } = getReceiverConfigIssues(env);
  if (missing.length || invalid.length) return null;
  return {
    tenantId: env.UMS_TENANT_ID!.trim(),
    issuer: env.INTEGRATION_TOKEN_ISSUER!.trim(),
    jwksUrl: env.INTEGRATION_TOKEN_JWKS_URL!.trim(),
    audience: env.INTEGRATION_TOKEN_AUDIENCE!.trim(),
    requiredScope: env.INTEGRATION_REQUIRED_SCOPE!.trim(),
  };
};

type Fetch = typeof fetch;
let jwksCache: { url: string; keys: any[]; fetchedAt: number } | null = null;
export const clearJwksCache = () => { jwksCache = null; };

const getKeys = async (url: string, fetchImpl: Fetch, force = false) => {
  if (!force && jwksCache && jwksCache.url === url && Date.now() - jwksCache.fetchedAt < 10 * 60_000) return jwksCache.keys;
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000), redirect: 'error' });
  if (!response.ok) throw new Error('JWKS fetch failed');
  const json: any = await response.json();
  if (!Array.isArray(json?.keys)) throw new Error('JWKS malformed');
  jwksCache = { url, keys: json.keys, fetchedAt: Date.now() };
  return jwksCache.keys;
};

/** Verifies signature (RS/ES only), issuer, audience, expiry and scope. Throws ReceiverError(401/403/503). */
export const verifyBearerToken = async (authorization: string | undefined, config: ReceiverConfig, fetchImpl: Fetch = fetch) => {
  const match = /^Bearer\s+(\S+)$/i.exec(authorization || '');
  if (!match) throw new ReceiverError(401, 'Missing bearer token', 'unauthorized');
  const decoded: any = jwt.decode(match[1], { complete: true });
  const kid = decoded?.header?.kid;
  const alg = decoded?.header?.alg;
  if (!decoded || !['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'].includes(alg)) {
    throw new ReceiverError(401, 'Invalid token', 'unauthorized');
  }
  let keys: any[];
  try {
    keys = await getKeys(config.jwksUrl, fetchImpl);
    if (kid && !keys.some(key => key.kid === kid)) keys = await getKeys(config.jwksUrl, fetchImpl, true);
  } catch {
    throw new ReceiverError(503, 'Token verification is temporarily unavailable', 'unavailable');
  }
  const jwk = keys.find(key => (kid ? key.kid === kid : true) && (!key.use || key.use === 'sig'));
  if (!jwk) throw new ReceiverError(401, 'Invalid token', 'unauthorized');
  let claims: any;
  try {
    claims = jwt.verify(match[1], createPublicKey({ key: jwk, format: 'jwk' }), {
      algorithms: [alg], issuer: config.issuer, audience: config.audience, clockTolerance: 30,
    });
  } catch {
    throw new ReceiverError(401, 'Invalid or expired token', 'unauthorized');
  }
  const scopes = new Set<string>([
    ...(typeof claims.scope === 'string' ? claims.scope.split(' ') : []),
    ...(Array.isArray(claims.scp) ? claims.scp : typeof claims.scp === 'string' ? claims.scp.split(' ') : []),
  ]);
  if (!scopes.has(config.requiredScope)) throw new ReceiverError(403, 'Token lacks the required scope', 'forbidden');
  return claims;
};

const str = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

/** Validates the body and returns only the known fields. Throws ReceiverError(400/403). */
export const validateStudentPayload = (body: any, config: Pick<ReceiverConfig, 'tenantId'>) => {
  const bad = (message: string) => new ReceiverError(400, message, 'invalid_payload');
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw bad('Body must be a JSON object');
  if (!str(body.tenant_id, 100)) throw bad('tenant_id is required');
  if (body.tenant_id !== config.tenantId) throw new ReceiverError(403, 'tenant_id does not match this institution', 'forbidden');
  if (!str(body.external_student_id, 100)) throw bad('external_student_id is required');
  if (!str(body.candidate_id, 100)) throw bad('candidate_id is required');
  if (!str(body.name, 200)) throw bad('name is required');
  if (body.email != null && !(typeof body.email === 'string' && body.email.length <= 254)) throw bad('email must be a string or null');
  if (body.status !== 'active' && body.status !== 'inactive') throw bad('status must be "active" or "inactive"');
  for (const field of ['category', 'sub_category']) {
    if (body[field] != null && typeof body[field] !== 'string') throw bad(`${field} must be a string`);
  }
  if (!Array.isArray(body.assigned_assessments) || body.assigned_assessments.length > 500) throw bad('assigned_assessments must be an array (max 500)');
  const assessments = body.assigned_assessments.map((item: any) => {
    if (!item || typeof item !== 'object' || !(Number.isInteger(item.ums_assessment_id) || str(item.ums_assessment_id, 100))
      || !str(item.name, 300) || (item.examination != null && typeof item.examination !== 'string')) {
      throw bad('Each assessment needs ums_assessment_id, name and examination');
    }
    return { ums_assessment_id: item.ums_assessment_id, name: item.name, examination: item.examination ?? '' };
  });
  return {
    tenantId: body.tenant_id as string,
    externalStudentId: body.external_student_id as string,
    candidateId: body.candidate_id as string,
    name: body.name as string,
    email: (body.email ?? null) as string | null,
    category: (body.category ?? '') as string,
    subCategory: (body.sub_category ?? '') as string,
    status: body.status as string,
    // Inactive candidates keep no assignments regardless of what was sent.
    assignedAssessments: body.status === 'active' ? assessments : [],
  };
};

export const upsertCandidate = async (db: any, data: ReturnType<typeof validateStudentPayload>, idempotencyKey?: string) => {
  const key = { tenantId_externalStudentId: { tenantId: data.tenantId, externalStudentId: data.externalStudentId } };
  const existing = await db.examPortalCandidate.findUnique({ where: key, select: { lastIdempotencyKey: true } });
  if (existing && idempotencyKey && existing.lastIdempotencyKey === idempotencyKey) return 'unchanged';
  const record = { ...data, lastIdempotencyKey: idempotencyKey ?? null };
  await db.examPortalCandidate.upsert({ where: key, create: record, update: record });
  return existing ? 'updated' : 'created';
};
