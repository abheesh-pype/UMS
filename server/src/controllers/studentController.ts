// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import bcrypt from 'bcryptjs';
import { createNotification, broadcastNotification } from './notificationController.js';
import { activateStudentPortalAccount, getStudentPortalPassword } from '../utils/studentPortalAccess.js';

export const getStudents = asyncHandler(async (req: AuthRequest, res: Response) => {
  const where: any = { organizationId: req.user.organizationId };
  const andConditions: any[] = [];

  if (req.user.role === 'student') {
    where.email = req.user.email;
  } else if (req.user.role === 'center_admin') {
    const cid = req.user.studyCenterId || '';
    andConditions.push({
      OR: [
        { centerId: cid },
        { enrollments: { some: { studyCenterId: cid } } }
      ]
    });
  }
  
  if (req.query.status) {
    where.status = req.query.status as string;
  }
  if (req.query.enrollmentStatus) {
    where.enrollments = {
      some: {
        ...(where.enrollments?.some || {}),
        status: req.query.enrollmentStatus as string,
      },
    };
  }
  if (req.query.centerId && req.user.role !== 'center_admin') {
    const cid = req.query.centerId as string;
    if (cid === 'direct' || cid === 'none') {
      andConditions.push({ centerId: null });
    } else {
      andConditions.push({
        OR: [
          { centerId: cid },
          { enrollments: { some: { studyCenterId: cid } } }
        ]
      });
    }
  }
  if (req.query.universityId) {
    where.program = { ...where.program, universityId: req.query.universityId as string };
  }
  if (req.query.programId) {
    where.programId = req.query.programId as string;
  }
  if (req.query.sessionId) {
    where.enrollments = {
      some: {
        ...(where.enrollments?.some || {}),
        sessionId: req.query.sessionId as string,
      },
    };
  }
  if (req.query.search) {
    const search = req.query.search as string;
    andConditions.push({
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { enrollmentNo: { contains: search, mode: 'insensitive' } }
      ]
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const students = await prisma.student.findMany({
    where,
    include: { 
      enrollments: { include: { session: true } },
      center: true,
      program: {
        include: {
          university: true,
          academicSession: true,
          semesterRecords: { orderBy: { semesterNumber: 'asc' } },
          modules: {
            include: { academicSession: true, semester: true },
            orderBy: { moduleName: 'asc' },
          },
        },
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Map center/program to centerId/programId for frontend object checks compatibility
  const mappedStudents = students.map((s) => ({
    ...s,
    centerId: s.center,
    programId: s.program,
    activeSession: s.enrollments.find((enrollment) => enrollment.sessionId === s.sessionId)?.session
      || s.enrollments.find((enrollment) => enrollment.status === 'enrolled')?.session
      || null,
  }));

  res.status(200).json({ success: true, count: mappedStudents.length, data: mappedStudents });
});

export const getStudent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const student = await prisma.student.findUnique({
    where: { id: req.params.id },
    include: { 
      enrollments: { include: { session: true } },
      center: true,
      program: true
    }
  });
  if (!student) {
    res.status(404).json({ success: false, message: 'Student not found' });
    return;
  }

  const mappedStudent = {
    ...student,
    centerId: student.center,
    programId: student.program,
    activeSession: student.enrollments.find((enrollment) => enrollment.sessionId === student.sessionId)?.session
      || student.enrollments.find((enrollment) => enrollment.status === 'enrolled')?.session
      || null,
  };

  res.status(200).json({ success: true, data: mappedStudent });
});

export const getStudentResults = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (req.user.role !== 'student') {
    res.status(403).json({ success: false, message: 'Student access required' });
    return;
  }

  const student = await prisma.student.findFirst({
    where: { organizationId: req.user.organizationId, email: req.user.email },
    select: { id: true },
  });
  if (!student) {
    res.status(404).json({ success: false, message: 'Student record not found' });
    return;
  }

  const marks = await prisma.internalMark.findMany({
    where: {
      organizationId: req.user.organizationId,
      studentId: student.id,
      status: 'published',
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      subject: true,
      marks: true,
      maxMarks: true,
      updatedAt: true,
    },
  });

  res.json({
    results: marks.map(mark => ({
      assessment_id: mark.id,
      assessment_name: mark.subject,
      examination: '',
      obtained_mark: mark.marks,
      total_mark: mark.maxMarks,
      pass_mark: null,
      passed: null,
      evaluated_at: mark.updatedAt,
    })),
  });
});

export const getStudentDocuments = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (req.user.role !== 'student') {
    res.status(403).json({ success: false, message: 'Student access required' });
    return;
  }

  const student = await prisma.student.findFirst({
    where: {
      organizationId: req.user.organizationId,
      email: { equals: req.user.email, mode: 'insensitive' },
    },
    select: { id: true },
  });

  const enrollments = await prisma.enrollment.findMany({
    where: {
      organizationId: req.user.organizationId,
      OR: [
        { studentEmail: { equals: req.user.email, mode: 'insensitive' } },
        ...(student ? [{ studentId: student.id }] : []),
      ],
    },
    select: {
      id: true,
      studentName: true,
      program: { select: { name: true } },
      session: { select: { name: true } },
      documents: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const documents = enrollments.flatMap(enrollment => {
    const uploadedDocuments = Array.isArray(enrollment.documents) ? enrollment.documents : [];
    return uploadedDocuments.flatMap((document: any, index: number) => {
      if (!document || typeof document !== 'object') return [];
      const url = typeof document.url === 'string' ? document.url : document.fileUrl;
      if (typeof url !== 'string' || !url) return [];
      return [{
        id: `${enrollment.id}-${index}`,
        name: document.name || document.fileName || document.reqName || 'Enrollment document',
        requirement: document.reqName || null,
        url,
        program: enrollment.program?.name || '',
        session: enrollment.session?.name || '',
      }];
    });
  });

  res.json({ success: true, count: documents.length, data: documents });
});

export const getStudentExamination = asyncHandler(async (req: AuthRequest, res: Response) => {
  const student = await prisma.student.findFirst({
    where: { organizationId: req.user.organizationId, email: req.user.email, status: 'active' },
    select: { id: true, programId: true, sessionId: true },
  });
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
    include: { academicSession: true, program: true, semester: true },
  });
  if (!examination) {
    res.status(404).json({ success: false, message: 'Examination not found for your active session' });
    return;
  }
  const registration = await prisma.examinationRegistration.findUnique({
    where: { examinationId_studentId: { examinationId: examination.id, studentId: student.id } },
    select: { id: true },
  });
  const moduleIds = Array.isArray(examination.moduleIds)
    ? examination.moduleIds.filter((moduleId): moduleId is string => typeof moduleId === 'string')
    : [];
  const modules = moduleIds.length > 0
    ? await prisma.module.findMany({
        where: { id: { in: moduleIds }, programId: student.programId },
        select: { id: true, moduleCode: true, moduleName: true, moduleType: true },
      })
    : [];
  res.json({ success: true, data: { ...examination, modules, registered: Boolean(registration) } });
});

export const registerForExamination = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { fullName, enrollmentNo, email, phone, confirmed } = req.body;
  if (!fullName?.trim() || !enrollmentNo?.trim() || !email?.trim() || !phone?.trim() || confirmed !== true) {
    res.status(400).json({ success: false, message: 'All registration fields and confirmation are required' });
    return;
  }

  const student = await prisma.student.findFirst({
    where: { organizationId: req.user.organizationId, email: req.user.email, status: 'active' },
    select: { id: true, programId: true, sessionId: true },
  });
  if (!student?.sessionId) { res.status(404).json({ success: false, message: 'Active student session not found' }); return; }

  const examination = await prisma.examination.findFirst({
    where: { id: req.params.examinationId, organizationId: req.user.organizationId, programId: student.programId, academicSessionId: student.sessionId },
    select: { id: true },
  });
  if (!examination) { res.status(404).json({ success: false, message: 'Examination not found for your active session' }); return; }

  const registration = await prisma.examinationRegistration.upsert({
    where: { examinationId_studentId: { examinationId: examination.id, studentId: student.id } },
    update: { fullName: fullName.trim(), enrollmentNo: enrollmentNo.trim(), email: email.trim(), phone: phone.trim(), confirmedAt: new Date() },
    create: { organizationId: req.user.organizationId, examinationId: examination.id, studentId: student.id, userId: req.user.id, fullName: fullName.trim(), enrollmentNo: enrollmentNo.trim(), email: email.trim(), phone: phone.trim() },
  });
  res.status(201).json({ success: true, data: registration });
});

