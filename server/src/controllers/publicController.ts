// @ts-nocheck
import { Response, Request } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getOnboardingStatusByCode } from '../services/onboardingStatusService.js';
import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { getSingleTenantContext } from '../utils/contextHelper.js';
import { getStudentPortalPassword } from '../utils/studentPortalAccess.js';
import { filterProgramsWithActiveSessions } from '../services/activeSessionPrograms.js';

export const validateInviteToken = asyncHandler(async (req: Request, res: Response) => {
  const invite = await prisma.studyCenterInvite.findUnique({ where: { token: req.params.token } });
  res.json({ success: true, data: invite });
});

export const publicRegister = asyncHandler(async (req: Request, res: Response) => {
  const { referredById, token, ...restBody } = req.body;
  let resolvedReferredBy = referredById || null;
  let resolvedOrgId = restBody.organizationId || null;

  if (token) {
    const invite = await prisma.studyCenterInvite.findUnique({ where: { token } });
    if (invite) {
      resolvedReferredBy = resolvedReferredBy || invite.createdBy;
      resolvedOrgId = resolvedOrgId || invite.organizationId;
    }
  }

  const pendingStatus = await getOnboardingStatusByCode('pending_verification');
  const center = await prisma.studyCenter.create({
    data: {
      ...restBody,
      organizationId: resolvedOrgId,
      onboardingStatusId: pendingStatus?.id || null,
      status: 'pending_verification' as any,
      referredBy: resolvedReferredBy || null,
      statusHistory: [
        {
          status: 'pending_verification',
          statusName: 'Pending Operations Verification',
          stage: 'operations',
          state: 'pending',
          actorName: 'Center Applicant',
          remarks: 'Registered via public invite link',
          timestamp: new Date().toISOString(),
        }
      ]
    }
  });
  res.status(201).json({ success: true, data: center });
});


export const getPaymentStatus = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'pending' as any } });
});

export const submitPaymentProof = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, message: 'Payment proof submitted' });
});

export const getPublicUniversities = asyncHandler(async (req: Request, res: Response) => {
  const universities = await prisma.university.findMany({
    where: { singletonKey: 'primary', status: 'active' as any },
  });
  res.json({ success: true, count: universities.length, data: universities });
});

export const getPublicPrograms = asyncHandler(async (req: Request, res: Response) => {
  const programs = await prisma.program.findMany({
    where: { status: 'active' as any, university: { singletonKey: 'primary' } },
    include: { university: true },
  });
  res.json({ success: true, count: programs.length, data: programs });
});

