// @ts-nocheck
import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { prisma } from '../config/postgres.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import bcrypt from 'bcryptjs';
import { activateStudentPortalAccount, getStudentPortalPassword } from '../utils/studentPortalAccess.js';
import { filterProgramsWithActiveSessions } from '../services/activeSessionPrograms.js';

const requireSalesDepartmentStaff = async (req: AuthRequest, res: Response) => {
  if (!req.user.organizationId) {
    res.status(403).json({ success: false, message: 'Sales department access is required' });
    return false;
  }

  if (req.user.role === 'sales_admin' || req.user.role === 'ceo' || req.user.role === 'org_admin') {
    return true;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      department: { select: { type: true, name: true } },
      subDepartment: { select: { parentDept: { select: { type: true, name: true } } } },
    },
  });
  const departmentType = user?.department?.type || user?.subDepartment?.parentDept?.type;
  const departmentName = user?.department?.name || user?.subDepartment?.parentDept?.name;
  if (
    departmentType?.toLowerCase() !== 'sales' &&
    !departmentName?.toLowerCase().includes('sales')
  ) {
    res.status(403).json({ success: false, message: 'Sales department access is required' });
    return false;
  }
  return true;
};

export const getSalesEnrollmentPrograms = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!await requireSalesDepartmentStaff(req, res)) return;
  const programs = await prisma.program.findMany({
    where: {
      organizationId: req.user.organizationId,
      status: 'active',
      isDeleted: false,
    },
    include: {
      university: { select: { id: true, name: true, code: true, category: true, optionalFields: true } },
      programFeeStructure: { where: { organizationId: req.user.organizationId } },
    },
    orderBy: { name: 'asc' },
  });
  const activeSessionPrograms = await filterProgramsWithActiveSessions(req.user.organizationId, programs);
  res.json({ success: true, count: activeSessionPrograms.length, data: activeSessionPrograms });
});

export const getSalesEnrollmentSessions = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!await requireSalesDepartmentStaff(req, res)) return;
  const programId = String(req.query.programId || '');
  const program = await prisma.program.findFirst({
    where: { id: programId, organizationId: req.user.organizationId, status: 'active', isDeleted: false },
    select: { universityId: true },
  });
  if (!program) {
    res.status(404).json({ success: false, message: 'Active program not found' });
    return;
  }

  const sessions = await prisma.admissionSession.findMany({
    where: {
      organizationId: req.user.organizationId,
      status: 'active',
      AND: [
        { OR: [{ programId }, { programId: null }] },
        { OR: [{ universityId: program.universityId }, { universityId: null }] },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, programId: true },
  });
  res.json({ success: true, count: sessions.length, data: sessions });
});

export const checkSalesEnrollmentEmail = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!await requireSalesDepartmentStaff(req, res)) return;
  const { studentEmail, programId, sessionId } = req.body;
  if (!studentEmail || !programId || !sessionId) {
    res.status(400).json({ success: false, isUnique: false, message: 'Email, program, and admission session are required' });
    return;
  }

  const existing = await prisma.enrollment.findFirst({
    where: {
      studentEmail,
      programId,
      sessionId,
      organizationId: req.user.organizationId,
    },
    select: { id: true },
  });
  res.json({
    success: true,
    isUnique: !existing,
    ...(existing ? { message: 'An application with this email already exists for this program and session' } : {}),
  });
});