export const createStudent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { firstName, lastName, name, enrollmentNo, centerId, email, programId, sessionId } = req.body;
  const finalName = name || `${firstName || ''} ${lastName || ''}`.trim() || 'Unknown Student';
  const finalEnrollmentNo = enrollmentNo || `ENR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  let finalCenterId = req.user.role === 'center_admin'
    ? req.user.studyCenterId
    : ((centerId && centerId !== 'null' && centerId !== 'none') ? centerId : null);

  if (req.user.role === 'center_admin' && !finalCenterId) {
    res.status(400).json({ success: false, message: 'No study center assigned to your account' });
    return;
  }

  if (!email) {
    res.status(400).json({ success: false, message: 'Email is required' });
    return;
  }

  // Check if Student already exists
  const existingStudent = await prisma.student.findUnique({ where: { email } });
  if (existingStudent) {
    res.status(400).json({ success: false, message: 'A student with this email already exists' });
    return;
  }

  if (!programId || !sessionId) {
    res.status(400).json({ success: false, message: 'An active program and admission session are required' });
    return;
  }

  const program = await prisma.program.findFirst({
    where: {
      id: programId,
      organizationId: req.user.organizationId,
      status: 'active',
      isDeleted: false,
      ...(req.user.role === 'center_admin' ? {
        programAllocations: {
          some: {
            organizationId: req.user.organizationId,
            centerId: finalCenterId || '__unassigned_center__',
            isActive: true,
          },
        },
      } : {}),
    },
    select: { id: true, universityId: true },
  });
  if (!program) {
    res.status(400).json({ success: false, message: 'Select an active program available to your account' });
    return;
  }

  const activeSession = await prisma.admissionSession.findFirst({
    where: {
      id: sessionId,
      organizationId: req.user.organizationId,
      status: 'active',
      AND: [
        { OR: [{ programId: program.id }, { programId: null }] },
        { OR: [{ universityId: program.universityId }, { universityId: null }] },
      ],
    },
    select: { id: true },
  });
  if (!activeSession) {
    res.status(400).json({ success: false, message: 'Select an active admission session for the program' });
    return;
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const rawPassword = 'password123';
    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const userId = `STD-${Date.now()}`;
    user = await prisma.user.create({
      data: {
        userId,
        email,
        password: hashedPassword,
        name: finalName,
        role: 'student',
        organizationId: req.user.organizationId,
        status: 'inactive'
      }
    });
  }

  const allowedFields = ['dob', 'joinDate', 'enrolledAt', 'reregStatus', 'referredBy', 'phone', 'address'];
  const dbData: any = {
    name: finalName,
    enrollmentNo: finalEnrollmentNo,
    status: 'pending',
    organization: { connect: { id: req.user.organizationId } },
    center: finalCenterId ? { connect: { id: finalCenterId } } : undefined,
    user: { connect: { email: email } }
  };

  dbData.program = { connect: { id: program.id } };

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) dbData[field] = req.body[field];
  }
  dbData.sessionId = activeSession.id;

  const student = await prisma.student.create({
    data: dbData
  });
  res.status(201).json({ success: true, data: { ...student, _id: student.id } });
});

export const updateStudent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const studentExists = await prisma.student.findUnique({ where: { id: req.params.id } });
  if (!studentExists) {
    res.status(404).json({ success: false, message: 'Student not found' });
    return;
  }

  if (req.body.status === 'active') {
    const password = getStudentPortalPassword(req.body.dob ?? studentExists.dob);
    if (!password) {
      res.status(400).json({
        success: false,
        message: 'A valid date of birth in YYYY-MM-DD format is required before activating the student',
      });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const student = await prisma.$transaction(async (tx) => {
      const updatedStudent = await tx.student.update({
        where: { id: req.params.id },
        data: { ...req.body, dob: password },
      });
      await activateStudentPortalAccount(tx, {
        email: updatedStudent.email,
        name: updatedStudent.name,
        organizationId: updatedStudent.organizationId,
      }, passwordHash);
      return updatedStudent;
    });
    res.status(200).json({ success: true, data: student });
    return;
  }

  const student = await prisma.student.update({
    where: { id: req.params.id },
    data: req.body
  });

  if (req.body.uniEnrollmentNumber !== undefined) {
    await prisma.enrollment.updateMany({
      where: { studentId: req.params.id },
      data: { uniEnrollmentNumber: req.body.uniEnrollmentNumber }
    });
  }

  res.status(200).json({ success: true, data: student });
});

export const deleteStudent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const studentExists = await prisma.student.findUnique({ where: { id: req.params.id } });
  if (!studentExists) {
    res.status(404).json({ success: false, message: 'Student not found' });
    return;
  }
  await prisma.student.delete({ where: { id: req.params.id } });
  res.status(200).json({ success: true, data: {} });
});

export const approveStudent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const studentExists = await prisma.student.findUnique({ where: { id: req.params.id } });
  if (!studentExists) {
    res.status(404).json({ success: false, message: 'Student not found' });
    return;
  }
  const password = getStudentPortalPassword(studentExists.dob);
  if (!password) {
    res.status(400).json({
      success: false,
      message: 'A valid date of birth in YYYY-MM-DD format is required before activating the student',
    });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const student = await prisma.$transaction(async (tx) => {
    const activatedStudent = await tx.student.update({
      where: { id: req.params.id },
      data: { status: 'active' as any, dob: password },
    });
    await activateStudentPortalAccount(tx, {
      email: activatedStudent.email,
      name: activatedStudent.name,
      organizationId: activatedStudent.organizationId,
    }, passwordHash);
    return activatedStudent;
  });
  res.status(200).json({ success: true, data: student });
});

export const bulkImportStudents = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ success: true, message: 'Bulk import logic not implemented' });
});

export const getInternalMarks = asyncHandler(async (req: AuthRequest, res: Response) => {
  const marks = await prisma.internalMark.findMany({
    where: { organizationId: req.user.organizationId },
    include: { student: { select: { name: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.status(200).json({ success: true, data: marks });
});

export const getInternalMark = asyncHandler(async (req: AuthRequest, res: Response) => {
  const mark = await prisma.internalMark.findUnique({
    where: { id: req.params.id },
    include: { student: { select: { name: true } } }
  });
  if (!mark) {
    res.status(404).json({ success: false, message: 'Internal mark not found' });
    return;
  }
  res.status(200).json({ success: true, data: mark });
});

export const createInternalMark = asyncHandler(async (req: AuthRequest, res: Response) => {
  const mark = await prisma.internalMark.create({
    data: {
      ...req.body,
      organizationId: req.user.organizationId,
      enteredBy: req.user.id
    }
  });
  res.status(201).json({ success: true, data: mark });
});

export const updateInternalMark = asyncHandler(async (req: AuthRequest, res: Response) => {
  const markExists = await prisma.internalMark.findUnique({ where: { id: req.params.id } });
  if (!markExists) {
    res.status(404).json({ success: false, message: 'Internal mark not found' });
    return;
  }
  const mark = await prisma.internalMark.update({
    where: { id: req.params.id },
    data: req.body
  });
  res.status(200).json({ success: true, data: mark });
});

export const deleteInternalMark = asyncHandler(async (req: AuthRequest, res: Response) => {
  const markExists = await prisma.internalMark.findUnique({ where: { id: req.params.id } });
  if (!markExists) {
    res.status(404).json({ success: false, message: 'Internal mark not found' });
    return;
  }
  await prisma.internalMark.delete({ where: { id: req.params.id } });
  res.status(200).json({ success: true, data: {} });
});

export const getStudentInstallments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const student = await prisma.student.findUnique({
    where: { id: req.params.id },
    include: {
      program: true,
      invoices: true,
      enrollments: true
    }
  });

  if (!student) {
    res.status(404).json({ success: false, message: 'Student not found' });
    return;
  }

  // Fallback to enrollment sessionId if student sessionId is null
  const sessionId = student.sessionId || student.enrollments?.[0]?.sessionId || null;

  // Find all candidate fee structures matching program or university
  const candidates = await prisma.programFeeStructure.findMany({
    where: {
      organizationId: req.user.organizationId,
      OR: [
        {
          programId: student.programId,
          ...(student.centerId ? {
            OR: [
              { studyCenterId: student.centerId },
              { studyCenterId: null },
            ],
          } : { studyCenterId: null }),
        },
        ...(!student.centerId
          ? [{ universityId: student.program.universityId, level: 'university' }]
          : [])
      ]
    }
  });

  const sorted = candidates.map(c => {
    let score = 0;
    if (c.level === 'program' && c.programId === student.programId) {
      const centerMatch = Boolean(student.centerId && c.studyCenterId === student.centerId);
      if (c.admissionSessionId === sessionId) score = centerMatch ? 150 : 100;
      else if (c.admissionSessionId === null) score = centerMatch ? 130 : 80;
      else score = centerMatch ? 110 : 60;
    } else if (c.level === 'university' && c.universityId === student.program.universityId) {
      if (c.admissionSessionId === sessionId) score = 40;
      else if (c.admissionSessionId === null) score = 20;
      else score = 10;
    }
    return { c, score };
  }).sort((a, b) => b.score - a.score);

  const feeStructure = sorted[0]?.c;

  if (!feeStructure) {
    res.status(200).json({ success: true, installments: [] });
    return;
  }

  const billingCycle = feeStructure.billingCycle;
  const durationInMonths = student.program.duration || 12;

  let totalCycles = 1;
  let cycleLabel = 'Installment';

  if (billingCycle === 'per_semester') {
    totalCycles = Math.ceil(durationInMonths / 6);
    cycleLabel = 'Semester';
  } else if (billingCycle === 'per_year' || billingCycle === 'yearly') {
    totalCycles = Math.ceil(durationInMonths / 12);
    cycleLabel = 'Year';
  }

  const installments = [];
  const invoices = student.invoices || [];

  const addFees = Array.isArray(feeStructure.additionalFees) ? feeStructure.additionalFees : [];
  const nonGstFees = addFees.filter((f: any) => f.label !== 'GST');
  const additionalFeesTotal = nonGstFees.reduce((s: number, f: any) => s + f.amount, 0);

  // Parse feeBreakdown from fee structure
  let breakdownArray: any[] = [];
  if (feeStructure.feeBreakdown) {
    if (typeof feeStructure.feeBreakdown === 'string') {
      try { breakdownArray = JSON.parse(feeStructure.feeBreakdown); } catch (e) {}
    } else if (Array.isArray(feeStructure.feeBreakdown)) {
      breakdownArray = feeStructure.feeBreakdown;
    }
  }

  // If breakdown is properly configured, use it
  if (breakdownArray.length > 0) {
    totalCycles = breakdownArray.length;
    for (let i = 0; i < totalCycles; i++) {
      const b = breakdownArray[i];
      const name = `${cycleLabel} ${b.year || i + 1}`;
      
      const matchingInvoice = invoices.find((inv: any) => {
        const items = Array.isArray(inv.items) ? inv.items : JSON.parse(typeof inv.items === 'string' ? inv.items : '[]');
        return items.some((item: any) => item.description?.toLowerCase().includes(name.toLowerCase()));
      });

      let status = 'upcoming';
      let paidAt = null;
      let dueDate = new Date(student.createdAt);
      
      if (b.dueDate) {
        dueDate = new Date(b.dueDate);
      } else {
        if (i === 0) dueDate = new Date(student.enrolledAt || student.createdAt);
        else {
          if (cycleLabel === 'Semester') dueDate.setMonth(dueDate.getMonth() + i * 6);
          else dueDate.setFullYear(dueDate.getFullYear() + i);
        }
      }

      if (matchingInvoice) {
        if (matchingInvoice.status === 'paid') {
          status = 'paid';
          paidAt = matchingInvoice.paidAt || matchingInvoice.updatedAt;
        } else {
          status = 'unpaid';
          dueDate = matchingInvoice.dueDate || dueDate;
        }
      } else if (i === 0 && student.enrolledAt) {
        status = 'paid';
        paidAt = student.enrolledAt;
      }

      if (student.status === 'dropout' && status !== 'paid') {
        continue;
      }

      let breakdownAdditionalFeesTotal = 0;
      if (typeof b.additionalFees === 'string' && b.additionalFees.trim() !== '') {
        const custom = b.additionalFees.split(',').map((s: string) => {
          const parts = s.trim().split(':');
          return Number(parts[1]) || 0;
        });
        breakdownAdditionalFeesTotal = custom.reduce((sum: number, val: number) => sum + val, 0);
      }
      let totalAmount = Number(b.baseFee || 0) + Number(b.examFee || 0) + breakdownAdditionalFeesTotal;
      if (i === 0) totalAmount += additionalFeesTotal;

      const gstEntry = addFees.find((f: any) => f.label === 'GST');
      if (gstEntry) {
        totalAmount += Math.round((totalAmount * gstEntry.amount) / 100);
      }

      installments.push({
        name,
        amount: totalAmount,
        status,
        dueDate,
        paidAt,
        invoiceId: matchingInvoice?.id
      });
    }
  } else {
    // Fallback if no breakdown configured
    const baseFee = feeStructure.baseFee;
    let fallbackAmount = baseFee + additionalFeesTotal;
    const gstEntry = addFees.find((f: any) => f.label === 'GST');
    if (gstEntry) {
      fallbackAmount += Math.round((fallbackAmount * gstEntry.amount) / 100);
    }

    installments.push({
      name: `${cycleLabel} 1`,
      amount: fallbackAmount,
      status: 'paid',
      dueDate: student.enrolledAt || student.createdAt,
      paidAt: student.enrolledAt || student.createdAt
    });

    for (let i = 2; i <= totalCycles; i++) {
      const name = `${cycleLabel} ${i}`;
      const matchingInvoice = invoices.find((inv: any) => {
        const items = Array.isArray(inv.items) ? inv.items : JSON.parse(typeof inv.items === 'string' ? inv.items : '[]');
        return items.some((item: any) => item.description?.toLowerCase().includes(name.toLowerCase()));
      });

      let status = 'upcoming';
      let paidAt = null;
      let dueDate = new Date(student.createdAt);

      if (cycleLabel === 'Semester') {
        dueDate.setMonth(dueDate.getMonth() + (i - 1) * 6);
      } else {
        dueDate.setFullYear(dueDate.getFullYear() + (i - 1));
      }

      if (matchingInvoice) {
        if (matchingInvoice.status === 'paid') {
          status = 'paid';
          paidAt = matchingInvoice.paidAt || matchingInvoice.updatedAt;
        } else {
          status = 'unpaid';
          dueDate = matchingInvoice.dueDate || dueDate;
        }
      }

      if (student.status === 'dropout' && status !== 'paid') {
        continue;
      }

      let fallbackAmount = baseFee;
      if (gstEntry) {
        fallbackAmount += Math.round((fallbackAmount * gstEntry.amount) / 100);
      }

      installments.push({
        name,
        amount: fallbackAmount,
        status,
        dueDate,
        paidAt,
        invoiceId: matchingInvoice?.id
      });
    }
  }

  res.status(200).json({ success: true, installments });
});

export const getStudentPaymentInfo = asyncHandler(async (req: AuthRequest, res: Response) => {
  const student = await prisma.student.findFirst({
    where: {
      organizationId: req.user.organizationId,
      email: { equals: req.user.email, mode: 'insensitive' },
    },
    include: {
      program: true,
      enrollments: {
        include: {
          session: { select: { id: true, name: true } },
          studentFeeReceipts: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      invoices: {
        include: {
          payments: { orderBy: { receivedAt: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
      },
      universityFeePayments: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!student) {
    res.status(404).json({ success: false, message: 'Student record not found' });
    return;
  }

  const sessionId = student.sessionId || student.enrollments[0]?.sessionId || null;
  const feeCandidates = await prisma.programFeeStructure.findMany({
    where: {
      organizationId: req.user.organizationId,
      OR: [
        {
          programId: student.programId,
          ...(student.centerId ? {
            OR: [
              { studyCenterId: student.centerId },
              { studyCenterId: null },
            ],
          } : { studyCenterId: null }),
        },
        ...(!student.centerId
          ? [{ universityId: student.program.universityId, level: 'university' }]
          : []),
      ],
    },
  });
  const feeStructure = feeCandidates
    .map(candidate => {
      const isProgramFee = candidate.level === 'program' && candidate.programId === student.programId;
      const isUniversityFee = candidate.level === 'university'
        && candidate.universityId === student.program.universityId;
      let score = 0;
      if (isProgramFee) {
        const centerMatch = Boolean(student.centerId && candidate.studyCenterId === student.centerId);
        score = candidate.admissionSessionId === sessionId
          ? centerMatch ? 150 : 100
          : candidate.admissionSessionId === null ? centerMatch ? 130 : 80 : centerMatch ? 110 : 60;
      } else if (isUniversityFee) {
        score = candidate.admissionSessionId === sessionId
          ? 40
          : candidate.admissionSessionId === null ? 20 : 10;
      }
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score)[0]?.candidate;

  const feeItems: { label: string; amount: number }[] = [];
  const installments: { name: string; amount: number; dueDate: string | null; items: { label: string; amount: number }[] }[] = [];
  if (feeStructure) {
    const additionalFees = Array.isArray(feeStructure.additionalFees)
      ? feeStructure.additionalFees as { label?: string; amount?: number }[]
      : [];
    const gstFee = additionalFees.find(fee => fee.label?.toLowerCase() === 'gst');
    const recurringAdditionalFees = additionalFees.filter(
      fee => fee.label && fee.label.toLowerCase() !== 'gst',
    );
    const globalAdditionalTotal = recurringAdditionalFees.reduce(
      (sum, fee) => sum + (Number(fee.amount) || 0),
      0,
    );

    let breakdown: any[] = [];
    if (Array.isArray(feeStructure.feeBreakdown)) {
      breakdown = feeStructure.feeBreakdown;
    } else if (typeof feeStructure.feeBreakdown === 'string') {
      try {
        const parsed = JSON.parse(feeStructure.feeBreakdown);
        if (Array.isArray(parsed)) breakdown = parsed;
      } catch {
        breakdown = [];
      }
    }

    if (breakdown.length > 0) {
      const cycleLabel = feeStructure.billingCycle === 'per_semester'
        ? 'Semester'
        : feeStructure.billingCycle === 'per_year' || feeStructure.billingCycle === 'yearly'
          ? 'Year'
          : 'Installment';
      breakdown.forEach((cycle, index) => {
        const items: { label: string; amount: number }[] = [
          { label: 'Tuition fee', amount: Number(cycle.baseFee) || 0 },
          { label: 'Exam fee', amount: Number(cycle.examFee) || 0 },
          { label: 'University fee', amount: Number(cycle.universityFee) || 0 },
        ].filter(item => item.amount !== 0);

        if (typeof cycle.additionalFees === 'string' && cycle.additionalFees.trim()) {
          cycle.additionalFees.split(',').forEach((entry: string) => {
            const [label, amount] = entry.trim().split(':');
            const parsedAmount = Number(amount);
            if (label?.trim() && Number.isFinite(parsedAmount)) {
              items.push({ label: label.trim(), amount: parsedAmount });
            }
          });
        }
        if (index === 0) {
          recurringAdditionalFees.forEach(fee => {
            if (fee.label && Number(fee.amount)) {
              items.push({ label: fee.label, amount: Number(fee.amount) });
            }
          });
        }

        const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
        const gstAmount = gstFee?.amount
          ? Math.round((subtotal * Number(gstFee.amount)) / 100)
          : 0;
        if (gstAmount) items.push({ label: `GST (${gstFee?.amount}%)`, amount: gstAmount });

        const amount = items.reduce((sum, item) => sum + item.amount, 0);
        items.forEach(item => {
          const existingItem = feeItems.find(fee => fee.label === item.label);
          if (existingItem) existingItem.amount += item.amount;
          else feeItems.push({ ...item });
        });
        installments.push({
          name: `${cycleLabel} ${cycle.year || index + 1}`,
          amount,
          dueDate: cycle.dueDate || null,
          items,
        });
      });
    } else {
      const items = [
        { label: 'Tuition fee', amount: Number(feeStructure.baseFee) || 0 },
        { label: 'University fee', amount: Number(feeStructure.universityFee) || 0 },
        ...recurringAdditionalFees
          .filter(fee => fee.label && Number(fee.amount))
          .map(fee => ({ label: fee.label!, amount: Number(fee.amount) })),
      ].filter(item => item.amount !== 0);
      const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
      const gstAmount = gstFee?.amount
        ? Math.round((subtotal * Number(gstFee.amount)) / 100)
        : 0;
      if (gstAmount) items.push({ label: `GST (${gstFee?.amount}%)`, amount: gstAmount });
      feeItems.push(...items);
      installments.push({
        name: feeStructure.billingCycle === 'total' ? 'Full program' : 'Program fees',
        amount: items.reduce((sum, item) => sum + item.amount, 0),
        dueDate: null,
        items,
      });
    }
  }

  const payments = [
    ...student.enrollments.flatMap(enrollment => enrollment.studentFeeReceipts.map(receipt => ({
      id: receipt.id,
      date: receipt.receiptDate,
      amount: receipt.amount,
      method: receipt.paymentMode,
      referenceNo: receipt.referenceNo,
      description: enrollment.session?.name
        ? `Enrollment fee · ${enrollment.session.name}`
        : 'Enrollment fee',
      status: 'paid',
    }))),
    ...student.invoices.flatMap(invoice => invoice.payments.map(payment => ({
      id: payment.id,
      date: payment.receivedAt,
      amount: payment.amount,
      method: payment.method,
      referenceNo: payment.referenceNo,
      description: invoice.invoiceNo,
      status: 'paid',
    }))),
    ...student.universityFeePayments.map(payment => ({
      id: payment.id,
      date: payment.paidAt || payment.createdAt,
      amount: payment.amount,
      method: 'University fee',
      referenceNo: payment.referenceNo,
      description: payment.semesterOrYear,
      status: payment.status,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  res.status(200).json({
    success: true,
    data: {
      program: student.program.name,
      session: student.enrollments[0]?.session?.name || '',
      currency: feeStructure?.currency || 'INR',
      billingCycle: feeStructure?.billingCycle || '',
      feeItems,
      totalConfigured: feeItems.reduce((sum, item) => sum + item.amount, 0),
      installments,
      payments,
      invoices: student.invoices.map(invoice => ({
        id: invoice.id,
        invoiceNo: invoice.invoiceNo,
        invoiceType: invoice.invoiceType,
        financialYear: invoice.financialYear,
        academicYear: invoice.academicYear,
        period: invoice.period,
        amount: invoice.amount,
        tax: invoice.tax,
        total: invoice.total,
        paidAmount: invoice.paidAmount,
        balanceAmount: invoice.balanceAmount,
        status: invoice.status,
        items: invoice.items,
        taxDetails: invoice.taxDetails,
        universityDetails: invoice.universityDetails,
        studentDetails: invoice.studentDetails,
        paymentInstructions: invoice.paymentInstructions,
        dueDate: invoice.dueDate,
        issuedAt: invoice.issuedAt,
        paidAt: invoice.paidAt,
        payments: invoice.payments,
      })),
    },
  });
});

export const payStudentInstallment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { installmentName, amount } = req.body;
  const student = await prisma.student.findUnique({
    where: { id: req.params.id },
    include: { program: { include: { university: true } } }
  });

  if (!student) {
    res.status(404).json({ success: false, message: 'Student not found' });
    return;
  }

  const category = (student.program.university as any)?.category || 'team_lease';
  const NO_WALLET_CATEGORIES = ['direct_iits', 'team_lease'];
  const isNoWallet = NO_WALLET_CATEGORIES.includes(category);

  const wallet = await prisma.studyCenterWallet.findUnique({
    where: { studyCenterId: req.user.studyCenterId || '' }
  });

  if (!isNoWallet) {
    if (!wallet || wallet.balance < amount) {
      res.status(400).json({ success: false, message: `Insufficient wallet balance. Available: ₹${wallet?.balance || 0}` });
      return;
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Deduct wallet only for universities that use wallets
    if (!isNoWallet && wallet) {
      await tx.studyCenterWallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } }
      });
    }

    // 2. Create Invoice
    const invoiceNo = `INV-STU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const invoice = await tx.invoice.create({
      data: {
        organizationId: req.user.organizationId,
        centerId: req.user.studyCenterId || '',
        studentId: student.id,
        invoiceNo,
        amount,
        tax: 0,
        total: amount,
        status: 'paid',
        dueDate: new Date(),
        paidAt: new Date(),
        items: [{ description: `Fee for ${installmentName} (${student.program.name})`, quantity: 1, rate: amount, amount }]
      }
    });

    // 3. Create PaymentEntry
    await tx.paymentEntry.create({
      data: {
        organizationId: req.user.organizationId,
        invoiceId: invoice.id,
        amount,
        method: isNoWallet ? 'direct_to_university' : 'wallet_debit',
        receivedBy: req.user.id,
        notes: isNoWallet ? `Student paid directly to the university - ${installmentName}` : `Paid in advance by study center for student ${student.name} - ${installmentName}`
      }
    });

    return invoice;
  });

  res.status(200).json({ success: true, data: result });
});

