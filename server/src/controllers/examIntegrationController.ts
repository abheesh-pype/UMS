// @ts-nocheck
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const encryptionKey = () => {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret || secret === 'secret' || secret.length < 32) {
    const error = new Error('Configure an INTEGRATION_ENCRYPTION_KEY of at least 32 characters before saving exam portal credentials');
    (error as any).statusCode = 503;
    throw error;
  }
  return createHash('sha256').update(secret).digest();
};

const encryptApiKey = (apiKey: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.');
};

const decryptApiKey = (encryptedValue: string) => {
  const [iv, tag, encrypted] = encryptedValue.split('.').map(part => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !encrypted) throw new Error('Stored exam portal credential is invalid');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};

const parseHttpUrl = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !value.trim()) {
    const error = new Error(`${label} is required`);
    (error as any).statusCode = 400;
    throw error;
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    const error = new Error(`${label} must be a valid URL`);
    (error as any).statusCode = 400;
    throw error;
  }
  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(localHost && url.protocol === 'http:')) || url.username || url.password || url.hash) {
    const error = new Error(`${label} must use HTTPS and cannot include credentials or a fragment`);
    (error as any).statusCode = 400;
    throw error;
  }
  return url.toString();
};

const getAuthorizedUniversity = async (req: AuthRequest, res: Response) => {
  const university = await prisma.university.findFirst({
    where: { id: req.params.universityId, organizationId: req.user.organizationId },
    select: { id: true, organizationId: true },
  });
  if (!university || (req.user.role === 'university_admin' && req.user.universityId !== university.id)) {
    res.status(404).json({ success: false, message: 'University not found' });
    return null;
  }
  return university;
};

export const getExamPortalIntegration = asyncHandler(async (req: AuthRequest, res: Response) => {
  const university = await getAuthorizedUniversity(req, res);
  if (!university) return;

  const integration = await prisma.universityExamIntegration.findUnique({
    where: { universityId: university.id },
    select: { endpoint: true, encryptedApiKey: true },
  });
  res.json({
    success: true,
    data: integration
      ? { endpoint: integration.endpoint, hasApiKey: Boolean(integration.encryptedApiKey) }
      : { endpoint: '', hasApiKey: false },
  });
});

export const saveExamPortalIntegration = asyncHandler(async (req: AuthRequest, res: Response) => {
  const university = await getAuthorizedUniversity(req, res);
  if (!university) return;

  const endpoint = parseHttpUrl(req.body.endpoint, 'Endpoint');
  const apiKey = typeof req.body.apiKey === 'string' ? req.body.apiKey.trim() : '';
  const current = await prisma.universityExamIntegration.findUnique({
    where: { universityId: university.id },
    select: { encryptedApiKey: true },
  });
  if (!apiKey && !current?.encryptedApiKey) {
    res.status(400).json({ success: false, message: 'API key is required for the initial setup' });
    return;
  }

  const data = {
    endpoint,
    encryptedApiKey: apiKey ? encryptApiKey(apiKey) : current.encryptedApiKey,
  };
  await prisma.universityExamIntegration.upsert({
    where: { universityId: university.id },
    create: { ...data, organizationId: university.organizationId, universityId: university.id },
    update: data,
  });
  res.json({ success: true, data: { endpoint, hasApiKey: true } });
});

const isExamLaunchReady = (examination: any, now: Date) => {
  const schedule = Array.isArray(examination.schedule) ? examination.schedule : [];
  if (schedule.length > 0) {
    return schedule.some((item: any) => {
      if (!item?.date) return false;
      const day = String(item.date).slice(0, 10);
      const start = item.startTime ? new Date(`${day}T${item.startTime}:00`) : new Date(`${day}T00:00:00`);
      const end = item.endTime ? new Date(`${day}T${item.endTime}:00`) : new Date(`${day}T23:59:59.999`);
      return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && now >= start && now <= end;
    });
  }

  const startDay = new Date(examination.startDate);
  const endDay = new Date(examination.endDate);
  startDay.setUTCHours(0, 0, 0, 0);
  endDay.setUTCHours(23, 59, 59, 999);
  return now >= startDay && now <= endDay;
};