export const createSalesStudentEnrollment = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!await requireSalesDepartmentStaff(req, res)) return;
  const {
    studentName, studentEmail, studentPhone, studentAddress, programId, sessionId, documents, educationalDetails,
    specialisation, abcId, debId, dob, religion, caste, fatherName, motherName, parentMobile, studentPhoto,
    admissionDate, pincode, alternativePhone, maritalStatus, currentlyWorking, paymentMethod, totalFee,
  } = req.body;

  if (!studentName?.trim() || !studentEmail?.trim() || !studentPhone?.trim() || !studentAddress?.trim() || !programId || !sessionId) {
    res.status(400).json({ success: false, message: 'Name, email, phone, address, program, and admission session are required' });
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

  const [program, session] = await Promise.all([
    prisma.program.findFirst({
      where: { id: programId, organizationId: req.user.organizationId, status: 'active', isDeleted: false },
      select: { id: true, universityId: true },
    }),
    prisma.admissionSession.findFirst({
      where: { id: sessionId, organizationId: req.user.organizationId, status: 'active' },
      select: { id: true, programId: true, universityId: true },
    }),
  ]);
  if (!program) {
    res.status(400).json({ success: false, message: 'Selected program is invalid or inactive' });
    return;
  }
  if (!session || (session.programId && session.programId !== programId) || (session.universityId && session.universityId !== program.universityId)) {
    res.status(400).json({ success: false, message: 'Selected admission session is invalid for this program' });
    return;
  }

  const duplicate = await prisma.enrollment.findFirst({
    where: {
      studentEmail: studentEmail.trim(),
      programId,
      sessionId,
      organizationId: req.user.organizationId,
    },
    select: { id: true },
  });
  if (duplicate) {
    res.status(409).json({ success: false, message: 'An application with this email already exists for this program and session' });
    return;
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: studentEmail.trim() },
    select: { id: true, organizationId: true, role: true },
  });
  if (existingUser && (existingUser.organizationId !== req.user.organizationId || existingUser.role !== 'student')) {
    res.status(409).json({ success: false, message: 'This email is already associated with another account' });
    return;
  }
  const existingStudent = await prisma.student.findUnique({
    where: { email: studentEmail.trim() },
    select: { id: true, organizationId: true },
  });
  if (existingStudent && existingStudent.organizationId !== req.user.organizationId) {
    res.status(409).json({ success: false, message: 'This email is already associated with a student in another organization' });
    return;
  }

  const defaultStudentPasswordHash = existingUser ? null : await bcrypt.hash('password123', 10);
  const now = new Date();
  const enrollment = await prisma.$transaction(async (tx) => {
    let user = existingUser;
    if (!user) {
      user = await tx.user.create({
        data: {
          userId: `STD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          email: studentEmail.trim(),
          password: defaultStudentPasswordHash!,
          name: studentName.trim(),
          role: 'student',
          organizationId: req.user.organizationId,
          status: 'inactive',
        },
        select: { id: true },
      });
    }

    let student = existingStudent;
    if (!student) {
      student = await tx.student.create({
        data: {
          enrollmentNo: `ENR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: studentName.trim(),
          email: studentEmail.trim(),
          phone: studentPhone.trim(),
          address: studentAddress.trim(),
          programId,
          sessionId,
          specialisation: specialisation || null,
          abcId: abcId || null,
          debId: debId || null,
          dob: dob || null,
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
          organizationId: req.user.organizationId,
        },
        select: { id: true },
      });
    }

    return tx.enrollment.create({
      data: {
        organizationId: req.user.organizationId,
        studentId: student.id,
        programId,
        studyCenterId: null,
        sessionId,
        studentName: studentName.trim(),
        studentEmail: studentEmail.trim(),
        studentPhone: studentPhone.trim(),
        studentAddress: studentAddress.trim(),
        specialisation: specialisation || null,
        abcId: abcId || null,
        debId: debId || null,
        dob: dob || null,
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
        documents: documents || [],
        educationalDetails: educationalDetails || [],
        paymentMethod: paymentMethod || 'installment',
        totalFee: totalFee ? Number(totalFee) : null,
        status: 'document_review',
        salesUserId: req.user.id,
        statusHistory: [
          {
            status: 'submitted',
            actorId: req.user.id,
            actorName: req.user.name,
            actorRole: req.user.role,
            timestamp: now.toISOString(),
            note: 'Application entered by Sales department',
          },
          {
            status: 'document_review',
            actorId: 'system',
            timestamp: now.toISOString(),
            note: 'Forwarded to Operations for document verification',
          },
        ],
      },
      include: {
        program: { select: { id: true, name: true, code: true } },
        session: { select: { id: true, name: true } },
      },
    });
  });

  // Notify Operations team of new student enrollment for review
  try {
    const opsAdmins = await prisma.user.findMany({
      where: {
        organizationId: req.user.organizationId,
        role: { in: ['ops_admin', 'ops_sub_admin'] } as any,
        status: 'active' as any,
      },
      select: { id: true },
    });
    if (opsAdmins.length > 0) {
      await prisma.notification.createMany({
        data: opsAdmins.map((admin) => ({
          organizationId: req.user.organizationId,
          userId: admin.id,
          title: '📋 New Student Application for Review',
          message: `${studentName} has been submitted by Sales (${req.user.name}). Please review the documents.`,
          type: 'general' as any,
          priority: 'medium' as any,
          link: 'enrollment_review',
        })),
      });
    }
  } catch (err) {
    console.error('Failed to notify ops admins:', err);
  }

  res.status(201).json({ success: true, data: enrollment });
});

// ─── Public: Validate invite token and get form data ─────────────────────────

export const validateStudentInviteToken = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;

  const invite = await prisma.studyCenterInvite.findUnique({
    where: { token },
    include: {
      referrer: { select: { id: true, name: true, organizationId: true } },
      organization: { select: { id: true, name: true } },
    },
  });

  if (!invite) {
    res.status(404).json({ success: false, message: 'Invalid or expired invite link' });
    return;
  }

  if (invite.status !== 'pending') {
    res.status(400).json({ success: false, message: 'This invite link has already been used or expired' });
    return;
  }

  if (new Date(invite.expiresAt) < new Date()) {
    res.status(400).json({ success: false, message: 'This invite link has expired' });
    return;
  }

  // Get programs for this invite
  const programs = await prisma.program.findMany({
    where: {
      organizationId: invite.organizationId,
      status: 'active' as any,
      ...(invite.programIds.length > 0 ? { id: { in: invite.programIds } } : {}),
      ...(invite.universityIds.length > 0 ? { universityId: { in: invite.universityIds } } : {}),
    },
    include: {
      university: { select: { id: true, name: true, code: true } },
    },
  });

  res.status(200).json({
    success: true,
    data: {
      organizationName: invite.organization.name,
      referrerName: invite.referrer.name,
      programs,
      token,
    },
  });
});