const parseJsonArray = (value: unknown) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const calculateEnrollmentFee = (feeStructure: any, paymentMethod: string) => {
  if (!feeStructure) return null;
  const semesterFee = Array.isArray(feeStructure.semesterFees)
    ? Number(feeStructure.semesterFees[0] ?? feeStructure.semesterFee) || 0
    : Number(feeStructure.semesterFee) || 0;
  const additionalFees = Array.isArray(feeStructure.additionalFees) ? feeStructure.additionalFees : [];
  const recurringFees = additionalFees.filter((fee: any) => fee.label !== 'GST');
  const additionalTotal = recurringFees.reduce((sum: number, fee: any) => sum + (Number(fee.amount) || 0), 0);
  let breakdown = Array.isArray(feeStructure.feeBreakdown) ? feeStructure.feeBreakdown : [];
  if (typeof feeStructure.feeBreakdown === 'string') breakdown = parseJsonArray(feeStructure.feeBreakdown);
  if (feeStructure.level === 'university') {
    const configuredCycleAmount = paymentMethod === 'yearly'
      ? Number(feeStructure.yearlyFee) || 0
      : paymentMethod === 'semester'
        ? semesterFee
        : 0;
    if (configuredCycleAmount > 0) return configuredCycleAmount;
    if (breakdown.length > 0) {
      if (paymentMethod === 'full_payment') {
        const fullFee = Number(feeStructure.fullProgramFee) || 0;
        return fullFee || breakdown.reduce((sum: number, item: any) => sum + (Number(item.universityFee) || 0), 0);
      }
      return Number(breakdown[0].universityFee) || 0;
    }
    return Number(feeStructure.universityFee) || 0;
  }
  const breakdownAdditional = (item: any) => {
    if (typeof item?.additionalFees !== 'string') return 0;
    return item.additionalFees.split(',').reduce((sum: number, entry: string) => {
      const amount = Number(entry.trim().split(':')[1]);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  };

  let subtotal = 0;
  const configuredCycleAmount = paymentMethod === 'yearly'
    ? Number(feeStructure.yearlyFee) || 0
    : paymentMethod === 'semester'
      ? semesterFee
      : 0;
  if (configuredCycleAmount > 0) {
    subtotal = configuredCycleAmount + additionalTotal;
  } else if (breakdown.length > 0 && paymentMethod === 'full_payment') {
    const fullProgramFee = Number(feeStructure.fullProgramFee) || 0;
    subtotal = fullProgramFee > 0
      ? fullProgramFee + additionalTotal
      : breakdown.reduce((sum: number, item: any) => sum + (Number(item.baseFee) || 0) + (Number(item.examFee) || 0) + breakdownAdditional(item), additionalTotal);
  } else if (breakdown.length > 0) {
    const first = breakdown[0];
    subtotal = (Number(first.baseFee) || 0) + (Number(first.examFee) || 0) + additionalTotal + breakdownAdditional(first);
  } else {
    subtotal = (Number(feeStructure.baseFee) || 0) + additionalTotal;
  }
  const gst = additionalFees.find((fee: any) => fee.label === 'GST');
  return subtotal + (gst ? Math.round((subtotal * (Number(gst.amount) || 0)) / 100) : 0);
};

const getPublicProgramAndSession = async (organizationId: string, programId: string, sessionId: string) => {
  const program = await prisma.program.findFirst({
    where: {
      id: programId,
      organizationId,
      status: 'active',
      isDeleted: false,
      university: { singletonKey: 'primary', status: 'active' },
    },
    include: {
      university: { select: { id: true, name: true, code: true, category: true, optionalFields: true } },
      programFeeStructure: {
        where: {
          organizationId,
          OR: [{ studyCenterId: null }, { level: 'university' }],
        },
      },
    },
  });
  if (!program) return { program: null, session: null };

  const session = await prisma.admissionSession.findFirst({
    where: {
      id: sessionId,
      organizationId,
      status: 'active',
      AND: [
        { OR: [{ programId }, { programId: null }] },
        { OR: [{ universityId: program.universityId }, { universityId: null }] },
      ],
    },
    select: { id: true, name: true, programId: true, universityId: true },
  });
  return { program, session };
};

const findFeeStructure = async (organizationId: string, programId: string, universityId: string, sessionId: string) => {
  const candidates = await prisma.programFeeStructure.findMany({
    where: {
      organizationId,
      OR: [
        { programId, studyCenterId: null },
        {
          universityId,
          level: 'university',
          OR: [{ programId }, { programId: null }],
        },
      ],
    },
  });
  return candidates.find((fee: any) => fee.level === 'program' && fee.programId === programId && fee.admissionSessionId === sessionId)
    || candidates.find((fee: any) => fee.level === 'program' && fee.programId === programId && !fee.admissionSessionId)
    || candidates.find((fee: any) => fee.level === 'program' && fee.programId === programId)
    || candidates.find((fee: any) => fee.level === 'university' && fee.programId === programId && fee.universityId === universityId && fee.admissionSessionId === sessionId)
    || candidates.find((fee: any) => fee.level === 'university' && fee.programId === programId && fee.universityId === universityId && !fee.admissionSessionId)
    || candidates.find((fee: any) => fee.level === 'university' && !fee.programId && fee.universityId === universityId && fee.admissionSessionId === sessionId)
    || candidates.find((fee: any) => fee.level === 'university' && !fee.programId && fee.universityId === universityId && !fee.admissionSessionId)
    || candidates.find((fee: any) => fee.level === 'university' && fee.universityId === universityId)
    || null;
};

export const getPublicStudentEnrollmentPrograms = asyncHandler(async (_req: Request, res: Response) => {
  const { organizationId } = await getSingleTenantContext();
  const programs = await prisma.program.findMany({
    where: {
      organizationId,
      status: 'active',
      isDeleted: false,
      university: { singletonKey: 'primary', status: 'active' },
    },
    include: {
      university: { select: { id: true, name: true, code: true, category: true, optionalFields: true } },
      programFeeStructure: {
        where: {
          organizationId,
          OR: [{ studyCenterId: null }, { level: 'university' }],
        },
      },
    },
    orderBy: { name: 'asc' },
  });
  const activeSessionPrograms = await filterProgramsWithActiveSessions(organizationId, programs);
  res.json({ success: true, data: activeSessionPrograms });
});

export const getPublicStudentEnrollmentSessions = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = await getSingleTenantContext();
  const programId = typeof req.query.programId === 'string' ? req.query.programId : '';
  const program = await prisma.program.findFirst({
    where: { id: programId, organizationId, status: 'active', isDeleted: false, university: { singletonKey: 'primary' } },
    select: { id: true, universityId: true },
  });
  if (!program) {
    res.status(404).json({ success: false, message: 'Active program not found' });
    return;
  }
  const sessions = await prisma.admissionSession.findMany({
    where: {
      organizationId,
      status: 'active',
      AND: [
        { OR: [{ programId: program.id }, { programId: null }] },
        { OR: [{ universityId: program.universityId }, { universityId: null }] },
      ],
    },
    select: { id: true, name: true, programId: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: sessions });
});

export const checkPublicStudentEnrollmentEmail = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = await getSingleTenantContext();
  const email = typeof req.body.studentEmail === 'string' ? req.body.studentEmail.trim().toLowerCase() : '';
  const programId = typeof req.body.programId === 'string' ? req.body.programId : '';
  const sessionId = typeof req.body.sessionId === 'string' ? req.body.sessionId : '';
  if (!email || !programId || !sessionId) {
    res.status(400).json({ success: false, isUnique: false, message: 'Email, program, and admission session are required' });
    return;
  }
  const { program, session } = await getPublicProgramAndSession(organizationId, programId, sessionId);
  if (!program || !session) {
    res.status(400).json({ success: false, isUnique: false, message: 'Selected program or admission session is invalid' });
    return;
  }
  const existing = await prisma.student.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } });
  const account = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } });
  const duplicateEnrollment = await prisma.enrollment.findFirst({
    where: { organizationId, studentEmail: email, programId, sessionId },
    select: { id: true },
  });
  const isUnique = !existing && !account && !duplicateEnrollment;
  res.json({
    success: true,
    isUnique,
    ...(!isUnique ? { message: 'This email already has an account or application. Contact admissions if you need help.' } : {}),
  });
});

