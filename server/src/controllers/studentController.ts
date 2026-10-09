// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import bcrypt from 'bcryptjs';
import { createNotification, broadcastNotification } from './notificationController.js';

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
    where.enrollments = { some: { ...where.enrollments?.some, sessionId: req.query.sessionId as string } };
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
      program: { include: { university: true } }
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
  const { firstName, lastName, name, enrollmentNo, centerId, email, programId } = req.body;
  const finalName = name || `${firstName || ''} ${lastName || ''}`.trim() || 'Unknown Student';
  const finalEnrollmentNo = enrollmentNo || `ENR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  let finalCenterId = (centerId && centerId !== 'null' && centerId !== 'none') ? centerId : null;

  if (!email) {
    res.status(400).json({ success: false, message: 'Email is required' });
    return;
  }

  // Create User if not exists
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
        status: 'active'
      }
    });
  }

  // Check if Student already exists
  const existingStudent = await prisma.student.findUnique({ where: { email } });
  if (existingStudent) {
    res.status(400).json({ success: false, message: 'A student with this email already exists' });
    return;
  }

  let finalProgramId = programId;
  if (!finalProgramId || finalProgramId === 'null') {
    const firstProg = await prisma.program.findFirst({ where: { organizationId: req.user.organizationId } });
    if (firstProg) finalProgramId = firstProg.id;
  }

  const allowedFields = ['sessionId', 'status', 'joinDate', 'enrolledAt', 'reregStatus', 'referredBy', 'phone', 'address'];
  const dbData: any = {
    name: finalName,
    enrollmentNo: finalEnrollmentNo,
    organization: { connect: { id: req.user.organizationId } },
    center: finalCenterId ? { connect: { id: finalCenterId } } : undefined,
    user: { connect: { email: email } }
  };

  if (finalProgramId) {
    dbData.program = { connect: { id: finalProgramId } };
  }

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) dbData[field] = req.body[field];
  }

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
  const student = await prisma.student.update({
    where: { id: req.params.id },
    data: { status: 'active' as any }
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
        { programId: student.programId },
        { universityId: student.program.universityId, level: 'university' }
      ]
    }
  });

  // Rank candidate fee structures in memory:
  // 1. Program-level and exact session match -> 100
  // 2. Program-level and standard/null session match -> 80
  // 3. Program-level and any other session match -> 60
  // 4. University-level and exact session match -> 40
  // 5. University-level and standard/null session match -> 20
  // 6. University-level and other session match -> 10
  const sorted = candidates.map(c => {
    let score = 0;
    if (c.level === 'program' && c.programId === student.programId) {
      if (c.admissionSessionId === sessionId) score = 100;
      else if (c.admissionSessionId === null) score = 80;
      else score = 60;
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