// ─── Public: Student submits their data via invite link ───────────────────────

export const submitStudentApplication = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;
  const { studentName, studentEmail, studentPhone, studentAddress, programId, sessionId, documents } = req.body;

  // Validate required fields
  const missing: string[] = [];
  if (!studentName) missing.push('studentName');
  if (!studentEmail) missing.push('studentEmail');
  if (!studentPhone) missing.push('studentPhone');
  if (!studentAddress) missing.push('studentAddress');
  if (!programId) missing.push('programId');
  if (missing.length > 0) {
    res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
    return;
  }

  // Validate invite
  const invite = await prisma.studyCenterInvite.findUnique({
    where: { token },
    include: { referrer: { select: { id: true, organizationId: true } } },
  });

  if (!invite || invite.status !== 'pending' || new Date(invite.expiresAt) < new Date()) {
    res.status(400).json({ success: false, message: 'Invalid or expired invite link' });
    return;
  }

  const organizationId = invite.organizationId;
  const salesUserId = invite.referredBy;

  // Validate program belongs to this org and invite's universities
  const program = await prisma.program.findFirst({
    where: {
      id: programId,
      organizationId: organizationId,
      status: 'active' as any,
      ...(invite.universityIds.length > 0 ? { universityId: { in: invite.universityIds } } : {}),
    },
  });

  if (!program) {
    res.status(400).json({ success: false, message: 'Invalid program selection' });
    return;
  }

  // Find or create a default study center for sales-led enrollments
  // Use a special "Sales Direct" center or the first active center
  let studyCenter = await prisma.studyCenter.findFirst({
    where: { organizationId: organizationId, status: 'active' as any },
    orderBy: { createdAt: 'asc' },
  });

  if (!studyCenter) {
    res.status(400).json({ success: false, message: 'No active study center configured for this organization' });
    return;
  }

  // Find or use first active session
  let session = sessionId
    ? await prisma.admissionSession.findFirst({ where: { id: sessionId, organizationId: organizationId } })
    : await prisma.admissionSession.findFirst({ where: { organizationId: organizationId, status: 'active' as any }, orderBy: { createdAt: 'desc' } });

  if (!session) {
    res.status(400).json({ success: false, message: 'No active admission session found' });
    return;
  }

  // Check for duplicate email in same program+session
  const existing = await prisma.enrollment.findFirst({
    where: { studentEmail, programId, sessionId: session.id, organizationId: organizationId },
  });
  if (existing) {
    res.status(400).json({ success: false, message: 'An application with this email already exists for this program' });
    return;
  }

  const now = new Date();

  // Create enrollment with document_review status
  const enrollment = await prisma.$transaction(async (tx) => {
    // 1. Create or find User
    let user = await tx.user.findUnique({ where: { email: studentEmail } });
    if (!user) {
      const rawPassword = 'password123';
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      const userId = `STD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      user = await tx.user.create({
        data: {
          userId,
          email: studentEmail,
          password: hashedPassword,
          name: studentName,
          role: 'student',
          organizationId: organizationId,
          status: 'inactive'
        }
      });
    }

    // 2. Create or find Student (set status to pending)
    let student = await tx.student.findUnique({ where: { email: studentEmail } });
    if (!student) {
      const enrollmentNo = `ENR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      student = await tx.student.create({
        data: {
          name: studentName,
          enrollmentNo,
          phone: studentPhone,
          address: studentAddress,
          sessionId: session.id,
          status: 'pending',
          organization: { connect: { id: organizationId } },
          center: { connect: { id: studyCenter.id } },
          user: { connect: { email: studentEmail } },
          program: { connect: { id: programId } }
        }
      });
    }

    // 3. Create Enrollment
    return tx.enrollment.create({
      data: {
        organizationId: organizationId,
        studentName,
        studentEmail,
        studentPhone,
        studentAddress,
        programId,
        studyCenterId: studyCenter.id,
        sessionId: session.id,
        status: 'document_review' as any,
        salesUserId,
        studentId: student.id,
        statusHistory: [
          {
            status: 'submitted' as any,
            actorId: 'student',
            actorName: studentName,
            timestamp: now.toISOString(),
            note: 'Student submitted application via sales invite link',
          },
          {
            status: 'document_review' as any,
            actorId: 'system',
            timestamp: now.toISOString(),
            note: 'Forwarded to Operations for document verification',
          },
        ],
      } as any,
    });
  });

  // Notify the sales user
  try {
    await prisma.notification.create({
      data: {
        organizationId: organizationId,
        userId: salesUserId,
        title: 'New Student Application',
        message: `${studentName} has submitted an application for ${program.name} via your invite link.`,
        type: 'general' as any,
        priority: 'medium',
        link: 'student-applications',
      },
    });
  } catch (err) {
    console.error('Failed to notify sales user:', err);
  }

  // Notify ops admins
  try {
    const opsAdmins = await prisma.user.findMany({
      where: { organizationId: organizationId, role: 'ops_admin' as any, status: 'active' as any },
      select: { id: true },
    });
    
    if (opsAdmins.length > 0) {
      await prisma.notification.createMany({
        data: opsAdmins.map((admin) => ({
          organizationId: organizationId,
          userId: admin.id,
          title: 'New Student Application for Review',
          message: `${studentName} has applied for ${program.name}. Please review the documents.`,
          type: 'general' as any,
          priority: 'medium',
          link: 'enrollment_review',
        })),
      });
    }
  } catch (err) { 
    console.error('Failed to notify ops admins:', err);
  }

  res.status(201).json({
    success: true,
    message: 'Application submitted successfully. You will be notified once reviewed.',
    data: { enrollmentId: enrollment.id, status: enrollment.status },
  });
});