export const uploadPublicEnrollmentFile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: 'No file uploaded' });
    return;
  }
  res.json({
    success: true,
    url: `/uploads/${req.file.filename}`,
    filename: req.file.originalname,
  });
});

export const createPublicStudentEnrollment = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = await getSingleTenantContext();
  const {
    studentName, studentEmail, studentPhone, studentAddress, programId, sessionId, documents, educationalDetails,
    specialisation, abcId, debId, dob, religion, caste, fatherName, motherName, parentMobile, studentPhoto,
    admissionDate, pincode, alternativePhone, maritalStatus, currentlyWorking, paymentMethod,
  } = req.body;
  const normalizedEmail = typeof studentEmail === 'string' ? studentEmail.trim().toLowerCase() : '';
  const studentNameValue = typeof studentName === 'string' ? studentName.trim() : '';
  const studentPhoneValue = typeof studentPhone === 'string' ? studentPhone.trim() : '';
  const studentAddressValue = typeof studentAddress === 'string' ? studentAddress.trim() : '';

  if (!studentNameValue || !normalizedEmail || !studentPhoneValue || !studentAddressValue || !programId || !sessionId || !dob) {
    res.status(400).json({ success: false, message: 'Name, email, phone, address, date of birth, program, and admission session are required' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    res.status(400).json({ success: false, message: 'Enter a valid email address' });
    return;
  }
  const dobPassword = getStudentPortalPassword(dob);
  if (!dobPassword) {
    res.status(400).json({ success: false, message: 'Date of birth must be a valid date in YYYY-MM-DD format' });
    return;
  }
  if (!abcId || !debId) {
    res.status(400).json({ success: false, message: 'ABCID and DEBID are required' });
    return;
  }
  if (!/^\d{12}$/.test(String(abcId)) || !/^\d{12}$/.test(String(debId))) {
    res.status(400).json({ success: false, message: 'ABCID and DEBID must each be exactly 12 digits' });
    return;
  }

  const { program, session } = await getPublicProgramAndSession(organizationId, programId, sessionId);
  if (!program || !session) {
    res.status(400).json({ success: false, message: 'Selected program or admission session is invalid' });
    return;
  }
  if (Array.isArray(program.specialisations) && program.specialisations.length > 0 && !program.specialisations.includes(specialisation)) {
    res.status(400).json({ success: false, message: 'Select a valid program specialisation' });
    return;
  }

  const parsedDocuments = parseJsonArray(documents)
    .filter((document: any) =>
      document
      && typeof document.name === 'string'
      && typeof document.url === 'string'
      && /^\/uploads\/[A-Za-z0-9._-]+$/.test(document.url)
      && document.reqName !== 'Student Payment Proof')
    .map((document: any) => ({
      name: document.name.trim().slice(0, 255),
      url: document.url,
      ...(typeof document.reqName === 'string' ? { reqName: document.reqName.trim().slice(0, 120) } : {}),
    }));
  const requiredDocuments = Array.isArray(program.certificateRequirements)
    ? (program.certificateRequirements as any[]).filter(requirement => requirement?.isMandatory && typeof requirement.name === 'string')
    : [];
  const missingDocument = requiredDocuments.find(requirement =>
    !parsedDocuments.some((document: any) => document.reqName === requirement.name));
  if (missingDocument) {
    res.status(400).json({ success: false, message: `Please upload mandatory document: ${missingDocument.name}` });
    return;
  }

  const [existingUser, existingStudent, duplicateEnrollment, feeStructure] = await Promise.all([
    prisma.user.findFirst({ where: { email: { equals: normalizedEmail, mode: 'insensitive' } }, select: { id: true } }),
    prisma.student.findFirst({ where: { email: { equals: normalizedEmail, mode: 'insensitive' } }, select: { id: true } }),
    prisma.enrollment.findFirst({
      where: { organizationId, studentEmail: normalizedEmail, programId, sessionId },
      select: { id: true },
    }),
    findFeeStructure(organizationId, programId, program.universityId, sessionId),
  ]);
  if (existingUser || existingStudent || duplicateEnrollment) {
    res.status(409).json({ success: false, message: 'This email already has an account or application. Contact admissions if you need help.' });
    return;
  }

  const token = randomBytes(32).toString('hex');
  const publicTrackingTokenHash = createHash('sha256').update(token).digest('hex');
  const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
  const fee = calculateEnrollmentFee(feeStructure, paymentMethod || 'installment');
  const now = new Date();
  const parsedEducation = parseJsonArray(educationalDetails);

  const enrollment = await prisma.$transaction(async tx => {
    await tx.user.create({
      data: {
        userId: normalizedEmail,
        email: normalizedEmail,
        password: passwordHash,
        name: studentNameValue,
        role: 'student',
        organizationId,
        status: 'inactive',
      },
      select: { id: true },
    });
    const student = await tx.student.create({
      data: {
        enrollmentNo: `ENR-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        name: studentNameValue,
        email: normalizedEmail,
        phone: studentPhoneValue,
        address: studentAddressValue,
        programId,
        sessionId,
        specialisation: specialisation || null,
        abcId: abcId || null,
        debId: debId || null,
        dob: dobPassword,
        religion: religion || null,
        caste: caste || null,
        fatherName: fatherName || null,
        motherName: motherName || null,
        parentMobile: parentMobile || null,
        studentPhoto: studentPhoto || null,
        pincode: pincode || null,
        alternativePhone: alternativePhone || null,
        maritalStatus: maritalStatus || null,
        currentlyWorking: currentlyWorking || null,
        status: 'pending',
        organizationId,
      },
      select: { id: true },
    });
    return tx.enrollment.create({
      data: {
        organizationId,
        studentId: student.id,
        programId,
        studyCenterId: null,
        sessionId,
        studentName: studentNameValue,
        studentEmail: normalizedEmail,
        studentPhone: studentPhoneValue,
        studentAddress: studentAddressValue,
        specialisation: specialisation || null,
        abcId: abcId || null,
        debId: debId || null,
        dob: dobPassword,
        religion: religion || null,
        caste: caste || null,
        fatherName: fatherName || null,
        motherName: motherName || null,
        parentMobile: parentMobile || null,
        studentPhoto: studentPhoto || null,
        pincode: pincode || null,
        alternativePhone: alternativePhone || null,
        maritalStatus: maritalStatus || null,
        currentlyWorking: currentlyWorking || null,
        admissionDate: admissionDate ? new Date(admissionDate) : now,
        documents: parsedDocuments,
        educationalDetails: parsedEducation,
        paymentMethod: paymentMethod || 'installment',
        totalFee: fee,
        publicTrackingTokenHash,
        status: 'pending_doc_review',
        statusHistory: [
          {
            status: 'pending_doc_review',
            actorId: 'student',
            actorName: studentNameValue,
            timestamp: now.toISOString(),
            note: 'Application submitted directly through the university website',
          },
        ],
      },
      select: { id: true, studentName: true, status: true },
    });
  });

  try {
    const opsUsers = await prisma.user.findMany({
      where: {
        organizationId,
        status: 'active',
        OR: [
          { role: { in: ['ops_admin', 'ops_sub_admin'] } },
          { role: 'employee', department: { type: 'operations' } },
        ],
      },
      select: { id: true },
    });
    if (opsUsers.length > 0) {
      await prisma.notification.createMany({
        data: opsUsers.map(user => ({
          organizationId,
          userId: user.id,
          title: 'New Direct Student Application',
          message: `${studentNameValue} submitted a direct application for ${program.name}; Operations review is required.`,
          type: 'general',
          priority: 'medium',
          link: 'enrollment_review',
        })),
      });
    }
  } catch (error) {
    console.error('Failed to notify Operations about a direct student application:', error);
  }

  res.status(201).json({ success: true, data: { trackingToken: token, enrollmentId: enrollment.id, status: enrollment.status } });
});

const resubmitPublicStudentApplication = async (req: Request, res: Response, enrollment: any) => {
  if (!['department_rejected', 'ops_rejected'].includes(enrollment.status)) {
    res.status(409).json({ success: false, message: 'Only applications rejected by Operations can be updated and resubmitted' });
    return;
  }

  const {
    studentName, studentPhone, studentAddress, programId, sessionId, documents, educationalDetails,
    specialisation, abcId, debId, religion, caste, fatherName, motherName, parentMobile, studentPhoto,
    admissionDate, pincode, alternativePhone, maritalStatus, currentlyWorking, paymentMethod,
  } = req.body;
  const studentNameValue = typeof studentName === 'string' ? studentName.trim() : '';
  const studentPhoneValue = typeof studentPhone === 'string' ? studentPhone.trim() : '';
  const studentAddressValue = typeof studentAddress === 'string' ? studentAddress.trim() : '';
  if (!studentNameValue || !studentPhoneValue || !studentAddressValue || !programId || !sessionId) {
    res.status(400).json({ success: false, message: 'Name, phone, address, program, and admission session are required' });
    return;
  }
  if (!abcId || !debId) {
    res.status(400).json({ success: false, message: 'ABCID and DEBID are required' });
    return;
  }
  if (!/^\d{12}$/.test(String(abcId)) || !/^\d{12}$/.test(String(debId))) {
    res.status(400).json({ success: false, message: 'ABCID and DEBID must each be exactly 12 digits' });
    return;
  }
  const { program, session } = await getPublicProgramAndSession(enrollment.organizationId, programId, sessionId);
  if (!program || !session) {
    res.status(400).json({ success: false, message: 'Selected program or admission session is invalid' });
    return;
  }
  if (Array.isArray(program.specialisations) && program.specialisations.length > 0 && !program.specialisations.includes(specialisation)) {
    res.status(400).json({ success: false, message: 'Select a valid program specialisation' });
    return;
  }

  const parsedDocuments = parseJsonArray(documents)
    .filter((document: any) =>
      document
      && typeof document.name === 'string'
      && typeof document.url === 'string'
      && /^\/uploads\/[A-Za-z0-9._-]+$/.test(document.url)
      && document.reqName !== 'Student Payment Proof')
    .map((document: any) => ({
      name: document.name.trim().slice(0, 255),
      url: document.url,
      ...(typeof document.reqName === 'string' ? { reqName: document.reqName.trim().slice(0, 120) } : {}),
    }));
  const requiredDocuments = Array.isArray(program.certificateRequirements)
    ? (program.certificateRequirements as any[]).filter(requirement => requirement?.isMandatory && typeof requirement.name === 'string')
    : [];
  const missingDocument = requiredDocuments.find(requirement =>
    !parsedDocuments.some((document: any) => document.reqName === requirement.name));
  if (missingDocument) {
    res.status(400).json({ success: false, message: `Please upload mandatory document: ${missingDocument.name}` });
    return;
  }

  const now = new Date();
  const statusHistory = parseJsonArray(enrollment.statusHistory);
  statusHistory.push({
    status: 'pending_doc_review',
    actorId: 'student',
    actorName: studentNameValue,
    timestamp: now.toISOString(),
    note: 'Application updated and resubmitted for Operations review',
  });
  const preservedPaymentProof = parseJsonArray(enrollment.documents).filter((document: any) => document?.reqName === 'Student Payment Proof');
  const feeStructure = await findFeeStructure(enrollment.organizationId, programId, program.universityId, sessionId);
  const fee = calculateEnrollmentFee(feeStructure, paymentMethod || 'installment');
  const dobPassword = getStudentPortalPassword(enrollment.dob);

  await prisma.$transaction(async tx => {
    await tx.student.update({
      where: { id: enrollment.studentId },
      data: {
        name: studentNameValue,
        phone: studentPhoneValue,
        address: studentAddressValue,
        programId,
        sessionId,
        specialisation: specialisation || null,
        abcId: abcId || null,
        debId: debId || null,
        religion: religion || null,
        caste: caste || null,
        fatherName: fatherName || null,
        motherName: motherName || null,
        parentMobile: parentMobile || null,
        studentPhoto: studentPhoto || null,
        pincode: pincode || null,
        alternativePhone: alternativePhone || null,
        maritalStatus: maritalStatus || null,
        currentlyWorking: currentlyWorking || null,
      },
    });
    await tx.enrollment.update({
      where: { id: enrollment.id },
      data: {
        studentName: studentNameValue,
        studentPhone: studentPhoneValue,
        studentAddress: studentAddressValue,
        programId,
        sessionId,
        specialisation: specialisation || null,
        abcId: abcId || null,
        debId: debId || null,
        dob: dobPassword,
        religion: religion || null,
        caste: caste || null,
        fatherName: fatherName || null,
        motherName: motherName || null,
        parentMobile: parentMobile || null,
        studentPhoto: studentPhoto || null,
        admissionDate: admissionDate ? new Date(admissionDate) : enrollment.admissionDate,
        pincode: pincode || null,
        alternativePhone: alternativePhone || null,
        maritalStatus: maritalStatus || null,
        currentlyWorking: currentlyWorking || null,
        documents: [...parsedDocuments, ...preservedPaymentProof],
        educationalDetails: parseJsonArray(educationalDetails),
        paymentMethod: paymentMethod || 'installment',
        totalFee: fee,
        status: 'pending_doc_review',
        departmentRemarks: null,
        departmentReviewedBy: null,
        departmentReviewedAt: null,
        assignedOpsUserId: null,
        statusHistory,
      },
    });
  });

  try {
    const opsUsers = await prisma.user.findMany({
      where: {
        organizationId: enrollment.organizationId,
        status: 'active',
        OR: [
          { role: { in: ['ops_admin', 'ops_sub_admin'] } },
          { role: 'employee', department: { type: 'operations' } },
        ],
      },
      select: { id: true },
    });
    if (opsUsers.length > 0) {
      await prisma.notification.createMany({
        data: opsUsers.map(user => ({
          organizationId: enrollment.organizationId,
          userId: user.id,
          title: 'Updated Direct Student Application',
          message: `${studentNameValue} updated and resubmitted an application for ${program.name}; Operations review is required.`,
          type: 'general',
          priority: 'medium',
          link: 'enrollment_review',
        })),
      });
    }
  } catch (error) {
    console.error('Failed to notify Operations about a resubmitted student application:', error);
  }

  res.json({ success: true, message: 'Application updated and resubmitted for Operations review' });
};

export const resubmitPublicStudentApplicationByToken = asyncHandler(async (req: Request, res: Response) => {
  const enrollment = await getTrackingEnrollment(req.params.token);
  if (!enrollment) {
    res.status(404).json({ success: false, message: 'Student application status link is invalid' });
    return;
  }
  await resubmitPublicStudentApplication(req, res, enrollment);
});

export const resubmitPublicStudentApplicationByCredentials = asyncHandler(async (req: Request, res: Response) => {
  const enrollment = await getCredentialEnrollment(req.body.email, req.body.password);
  if (!enrollment) {
    res.status(401).json({ success: false, message: 'Application not found. Check your email and date of birth.' });
    return;
  }
  await resubmitPublicStudentApplication(req, res, enrollment);
});

const getTrackingEnrollment = async (token: string) => {
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  const publicTrackingTokenHash = createHash('sha256').update(token).digest('hex');
  return prisma.enrollment.findUnique({
    where: { publicTrackingTokenHash },
    include: {
      program: { select: { id: true, name: true, code: true, universityId: true } },
      session: { select: { id: true, name: true } },
    },
  });
};

const getCredentialEnrollment = async (email: unknown, password: unknown) => {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const dobPassword = getStudentPortalPassword(password);
  if (!normalizedEmail || !dobPassword) return null;

  return prisma.enrollment.findFirst({
    where: {
      publicTrackingTokenHash: { not: null },
      studentEmail: { equals: normalizedEmail, mode: 'insensitive' },
      dob: dobPassword,
    },
    include: {
      program: { select: { id: true, name: true, code: true, universityId: true } },
      session: { select: { id: true, name: true } },
    },
  });
};

const isPaymentProofSubmitted = (documents: unknown) =>
  parseJsonArray(documents).some((document: any) => document?.reqName === 'Student Payment Proof');

const sendPublicStudentApplicationStatus = (enrollment: any, res: Response) => {
  const canSubmitPayment = ['pending_finance_review', 'finance_review', 'pending_payment'].includes(enrollment.status)
    && Number(enrollment.totalFee) > 0;
  const history = parseJsonArray(enrollment.statusHistory).map((item: any) => ({
    status: item.status,
    timestamp: item.timestamp,
    note: item.note,
  }));
  res.json({
    success: true,
    data: {
      studentName: enrollment.studentName,
      studentEmail: enrollment.studentEmail,
      program: enrollment.program,
      session: enrollment.session,
      status: enrollment.status,
      departmentRemarks: enrollment.departmentRemarks,
      financeRemarks: enrollment.financeRemarks,
      statusHistory: history,
      paymentAmount: enrollment.totalFee,
      canSubmitPayment,
      paymentProofSubmitted: isPaymentProofSubmitted(enrollment.documents),
      canUpdateAndResubmit: ['department_rejected', 'ops_rejected'].includes(enrollment.status)
        && Boolean(enrollment.publicTrackingTokenHash),
      applicationForm: {
        studentName: enrollment.studentName,
        studentEmail: enrollment.studentEmail,
        studentPhone: enrollment.studentPhone,
        studentAddress: enrollment.studentAddress,
        programId: enrollment.programId,
        sessionId: enrollment.sessionId,
        specialisation: enrollment.specialisation || '',
        abcId: enrollment.abcId || '',
        debId: enrollment.debId || '',
        dob: getStudentPortalPassword(enrollment.dob) || '',
        religion: enrollment.religion || '',
        caste: enrollment.caste || '',
        fatherName: enrollment.fatherName || '',
        motherName: enrollment.motherName || '',
        parentMobile: enrollment.parentMobile || '',
        studentPhoto: enrollment.studentPhoto || '',
        admissionDate: enrollment.admissionDate?.toISOString?.().slice(0, 10) || '',
        pincode: enrollment.pincode || '',
        alternativePhone: enrollment.alternativePhone || '',
        maritalStatus: enrollment.maritalStatus || '',
        currentlyWorking: enrollment.currentlyWorking || '',
        paymentMethod: enrollment.paymentMethod || 'installment',
        documents: parseJsonArray(enrollment.documents).filter((document: any) => document?.reqName !== 'Student Payment Proof'),
        educationalDetails: parseJsonArray(enrollment.educationalDetails),
      },
    },
  });
};

export const getPublicStudentApplicationStatusByCredentials = asyncHandler(async (req: Request, res: Response) => {
  const enrollment = await getCredentialEnrollment(req.body.email, req.body.password);
  if (!enrollment) {
    res.status(401).json({ success: false, message: 'Application not found. Check your email and date of birth.' });
    return;
  }
  sendPublicStudentApplicationStatus(enrollment, res);
});

export const getPublicStudentApplicationStatus = asyncHandler(async (req: Request, res: Response) => {
  const enrollment = await getTrackingEnrollment(req.params.token);
  if (!enrollment) {
    res.status(404).json({ success: false, message: 'Student application status link is invalid' });
    return;
  }
  sendPublicStudentApplicationStatus(enrollment, res);
});

const savePublicStudentPaymentProof = async (enrollment: any, req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: 'Payment proof file is required' });
    return;
  }
  if (!['pending_finance_review', 'finance_review', 'pending_payment'].includes(enrollment.status) || Number(enrollment.totalFee) <= 0) {
    res.status(409).json({ success: false, message: 'Payment proof cannot be submitted at this application stage' });
    return;
  }
  const documents = parseJsonArray(enrollment.documents).filter((document: any) => document?.reqName !== 'Student Payment Proof');
  documents.push({
    name: req.file.originalname,
    reqName: 'Student Payment Proof',
    url: `/uploads/${req.file.filename}`,
    uploadedAt: new Date().toISOString(),
    remarks: typeof req.body.remarks === 'string' ? req.body.remarks.trim().slice(0, 500) : '',
  });
  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: { documents },
  });
  res.json({ success: true, message: 'Payment proof submitted for Finance verification' });
};

export const submitPublicStudentPaymentProof = asyncHandler(async (req: Request, res: Response) => {
  const enrollment = await getTrackingEnrollment(req.params.token);
  if (!enrollment) {
    res.status(404).json({ success: false, message: 'Student application status link is invalid' });
    return;
  }
  await savePublicStudentPaymentProof(enrollment, req, res);
});

export const submitPublicStudentPaymentProofByCredentials = asyncHandler(async (req: Request, res: Response) => {
  const enrollment = await getCredentialEnrollment(req.body.email, req.body.password);
  if (!enrollment) {
    res.status(401).json({ success: false, message: 'Application not found. Check your email and date of birth.' });
    return;
  }
  await savePublicStudentPaymentProof(enrollment, req, res);
});