export const submitStatusChangeRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { requestedStatus, reason } = req.body;
  const student = await prisma.student.findUnique({
    where: { id: req.params.id }
  });

  if (!student) {
    res.status(404).json({ success: false, message: 'Student not found' });
    return;
  }

  if (req.user.role === 'center_admin' && student.centerId !== req.user.studyCenterId) {
    res.status(403).json({ success: false, message: 'Unauthorized access to student' });
    return;
  }

  if (!['hold', 'dropout'].includes(requestedStatus)) {
    res.status(400).json({ success: false, message: 'Invalid status requested. Must be hold or dropout.' });
    return;
  }

  const statusRequest = await prisma.studentStatusRequest.create({
    data: {
      studentId: student.id,
      organizationId: req.user.organizationId,
      requestedStatus,
      reason,
      status: 'pending_operations',
      createdBy: req.user.id
    }
  });

  // Broadcast notification to operations department roles
  await broadcastNotification(
    req.user.organizationId,
    'system',
    'New Status Change Request',
    `A request has been submitted to mark student ${student.name} as ${requestedStatus.toUpperCase()}.`,
    ['ops_admin', 'ops_sub_admin', 'employee']
  );

  res.status(201).json({ success: true, data: statusRequest });
});

export const getStatusChangeRequests = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { requestedStatus, status } = req.query;
  const where: any = { organizationId: req.user.organizationId };

  if (req.user.role === 'center_admin') {
    where.student = { centerId: req.user.studyCenterId || '' };
  }

  if (requestedStatus) {
    where.requestedStatus = requestedStatus as string;
  }

  if (status) {
    where.status = status as string;
  }

  const requests = await prisma.studentStatusRequest.findMany({
    where,
    include: {
      student: {
        include: {
          program: true,
          center: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.status(200).json({ success: true, count: requests.length, data: requests });
});

export const verifyStatusChangeRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { action, remarks } = req.body; // action: "verify" or "reject"
  const request = await prisma.studentStatusRequest.findUnique({
    where: { id: req.params.requestId },
    include: { student: true }
  });

  if (!request) {
    res.status(404).json({ success: false, message: 'Status change request not found' });
    return;
  }

  if (request.status !== 'pending_operations') {
    res.status(400).json({ success: false, message: 'Request is not pending operations review' });
    return;
  }

  let nextStatus = 'rejected';
  if (action === 'verify') {
    nextStatus = 'pending_finance';
  }

  const updated = await prisma.studentStatusRequest.update({
    where: { id: request.id },
    data: {
      status: nextStatus,
      operationsRemarks: remarks
    }
  });

  // Notify next parties
  if (action === 'verify') {
    // Notify Finance roles
    await broadcastNotification(
      request.organizationId,
      'system',
      'Status Change Request Verified',
      `Operations verified a request to mark student ${request.student?.name} as ${request.requestedStatus.toUpperCase()}. Pending finance confirmation.`,
      ['finance_admin', 'employee']
    );
  } else {
    // Notify the requester (study center)
    await createNotification(
      request.organizationId,
      request.createdBy,
      'system',
      'Status Request Rejected',
      `Operations rejected the status change request for student ${request.student?.name}.`
    );
  }

  res.status(200).json({ success: true, data: updated });
});

export const confirmStatusChangeRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { action, remarks } = req.body; // action: "confirm" or "reject"
  const request = await prisma.studentStatusRequest.findUnique({
    where: { id: req.params.requestId },
    include: { student: true }
  });

  if (!request) {
    res.status(404).json({ success: false, message: 'Status change request not found' });
    return;
  }

  if (request.status !== 'pending_finance') {
    res.status(400).json({ success: false, message: 'Request is not pending finance confirmation' });
    return;
  }

  let nextStatus = 'rejected';
  if (action === 'confirm') {
    nextStatus = 'approved';
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.studentStatusRequest.update({
      where: { id: request.id },
      data: {
        status: nextStatus,
        financeRemarks: remarks
      }
    });

    if (action === 'confirm') {
      await tx.student.update({
        where: { id: request.studentId },
        data: { status: request.requestedStatus }
      });
    }

    return updated;
  });

  // Notify the requester
  if (action === 'confirm') {
    await createNotification(
      request.organizationId,
      request.createdBy,
      'system',
      'Status Request Approved',
      `Finance confirmed the status change request for student ${request.student?.name}. The student status has been updated to ${request.requestedStatus.toUpperCase()}.`
    );
  } else {
    await createNotification(
      request.organizationId,
      request.createdBy,
      'system',
      'Status Request Rejected',
      `Finance rejected the status change request for student ${request.student?.name}.`
    );
  }

  res.status(200).json({ success: true, data: result });
});