// ─── Sales: Get all enrollments from their invite links ──────────────────────

export const getSalesEnrollmentPipeline = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = req.user.organizationId;
  const salesUserIds = new Set([req.user.id]);

  if (req.user.role === 'sales_admin') {
    let managers = [req.user.id];
    while (managers.length > 0) {
      const reports = await prisma.user.findMany({
        where: { organizationId, reportingTo: { in: managers } },
        select: { id: true },
      });
      const newReports = reports.map(user => user.id).filter(id => !salesUserIds.has(id));
      newReports.forEach(id => salesUserIds.add(id));
      managers = newReports;
    }

    const deptEmployees = await prisma.user.findMany({
      where: {
        organizationId,
        id: { not: req.user.id },
        role: { in: ['employee', 'staff', 'bde', 'sales_sub_admin', 'sales subadmin'] as any },
        OR: [
          { department: { type: { equals: 'sales', mode: 'insensitive' } } },
          { department: { name: { contains: 'sales', mode: 'insensitive' } } },
          { subDepartment: { parentDept: { type: { equals: 'sales', mode: 'insensitive' } } } },
          { subDepartment: { parentDept: { name: { contains: 'sales', mode: 'insensitive' } } } },
        ],
      },
      select: { id: true },
    });
    deptEmployees.forEach(u => salesUserIds.add(u.id));
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      organizationId: organizationId,
      salesUserId: { in: [...salesUserIds] },
      ...(req.query.status === 'ops_rejected'
        ? { status: { in: ['ops_rejected', 'department_rejected'] } }
        : req.query.status && req.query.status !== 'all'
          ? { status: String(req.query.status) }
          : {}),
    },
    include: {
      program: {
        select: {
          id: true,
          name: true,
          code: true,
          courseType: true,
          specialisations: true,
          university: { select: { id: true, name: true, code: true } }
        }
      },
      studyCenter: { select: { id: true, name: true, code: true } },
      session: { select: { id: true, name: true } },
      departmentReviewer: { select: { id: true, name: true, email: true } },
      financeReviewer: { select: { id: true, name: true, email: true } },
      salesUser: { select: { id: true, name: true, email: true } },
    } as any,
    orderBy: { createdAt: 'desc' },
  });

  // Build pipeline summary
  const summary = {
    total: enrollments.length,
    document_review: enrollments.filter(e => e.status === 'document_review' || e.status === 'pending_doc_review').length,
    finance_review: enrollments.filter(e => e.status === 'finance_review' || e.status === 'pending_finance_review').length,
    enrolled: enrollments.filter(e => e.status === 'enrolled').length,
    ops_rejected: enrollments.filter(e => e.status === 'ops_rejected' || e.status === 'department_rejected').length,
    rejected: enrollments.filter(e => e.status === 'rejected' || e.status === 'finance_rejected').length,
  };

  res.status(200).json({ success: true, count: enrollments.length, summary, data: enrollments });
});

// ─── Ops: Approve → finance_review (sales-led flow) ──────────────────────────

export const approveSalesEnrollmentOps = asyncHandler(async (req: AuthRequest, res: Response) => {
  const now = new Date();
  const enrollment = await prisma.enrollment.findUnique({ where: { id: req.params.id } });

  if (!enrollment || enrollment.organizationId !== req.user.organizationId) {
    res.status(404).json({ success: false, message: 'Enrollment not found' });
    return;
  }

  if (enrollment.status !== 'document_review') {
    res.status(409).json({ success: false, message: `Cannot approve from status: ${enrollment.status}` });
    return;
  }

  const history = ((enrollment as any).statusHistory as any[]) || [];
  history.push({
    status: 'finance_review' as any,
    actorId: req.user.id,
    actorName: req.user.name,
    actorRole: 'ops_admin',
    timestamp: now.toISOString(),
    note: 'Documents verified by Operations',
  });

  const updated = await prisma.enrollment.update({
    where: { id: req.params.id },
    data: {
      status: 'finance_review' as any,
      departmentReviewedBy: req.user.id,
      departmentReviewedAt: now,
      statusHistory: history,
    } as any,
  });

  // Notify sales user
  try {
    if ((enrollment as any).salesUserId) {
      await prisma.notification.create({
        data: {
          organizationId: req.user.organizationId,
          userId: (enrollment as any).salesUserId,
          title: 'Application Verified by Operations',
          message: `${enrollment.studentName}'s application has been verified and forwarded to Finance for payment.`,
          type: 'general' as any,
          priority: 'medium',
          link: 'student-applications',
        },
      });
    }
    // Notify finance admins
    const financeAdmins = await prisma.user.findMany({
      where: { organizationId: req.user.organizationId, role: 'finance_admin' as any, status: 'active' as any },
      select: { id: true },
    });
    if (financeAdmins.length > 0) {
      await prisma.notification.createMany({
        data: financeAdmins.map((admin) => ({
          organizationId: req.user.organizationId,
          userId: admin.id,
          title: 'Student Application Pending Payment',
          message: `${enrollment.studentName}'s application is ready for payment verification.`,
          type: 'general' as any,
          priority: 'medium',
          link: 'enrollments_finance',
        })),
      });
    }
  } catch (err) { 
    console.error('Failed to notify finance admins:', err);
  }

  res.status(200).json({ success: true, data: updated });
});