const getActiveStudent = async (req: AuthRequest) => prisma.student.findFirst({
  where: { organizationId: req.user.organizationId, email: req.user.email, status: 'active' },
  select: { id: true, programId: true, sessionId: true, name: true, email: true, enrollmentNo: true },
});

export const getStudentExaminations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const student = await getActiveStudent(req);
  if (!student?.sessionId) {
    res.status(404).json({ success: false, message: 'Active student session not found' });
    return;
  }

  const examinations = await prisma.examination.findMany({
    where: {
      organizationId: req.user.organizationId,
      programId: student.programId,
      academicSessionId: student.sessionId,
    },
    include: { academicSession: true, program: true, semester: true },
    orderBy: { startDate: 'asc' },
  });
  const registrations = await prisma.examinationRegistration.findMany({
    where: { studentId: student.id, examinationId: { in: examinations.map(examination => examination.id) } },
    select: { examinationId: true },
  });
  const registeredIds = new Set(registrations.map(registration => registration.examinationId));
  const now = new Date();

  res.json({
    success: true,
    data: examinations.map(examination => ({
      ...examination,
      registered: registeredIds.has(examination.id),
      readyToLaunch: registeredIds.has(examination.id) && isExamLaunchReady(examination, now),
    })),
  });
});

export const launchStudentExam = asyncHandler(async (req: AuthRequest, res: Response) => {
  const student = await getActiveStudent(req);
  if (!student?.sessionId) {
    res.status(404).json({ success: false, message: 'Active student session not found' });
    return;
  }
  const examination = await prisma.examination.findFirst({
    where: {
      id: req.params.examinationId,
      organizationId: req.user.organizationId,
      programId: student.programId,
      academicSessionId: student.sessionId,
    },
    include: { academicSession: true, program: { include: { university: true } }, semester: true },
  });
  if (!examination) {
    res.status(404).json({ success: false, message: 'Examination not found for your active session' });
    return;
  }
  const registration = await prisma.examinationRegistration.findUnique({
    where: { examinationId_studentId: { examinationId: examination.id, studentId: student.id } },
  });
  if (!registration) {
    res.status(403).json({ success: false, message: 'Register for this examination before launching it' });
    return;
  }
  if (!isExamLaunchReady(examination, new Date())) {
    res.status(403).json({ success: false, message: 'This examination is not currently open for writing' });
    return;
  }

  const integration = await prisma.universityExamIntegration.findUnique({
    where: {
      universityId: examination.program.universityId,
      organizationId: req.user.organizationId,
    },
  });
  if (!integration) {
    res.status(503).json({ success: false, message: 'The university has not configured an examination portal' });
    return;
  }

  let apiKey: string;
  try {
    apiKey = decryptApiKey(integration.encryptedApiKey);
  } catch {
    res.status(503).json({ success: false, message: 'Exam portal credentials could not be decrypted. Check the encryption key or save the API key again.' });
    return;
  }

  let response: globalThis.Response;
  try {
    response = await fetch(integration.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        event: 'exam_launch',
        student: {
          id: student.id,
          name: student.name,
          email: student.email,
          enrollmentNo: student.enrollmentNo,
        },
        examination: {
          id: examination.id,
          name: examination.examinationName,
          type: examination.examinationType,
          session: examination.academicSession.name,
          program: examination.program.name,
          semester: examination.semester.semesterName,
          startDate: examination.startDate,
          endDate: examination.endDate,
        },
        registration: { id: registration.id, confirmedAt: registration.confirmedAt },
      }),
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    });
  } catch {
    res.status(502).json({ success: false, message: 'Could not connect to the configured examination portal' });
    return;
  }
  if (!response.ok) {
    res.status(502).json({ success: false, message: 'The configured examination portal rejected the launch request' });
    return;
  }

  let payload: any;
  try {
    payload = await response.json();
  } catch {
    res.status(502).json({ success: false, message: 'The examination portal returned an invalid response' });
    return;
  }
  let launchUrl: string;
  try {
    launchUrl = parseHttpUrl(payload?.launchUrl, 'Returned launch URL');
  } catch {
    res.status(502).json({ success: false, message: 'The examination portal returned an invalid launch URL' });
    return;
  }
  res.json({ success: true, data: { launchUrl } });
});