// ─── Finance: Approve → enrolled ─────────────────────────────────────────────

export const approveSalesEnrollmentFinance = asyncHandler(async (req: AuthRequest, res: Response) => {
  const now = new Date();
  const enrollment = await prisma.enrollment.findUnique({ where: { id: req.params.id } });

  if (!enrollment || enrollment.organizationId !== req.user.organizationId) {
    res.status(404).json({ success: false, message: 'Enrollment not found' });
    return;
  }

  if (enrollment.status !== 'finance_review') {
    res.status(409).json({ success: false, message: `Cannot approve from status: ${enrollment.status}` });
    return;
  }

  const existingStudentForAccess = await prisma.student.findUnique({
    where: { email: enrollment.studentEmail },
    select: { dob: true },
  });
  const dobPassword = getStudentPortalPassword(enrollment.dob)
    || getStudentPortalPassword(existingStudentForAccess?.dob);
  if (!dobPassword) {
    res.status(400).json({
      success: false,
      message: 'A valid date of birth in YYYY-MM-DD format is required before approving the enrollment',
    });
    return;
  }
  const studentPasswordHash = await bcrypt.hash(dobPassword, 12);

  const history = ((enrollment as any).statusHistory as any[]) || [];
  history.push({
    status: 'enrolled' as any,
    actorId: req.user.id,
    actorName: req.user.name,
    actorRole: 'finance_admin',
    timestamp: now.toISOString(),
    note: 'Payment verified by Finance. Student enrolled.',
  });

  // Create/find User
  let user = await prisma.user.findUnique({ where: { email: enrollment.studentEmail } });
  if (!user) {
    const userId = `STD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    user = await prisma.user.create({
      data: {
        userId,
        email: enrollment.studentEmail,
        password: studentPasswordHash,
        name: enrollment.studentName,
        role: 'student',
        organizationId: req.user.organizationId,
        status: 'inactive'
      }
    });
  }

  // Generate a fresh unique enrollment number for this enrollment record
  // Always generate new to avoid unique constraint conflicts when a student re-enrolls
  const enrollmentNo = `ENR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // Find or create Student
    let student = await prisma.student.findUnique({ where: { email: enrollment.studentEmail } });
    if (!student) {
      student = await prisma.student.create({
        data: {
          name: enrollment.studentName,
          enrollmentNo,
          phone: enrollment.studentPhone,
          address: enrollment.studentAddress,
          specialisation: enrollment.specialisation,
          abcId: enrollment.abcId,
          debId: enrollment.debId,
          dob: dobPassword,
          religion: enrollment.religion,
          caste: enrollment.caste,
          fatherName: enrollment.fatherName,
          motherName: enrollment.motherName,
          parentMobile: enrollment.parentMobile,
          studentPhoto: enrollment.studentPhoto,
          pincode: enrollment.pincode,
          alternativePhone: enrollment.alternativePhone,
          maritalStatus: enrollment.maritalStatus,
          currentlyWorking: enrollment.currentlyWorking,
          status: 'pending',
          sessionId: enrollment.sessionId,
          enrolledAt: new Date(),
          organization: { connect: { id: req.user.organizationId } },
          center: { connect: { id: enrollment.studyCenterId } },
          user: { connect: { email: enrollment.studentEmail } },
          program: { connect: { id: enrollment.programId } }
        }
      });
    } else {
      const updateData: any = {
        name: enrollment.studentName,
        phone: enrollment.studentPhone,
        address: enrollment.studentAddress,
        specialisation: enrollment.specialisation,
        abcId: enrollment.abcId,
        debId: enrollment.debId,
        dob: dobPassword,
        religion: enrollment.religion,
        caste: enrollment.caste,
        fatherName: enrollment.fatherName,
        motherName: enrollment.motherName,
        parentMobile: enrollment.parentMobile,
        studentPhoto: enrollment.studentPhoto,
        pincode: enrollment.pincode,
        alternativePhone: enrollment.alternativePhone,
        maritalStatus: enrollment.maritalStatus,
        currentlyWorking: enrollment.currentlyWorking,
        sessionId: enrollment.sessionId
      };
      if (!student.enrolledAt) {
        updateData.enrolledAt = new Date();
      }
      student = await prisma.student.update({
        where: { id: student.id },
        data: updateData
      });
    }

  const updated = await prisma.$transaction(async (tx) => {
    const activatedStudent = await tx.student.update({
      where: { id: student.id },
      data: { status: 'active', enrolledAt: student.enrolledAt || now },
    });
    await activateStudentPortalAccount(tx, {
      email: activatedStudent.email,
      name: activatedStudent.name,
      organizationId: activatedStudent.organizationId,
    }, studentPasswordHash);
    return tx.enrollment.update({
      where: { id: req.params.id },
      data: {
        status: 'enrolled' as any,
        financeReviewer: { connect: { id: req.user.id } },
        financeReviewedAt: now,
        enrolledAt: now,
        statusHistory: history,
        student: { connect: { id: student.id } },
        enrollmentNumber: enrollmentNo
      } as any,
    });
  });

  // Notify sales user
  try {
    if ((enrollment as any).salesUserId) {
      await prisma.notification.create({
        data: {
          organizationId: req.user.organizationId,
          userId: (enrollment as any).salesUserId,
          title: '🎉 Student Enrolled!',
          message: `${enrollment.studentName} has been successfully enrolled after payment verification.`,
          type: 'general' as any,
          priority: 'high',
          link: 'student-applications',
        },
      });
    }
  } catch (err) { 
    console.error('Failed to notify sales user of enrollment:', err);
  }

  res.status(200).json({ success: true, data: updated });
});

// ─── Ops/Finance: Reject ──────────────────────────────────────────────────────

export const rejectSalesEnrollment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { remarks } = req.body;
  const now = new Date();

  if (!remarks?.trim()) {
    res.status(400).json({ success: false, message: 'remarks is required for rejection' });
    return;
  }

  const enrollment = await prisma.enrollment.findUnique({ where: { id: req.params.id } });

  if (!enrollment || enrollment.organizationId !== req.user.organizationId) {
    res.status(404).json({ success: false, message: 'Enrollment not found' });
    return;
  }

  const allowedStatuses = ['document_review', 'finance_review'];
  if (!allowedStatuses.includes(enrollment.status)) {
    res.status(409).json({ success: false, message: `Cannot reject from status: ${enrollment.status}` });
    return;
  }

  const newStatus = enrollment.status === 'document_review' ? 'ops_rejected' : 'rejected';
  const history = ((enrollment as any).statusHistory as any[]) || [];
  history.push({
    status: newStatus,
    actorId: req.user.id,
    actorName: req.user.name,
    actorRole: req.user.role,
    timestamp: now.toISOString(),
    remarks,
  });

  const updated = await prisma.enrollment.update({
    where: { id: req.params.id },
    data: {
      status: newStatus,
      ...(enrollment.status === 'document_review'
        ? { departmentRemarks: remarks, departmentReviewer: { connect: { id: req.user.id } }, departmentReviewedAt: now }
        : { financeRemarks: remarks, financeReviewer: { connect: { id: req.user.id } }, financeReviewedAt: now }),
      statusHistory: history,
    } as any,
  });

  // Notify sales user
  try {
    if ((enrollment as any).salesUserId) {
      await prisma.notification.create({
        data: {
          organizationId: req.user.organizationId,
          userId: (enrollment as any).salesUserId,
          title: 'Application Rejected',
          message: `${enrollment.studentName}'s application was rejected by ${req.user.role === 'ops_admin' ? 'Operations' : 'Finance'}. Reason: ${remarks}`,
          type: 'general' as any,
          priority: 'high',
          link: 'student-applications',
        },
      });
    }
  } catch (err) {
    console.error('Failed to notify sales user of rejection:', err);
  }

  res.status(200).json({ success: true, data: updated });
});

// ─── Sales: Edit & Re-submit Operations-Rejected Enrollment ─────────────────

export const updateSalesStudentEnrollment = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!await requireSalesDepartmentStaff(req, res)) return;

  const { id } = req.params;
  const {
    studentName, studentEmail, studentPhone, studentAddress, programId, sessionId, documents, educationalDetails,
    specialisation, abcId, debId, dob, religion, caste, fatherName, motherName, parentMobile, studentPhoto,
    admissionDate, pincode, alternativePhone, maritalStatus, currentlyWorking, paymentMethod, totalFee,
  } = req.body;

  // 1. Fetch enrollment
  const enrollment = await prisma.enrollment.findUnique({
    where: { id },
    include: { student: true }
  });

  if (!enrollment || enrollment.organizationId !== req.user.organizationId) {
    res.status(404).json({ success: false, message: 'Enrollment not found' });
    return;
  }

  // 2. Security restriction: only enrollments created by sales department can be edited & re-submitted by sales
  if (!enrollment.salesUserId) {
    res.status(403).json({ success: false, message: 'Only student enrollments created by the Sales department can be edited and re-submitted' });
    return;
  }

  // Role scoping: sales employees can only edit their own or their team's enrollments
  if (!['sales_admin', 'ceo', 'org_admin'].includes(req.user.role)) {
    if (enrollment.salesUserId !== req.user.id) {
      const subordinates = await prisma.user.findMany({
        where: { organizationId: req.user.organizationId, reportingTo: req.user.id },
        select: { id: true }
      });
      const subIds = new Set(subordinates.map(s => s.id));
      if (!subIds.has(enrollment.salesUserId)) {
        res.status(403).json({ success: false, message: 'You only have permission to edit and re-submit your own or team student enrollments' });
        return;
      }
    }
  }

  // 3. Status check: must be rejected by operations department
  const isOpsRejected = ['ops_rejected', 'department_rejected'].includes(enrollment.status);
  if (!isOpsRejected) {
    res.status(400).json({ success: false, message: 'Only enrollments rejected by the Operations department can be edited and re-submitted' });
    return;
  }

  // 4. Validate fields
  if (studentName !== undefined && !studentName.trim()) {
    res.status(400).json({ success: false, message: 'Student name is required' });
    return;
  }
  if (studentEmail !== undefined && !studentEmail.trim()) {
    res.status(400).json({ success: false, message: 'Student email is required' });
    return;
  }
  if (studentPhone !== undefined && !studentPhone.trim()) {
    res.status(400).json({ success: false, message: 'Student phone is required' });
    return;
  }
  if (studentAddress !== undefined && !studentAddress.trim()) {
    res.status(400).json({ success: false, message: 'Student address is required' });
    return;
  }
  const targetAbcId = abcId ?? enrollment.abcId;
  const targetDebId = debId ?? enrollment.debId;
  if (!targetAbcId || !targetDebId) {
    res.status(400).json({ success: false, message: 'ABCID and DEBID are required' });
    return;
  }
  if (!/^\d{12}$/.test(String(targetAbcId)) || !/^\d{12}$/.test(String(targetDebId))) {
    res.status(400).json({ success: false, message: 'ABCID and DEBID must each be exactly 12 digits' });
    return;
  }

  const targetProgramId = programId || enrollment.programId;
  const targetSessionId = sessionId || enrollment.sessionId;
  const targetEmail = (studentEmail || enrollment.studentEmail).trim();

  // Validate program if changed
  if (programId && programId !== enrollment.programId) {
    const program = await prisma.program.findFirst({
      where: { id: programId, organizationId: req.user.organizationId, status: 'active', isDeleted: false },
      select: { id: true, universityId: true }
    });
    if (!program) {
      res.status(400).json({ success: false, message: 'Selected program is invalid or inactive' });
      return;
    }
  }

  // Validate session if changed
  if (sessionId && sessionId !== enrollment.sessionId) {
    const session = await prisma.admissionSession.findFirst({
      where: { id: sessionId, organizationId: req.user.organizationId, status: 'active' },
      select: { id: true, programId: true, universityId: true }
    });
    if (!session) {
      res.status(400).json({ success: false, message: 'Selected admission session is invalid or inactive' });
      return;
    }
  }

  // Check email uniqueness if email, program, or session changed
  const duplicate = await prisma.enrollment.findFirst({
    where: {
      studentEmail: targetEmail,
      programId: targetProgramId,
      sessionId: targetSessionId,
      organizationId: req.user.organizationId,
      id: { not: id }
    },
    select: { id: true }
  });
  if (duplicate) {
    res.status(409).json({ success: false, message: 'Another application with this email already exists for this program and session' });
    return;
  }

  const now = new Date();
  const history = Array.isArray(enrollment.statusHistory) ? [...enrollment.statusHistory] : [];
  history.push({
    status: 'document_review',
    actorId: req.user.id,
    actorName: req.user.name,
    actorRole: req.user.role,
    timestamp: now.toISOString(),
    note: 'Application corrected and re-submitted by Sales department to Operations for verification'
  });

  // 5. Update in interactive transaction
  const updatedEnrollment = await prisma.$transaction(async (tx) => {
    // Sync Student record if exists
    if (enrollment.studentId) {
      await tx.student.update({
        where: { id: enrollment.studentId },
        data: {
          name: studentName !== undefined ? studentName.trim() : undefined,
          email: targetEmail,
          phone: studentPhone !== undefined ? studentPhone.trim() : undefined,
          address: studentAddress !== undefined ? studentAddress.trim() : undefined,
          programId: targetProgramId,
          sessionId: targetSessionId,
          specialisation: specialisation !== undefined ? (specialisation || null) : undefined,
          abcId: abcId !== undefined ? (abcId || null) : undefined,
          debId: debId !== undefined ? (debId || null) : undefined,
          dob: dob !== undefined ? (dob || null) : undefined,
          religion: religion !== undefined ? (religion || null) : undefined,
          caste: caste !== undefined ? (caste || null) : undefined,
          fatherName: fatherName !== undefined ? (fatherName || null) : undefined,
          motherName: motherName !== undefined ? (motherName || null) : undefined,
          parentMobile: parentMobile !== undefined ? (parentMobile || null) : undefined,
          studentPhoto: studentPhoto !== undefined ? (studentPhoto || null) : undefined,
          pincode: pincode !== undefined ? (pincode || null) : undefined,
          alternativePhone: alternativePhone !== undefined ? (alternativePhone || null) : undefined,
          maritalStatus: maritalStatus !== undefined ? (maritalStatus || null) : undefined,
          currentlyWorking: currentlyWorking !== undefined ? (currentlyWorking || null) : undefined,
          status: 'pending',
        }
      });
    }

    // Sync User record name/email if user exists
    const userToUpdate = await tx.user.findFirst({
      where: { email: enrollment.studentEmail, organizationId: req.user.organizationId, role: 'student' }
    });
    if (userToUpdate) {
      await tx.user.update({
        where: { id: userToUpdate.id },
        data: {
          name: studentName !== undefined ? studentName.trim() : undefined,
          email: targetEmail,
        }
      });
    }

    // Update Enrollment details & reset status to document_review for Operations review
    return tx.enrollment.update({
      where: { id },
      data: {
        studentName: studentName !== undefined ? studentName.trim() : enrollment.studentName,
        studentEmail: targetEmail,
        studentPhone: studentPhone !== undefined ? studentPhone.trim() : enrollment.studentPhone,
        studentAddress: studentAddress !== undefined ? studentAddress.trim() : enrollment.studentAddress,
        programId: targetProgramId,
        sessionId: targetSessionId,
        specialisation: specialisation !== undefined ? (specialisation || null) : enrollment.specialisation,
        abcId: abcId !== undefined ? (abcId || null) : enrollment.abcId,
        debId: debId !== undefined ? (debId || null) : enrollment.debId,
        dob: dob !== undefined ? (dob || null) : enrollment.dob,
        religion: religion !== undefined ? (religion || null) : enrollment.religion,
        caste: caste !== undefined ? (caste || null) : enrollment.caste,
        fatherName: fatherName !== undefined ? (fatherName || null) : enrollment.fatherName,
        motherName: motherName !== undefined ? (motherName || null) : enrollment.motherName,
        parentMobile: parentMobile !== undefined ? (parentMobile || null) : enrollment.parentMobile,
        studentPhoto: studentPhoto !== undefined ? (studentPhoto || null) : enrollment.studentPhoto,
        pincode: pincode !== undefined ? (pincode || null) : enrollment.pincode,
        alternativePhone: alternativePhone !== undefined ? (alternativePhone || null) : enrollment.alternativePhone,
        maritalStatus: maritalStatus !== undefined ? (maritalStatus || null) : enrollment.maritalStatus,
        currentlyWorking: currentlyWorking !== undefined ? (currentlyWorking || null) : enrollment.currentlyWorking,
        admissionDate: admissionDate ? new Date(admissionDate) : enrollment.admissionDate,
        documents: documents ? (typeof documents === 'string' ? JSON.parse(documents) : documents) : enrollment.documents,
        educationalDetails: educationalDetails ? (typeof educationalDetails === 'string' ? JSON.parse(educationalDetails) : educationalDetails) : enrollment.educationalDetails,
        paymentMethod: paymentMethod || enrollment.paymentMethod,
        totalFee: totalFee !== undefined ? (totalFee ? Number(totalFee) : null) : enrollment.totalFee,
        status: 'document_review', // Return to Operations review queue
        departmentRemarks: null, // Clear the rejection remarks on resubmission
        statusHistory: history,
      },
      include: {
        program: { select: { id: true, name: true, code: true, courseType: true, specialisations: true } },
        studyCenter: { select: { id: true, name: true, code: true } },
        session: { select: { id: true, name: true } },
        departmentReviewer: { select: { id: true, name: true, email: true } },
        financeReviewer: { select: { id: true, name: true, email: true } },
        salesUser: { select: { id: true, name: true, email: true } },
      }
    });
  });

  // 6. Notify Operations Users of the re-submission
  try {
    const opsUsers = await prisma.user.findMany({
      where: {
        organizationId: req.user.organizationId,
        status: 'active' as any,
        OR: [
          { role: { in: ['ops_admin', 'ops_sub_admin'] } as any },
          ...(enrollment.departmentReviewedBy ? [{ id: enrollment.departmentReviewedBy }] : []),
          ...(enrollment.assignedOpsUserId ? [{ id: enrollment.assignedOpsUserId }] : [])
        ]
      },
      select: { id: true }
    });

    const uniqueOpsIds = Array.from(new Set(opsUsers.map(u => u.id)));
    if (uniqueOpsIds.length > 0) {
      await prisma.notification.createMany({
        data: uniqueOpsIds.map(userId => ({
          organizationId: req.user.organizationId,
          userId,
          title: '📄 Enrollment Re-submitted by Sales',
          message: `Enrollment for ${updatedEnrollment.studentName} was updated and re-submitted by Sales (${req.user.name}). Ready for Operations review.`,
          type: 'general' as any,
          priority: 'medium' as any,
          link: 'enrollment_review'
        }))
      });
    }
  } catch (notifErr) {
    console.error('Notification dispatch failed:', notifErr);
  }

  res.status(200).json({
    success: true,
    message: 'Enrollment updated and re-submitted to Operations successfully',
    data: updatedEnrollment
  });
});
