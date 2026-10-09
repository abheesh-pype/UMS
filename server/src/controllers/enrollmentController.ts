// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import bcrypt from 'bcryptjs';

export const getWallet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const centerId = req.user.studyCenterId || '';
  const [wallet, totalEnrollments, pendingReview] = await Promise.all([
    prisma.studyCenterWallet.findUnique({ where: { studyCenterId: centerId } }),
    prisma.enrollment.count({ where: { studyCenterId: centerId } }),
    prisma.enrollment.count({
      where: {
        studyCenterId: centerId,
        status: { in: ['document_review', 'dept_review', 'finance_review'] }
      }
    })
  ]);

  res.json({
    success: true,
    data: {
      ...(wallet || {}),
      balance: wallet?.balance || 0,
      totalEnrollments,
      pendingReview
    }
  });
});

export const submitTopUp = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data: any = {
    ...req.body,
    amount: Number(req.body.amount),
    studyCenterId: req.user.studyCenterId || '',
    organizationId: req.user.organizationId,
  };
  
  if (req.file) {
    data.proofDocument = `/uploads/${req.file.filename}`;
  }

  const topUp = await prisma.walletTopUp.create({ data });
  res.status(201).json({ success: true, data: topUp });
});

export const getTopUpHistory = asyncHandler(async (req: AuthRequest, res: Response) => {
  const topUps = await prisma.walletTopUp.findMany({ where: { studyCenterId: req.user.studyCenterId || '' } });
  res.json({ success: true, count: topUps.length, data: topUps });
});

export const getWalletTransactions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const centerId = req.user.studyCenterId || '';

  // Get approved top-ups
  const topUps = await prisma.walletTopUp.findMany({
    where: { studyCenterId: centerId, status: 'approved' },
    orderBy: { createdAt: 'desc' }
  });

  // Get enrollment debits
  const debits = await prisma.enrollmentPayment.findMany({
    where: { studyCenterId: centerId },
    include: {
      enrollment: {
        include: {
          program: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Get student invoices paid by center wallet
  const studentInvoices = await prisma.invoice.findMany({
    where: { 
      centerId, 
      studentId: { not: null },
      status: 'paid'
    },
    include: {
      student: {
        include: {
          program: true
        }
      }
    },
    orderBy: { paidAt: 'desc' }
  });

  // Map into a unified ledger structure
  const ledger = [
    ...topUps.map(t => ({
      id: t.id,
      date: t.verifiedAt || t.createdAt,
      type: 'credit',
      amount: t.amount,
      method: t.paymentMethod,
      reference: t.referenceNumber || 'N/A',
      description: 'Wallet Top-Up Approved'
    })),
    ...debits.map(d => ({
      id: d.id,
      date: d.debitedAt || d.createdAt,
      type: 'debit',
      amount: d.amount,
      method: 'wallet_debit',
      reference: d.enrollment?.enrollmentNumber || 'N/A',
      description: `Enrollment: ${d.enrollment?.studentName || 'Student'} (${d.enrollment?.program?.name || 'Program'})`
    })),
    ...studentInvoices.map(inv => ({
      id: inv.id,
      date: inv.paidAt || inv.createdAt,
      type: 'debit',
      amount: inv.total,
      method: 'wallet_debit',
      reference: inv.invoiceNo,
      description: `Student Fee: ${inv.student?.name || 'Student'} (${inv.student?.program?.name || 'Program'}) - ${inv.items?.[0]?.description || 'Installment'}`
    }))
  ];

  // Sort by date descending
  ledger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  res.json({ success: true, count: ledger.length, data: ledger });
});

export const getEnrollablePrograms = asyncHandler(async (req: AuthRequest, res: Response) => {
  const where: any = {
    organizationId: req.user.organizationId,
    universityId: req.user.universityId,
    status: 'active' as any
  };
  const center = req.user.studyCenterId
    ? await prisma.studyCenter.findUnique({
        where: { id: req.user.studyCenterId },
        select: { universityIds: true }
      })
    : null;
  const isLinkedToPrimaryUniversity = center?.universityIds?.includes(req.user.universityId);
  
  if (req.user.studyCenterId) {
    where.OR = [
      ...(isLinkedToPrimaryUniversity ? [{ universityId: req.user.universityId }] : []),
      {
        programAllocations: {
          some: {
            centerId: req.user.studyCenterId,
            isActive: true
          }
        }
      },
      {
        university: {
          universityAllocations: {
            some: {
              centerId: req.user.studyCenterId,
              isActive: true
            }
          }
        }
      }
    ];
  }

  const programs = await prisma.program.findMany({
    where,
    include: {
      university: { select: { id: true, name: true, code: true, category: true, optionalFields: true } },
      programFeeStructure: {
        where: {
          organizationId: req.user.organizationId
        }
      }
    }
  });
  res.json({ success: true, count: programs.length, data: programs });
});

export const checkEmailUniqueness = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { studentEmail, programId, sessionId } = req.body;
  if (!studentEmail || !programId || !sessionId) {
    res.json({ success: false, isUnique: false, message: 'Missing parameters' });
    return;
  }

  const existing = await prisma.enrollment.findFirst({
    where: {
      studentEmail,
      programId,
      sessionId,
      organizationId: req.user.organizationId,
      status: { not: 'rejected' } // Only count active/pending applications
    }
  });

  if (existing) {
    res.json({ success: true, isUnique: false, message: 'An application with this email already exists for this program and session' });
  } else {
    res.json({ success: true, isUnique: true });
  }
});

export const createEnrollment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { 
    studentName, studentEmail, studentPhone, studentAddress, programId, documents, educationalDetails, sessionId, specialisation,
    abcId, debId, dob, religion, caste, fatherName, motherName, parentMobile, studentPhoto, admissionDate,
    pincode, alternativePhone, maritalStatus, currentlyWorking, paymentMethod, totalFee
  } = req.body;
  const organizationId = req.user.organizationId;
  const studyCenterId = req.user.studyCenterId || req.body.studyCenterId || null;

  if (!studentName || !studentEmail || !studentPhone || !studentAddress || !programId) {
    res.status(400).json({ success: false, message: 'Missing required fields' });
    return;
  }
  if (req.user.role === 'center_admin' && !studyCenterId) {
    res.status(400).json({ success: false, message: 'No study center assigned to your account' });
    return;
  }

  let selectedProgram: any = null;
  if (studyCenterId) {
    const linkedCenter = await prisma.studyCenter.findUnique({
      where: { id: studyCenterId },
      select: { universityIds: true }
    });
    const isLinkedToPrimaryUniversity = linkedCenter?.universityIds?.includes(req.user.universityId);

    selectedProgram = await prisma.program.findFirst({
      where: {
        id: programId,
        organizationId,
        universityId: req.user.universityId,
        status: 'active' as any,
        OR: [
          ...(isLinkedToPrimaryUniversity ? [{ universityId: req.user.universityId }] : []),
          {
            programAllocations: {
              some: { centerId: studyCenterId, isActive: true }
            }
          },
          {
            university: {
              universityAllocations: {
                some: { centerId: studyCenterId, isActive: true }
              }
            }
          }
        ]
      },
      select: { id: true, universityId: true }
    });

    if (!selectedProgram) {
      res.status(403).json({ success: false, message: 'This program is not allocated to the selected study center' });
      return;
    }
  } else {
    selectedProgram = await prisma.program.findFirst({
      where: {
        id: programId,
        organizationId,
        universityId: req.user.universityId,
        status: 'active' as any,
      },
      select: { id: true, universityId: true }
    });

    if (!selectedProgram) {
      res.status(404).json({ success: false, message: 'Selected program is invalid or inactive' });
      return;
    }
  }

  // Form customisation validation (if center-based)
  let center: any = null;
  if (studyCenterId) {
    center = await prisma.studyCenter.findUnique({
      where: { id: studyCenterId }
    });
    if (center?.customEnrollmentFields) {
      const config = typeof center.customEnrollmentFields === 'string' 
        ? JSON.parse(center.customEnrollmentFields) 
        : center.customEnrollmentFields;
      if (config && typeof config === 'object' && !Array.isArray(config)) {
        for (const [field, requirement] of Object.entries(config)) {
          if (requirement === 'required') {
            if (field.startsWith('doc_')) {
              const docMap: any = { doc_aadhaar: 'Aadhaar Card', doc_10th: '10th Certificate', doc_12th: '12th Certificate', doc_degree: 'Degree Certificate' };
              const reqName = docMap[field];
              const docs = req.body.documents || [];
              if (!docs.some((d: any) => d.reqName === reqName)) {
                res.status(400).json({ success: false, message: `Document '${reqName}' is required by this center's configuration` });
                return;
              }
              continue;
            }
            const val = req.body[field];
            if (val === undefined || val === null || String(val).trim() === '') {
              res.status(400).json({ success: false, message: `Field '${field}' is required by this center's configuration` });
              return;
            }
          }
        }
      }
    }
  }

  let finalSessionId = sessionId;

  if (finalSessionId) {
    const chosenSession = await prisma.admissionSession.findFirst({
      where: {
        id: finalSessionId,
        organizationId,
        status: 'active',
        AND: [
          { OR: [{ programId }, { programId: null }] },
          { OR: [{ universityId: req.user.universityId }, { universityId: null }] }
        ]
      }
    });
    if (!chosenSession) {
      res.status(400).json({ success: false, message: 'Selected admission session is invalid or inactive' });
      return;
    }
  } else {
    // Auto-find the active admission session for this program/org
    const session = await prisma.admissionSession.findFirst({
      where: {
        organizationId,
        status: 'active',
        AND: [
          { OR: [{ programId }, { programId: null }] },
          { OR: [{ universityId: req.user.universityId }, { universityId: null }] }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!session) {
      res.status(400).json({ success: false, message: 'No active admission session found for this program. Please contact admin.' });
      return;
    }
    finalSessionId = session.id;
  }

  // Check for duplicate email in same program+session
  const existing = await prisma.enrollment.findFirst({
    where: { studentEmail, programId, sessionId: finalSessionId, organizationId }
  });
  if (existing) {
    res.status(400).json({ success: false, message: 'An application with this email already exists for this program and session' });
    return;
  }

  // Hashing is CPU-bound and must happen outside the interactive transaction.
  const defaultStudentPasswordHash = await bcrypt.hash('password123', 10);

  const enrollment = await prisma.$transaction(async (tx) => {
    // 1. Create or find User
    let user = await tx.user.findUnique({ where: { email: studentEmail } });
    if (!user) {
      const userId = `STD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      user = await tx.user.create({
        data: {
          userId,
          email: studentEmail,
          password: defaultStudentPasswordHash,
          name: studentName,
          role: 'student',
          organizationId: organizationId,
          status: 'active'
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
          specialisation,
          sessionId: finalSessionId,
          abcId,
          debId,
          dob,
          religion,
          caste,
          fatherName,
          motherName,
          parentMobile,
          studentPhoto,
          pincode,
          alternativePhone,
          maritalStatus,
          currentlyWorking,
          status: 'pending',
          organization: { connect: { id: organizationId } },
          center: studyCenterId ? { connect: { id: studyCenterId } } : undefined,
          user: { connect: { email: studentEmail } },
          program: { connect: { id: programId } }
        }
      });
    }

    // 3. Create Enrollment
    return tx.enrollment.create({
      data: {
        studentName,
        studentEmail,
        studentPhone,
        studentAddress,
        specialisation,
        abcId,
        debId,
        dob,
        religion,
        caste,
        fatherName,
        motherName,
        parentMobile,
        studentPhoto,
        pincode,
        alternativePhone,
        maritalStatus,
        currentlyWorking,
        admissionDate: admissionDate ? new Date(admissionDate) : new Date(),
        status: 'pending_doc_review',
        documents: documents ? (typeof documents === 'string' ? JSON.parse(documents) : documents) : [],
        educationalDetails: educationalDetails ? (typeof educationalDetails === 'string' ? JSON.parse(educationalDetails) : educationalDetails) : [],
        paymentMethod: paymentMethod || 'installment',
        totalFee: totalFee ? Number(totalFee) : null,
        organization: { connect: { id: organizationId } },
        program:      { connect: { id: programId } },
        studyCenter:  studyCenterId ? { connect: { id: studyCenterId } } : undefined,
        session:      { connect: { id: finalSessionId } },
        student:      { connect: { id: student.id } },
      }
    });
  }, { timeout: 15000 });

  // Notify Operations Users
  try {
    const opsUsers = await prisma.user.findMany({
      where: { 
        organizationId,
        OR: [
          { role: { in: ['ops_admin', 'ops_sub_admin'] } as any },
          { role: 'employee' as any, department: { type: 'operations' } }
        ]
      }
    });
    
    // Fetch program details for the message
    const prog = await prisma.program.findUnique({ where: { id: programId } });
    const programName = prog ? prog.name : '';
    const centerNameText = center ? `by ${center.name} ` : 'via Direct Admission ';

    // Batch create notifications in a single DB call instead of N+1 loop
    await prisma.notification.createMany({
      data: opsUsers.map(opUser => ({
        organizationId,
        userId: opUser.id,
        title: '📄 New Enrollment Pending Verification',
        message: `A new enrollment for ${studentName} has been submitted ${centerNameText}for ${programName}.`,
        type: 'general' as any,
        priority: 'medium' as any,
        link: 'enrollment_review'
      }))
    });
  } catch (notifErr) { console.error('Notification dispatch failed:', notifErr); }

  res.status(201).json({ success: true, data: enrollment });
});


export const getMyEnrollments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status } = req.query;
  const where: any = { studyCenterId: req.user.studyCenterId || '' };

  if (status) {
    where.status = status as string;
  }

  const enrollments = await prisma.enrollment.findMany({
    where,
    include: {
      program: {
        include: { university: { select: { name: true, code: true } } }
      },
      session: {
        select: { name: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ success: true, count: enrollments.length, data: enrollments });
});

export const getMyCenterStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const center = await prisma.studyCenter.findUnique({ where: { id: req.user.studyCenterId || '' } });
  if (!center) {
    res.status(404).json({ success: false, message: 'Study center not found' });
    return;
  }

  const centerAdminUniversityId = req.user.universityId || null;
  const universityIds = center.universityIds?.length
    ? center.universityIds
    : (centerAdminUniversityId ? [centerAdminUniversityId] : []);

  const universities = await prisma.university.findMany({
    where: { id: { in: universityIds }, organizationId: req.user.organizationId, singletonKey: 'primary' },
    select: { id: true, name: true, code: true }
  });
  const authFees = await prisma.universityAuthFee.findMany({
    where: { organizationId: req.user.organizationId, universityId: { in: universityIds } },
    select: { universityId: true, feeDetails: true }
  });
  const feeByUniversity = new Map(authFees.map(fee => {
    const details = (fee.feeDetails as any) || {};
    return [fee.universityId, Number(details.amount) || 0];
  }));

  res.json({
    success: true,
    data: {
      ...center,
      centerId: center.id,
      centerName: center.name,
      universities: universities.map(university => ({
        ...university,
        fee: feeByUniversity.get(university.id) ?? null
      })),
      totalFee: universities.reduce((total, university) => total + (feeByUniversity.get(university.id) || 0), 0)
    }
  });
});

export const submitMyCenterPayment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const centerId = req.user.studyCenterId;
  if (!centerId) {
    res.status(400).json({ success: false, message: 'No study center assigned to your account' });
    return;
  }
  if (!req.file) {
    res.status(400).json({ success: false, message: 'Payment proof file is required' });
    return;
  }

  const center = await prisma.studyCenter.update({
    where: { id: centerId },
    data: {
      status: 'pending_payment' as any,
      paymentProof: {
        url: `/uploads/${req.file.filename}`,
        uploadedAt: new Date().toISOString(),
        remarks: req.body.remarks || ''
      },
      paymentRemarks: req.body.remarks || null
    }
  });
  res.json({ success: true, message: 'Payment submitted', data: center });
});

export const getAllEnrollments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const where: any = { organizationId: req.user.organizationId };

  // Scoping for Sales users: only show admissions from centers they manually added/referred
  if (['sales_admin', 'bde'].includes(req.user.role)) {
    where.studyCenter = { referredBy: req.user.id };
  }

  const enrollments = await prisma.enrollment.findMany({
    where,
    include: {
      studyCenter: { select: { name: true, code: true, referredBy: true } },
      program: {
        include: { university: { select: { name: true, code: true } } }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ success: true, count: enrollments.length, data: enrollments });
});

export const getActiveSessions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const programId = req.query.programId as string | undefined;
  const where: any = {
    organizationId: req.user.organizationId,
    status: 'active'
  };

  if (programId) {
    const program = await prisma.program.findFirst({
      where: {
        id: programId,
        organizationId: req.user.organizationId,
        universityId: req.user.universityId,
        status: 'active' as any
      },
      select: { id: true }
    });
    if (!program) {
      res.status(404).json({ success: false, message: 'Selected program is invalid or inactive' });
      return;
    }

    where.AND = [
        { OR: [{ programId: program.id }, { programId: null }] },
        { OR: [{ universityId: req.user.universityId }, { universityId: null }] }
    ];
  } else {
    where.OR = [
      { universityId: req.user.universityId },
      { universityId: null, program: { universityId: req.user.universityId } },
      { universityId: null, programId: null }
    ];
  }

  const sessions = await prisma.admissionSession.findMany({
    where,
    orderBy: { name: 'asc' }
  });
  res.json({ success: true, count: sessions.length, data: sessions });
});

export const updateEnrollment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { 
    studentName, studentEmail, studentPhone, studentAddress, programId, documents, educationalDetails, sessionId, specialisation,
    abcId, debId, dob, religion, caste, fatherName, motherName, parentMobile, studentPhoto, admissionDate,
    pincode, alternativePhone, maritalStatus, currentlyWorking
  } = req.body;
  const organizationId = req.user.organizationId;
  const studyCenterId = req.user.studyCenterId;

  if (!studyCenterId) {
    res.status(400).json({ success: false, message: 'No study center assigned to your account' });
    return;
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { id, studyCenterId }
  });

  if (!enrollment) {
    res.status(404).json({ success: false, message: 'Enrollment not found' });
    return;
  }

  if (enrollment.status !== 'rejected') {
    res.status(400).json({ success: false, message: 'Only rejected enrollments can be edited and re-submitted' });
    return;
  }

  // Form customisation validation
  const center = await prisma.studyCenter.findUnique({
    where: { id: studyCenterId }
  });
  if (center?.customEnrollmentFields) {
    const config = typeof center.customEnrollmentFields === 'string' 
      ? JSON.parse(center.customEnrollmentFields) 
      : center.customEnrollmentFields;
    if (config && typeof config === 'object' && !Array.isArray(config)) {
      for (const [field, requirement] of Object.entries(config)) {
        if (requirement === 'required') {
          if (field.startsWith('doc_')) {
            const docMap: any = { doc_aadhaar: 'Aadhaar Card', doc_10th: '10th Certificate', doc_12th: '12th Certificate', doc_degree: 'Degree Certificate' };
            const reqName = docMap[field];
            const docs = req.body.documents || (enrollment as any).documents || [];
            if (!docs.some((d: any) => d.reqName === reqName)) {
              res.status(400).json({ success: false, message: `Document '${reqName}' is required by this center's configuration` });
              return;
            }
            continue;
          }
          const val = req.body[field] !== undefined ? req.body[field] : (enrollment as any)[field];
          if (val === undefined || val === null || String(val).trim() === '') {
            res.status(400).json({ success: false, message: `Field '${field}' is required by this center's configuration` });
            return;
          }
        }
      }
    }
  }

  let finalSessionId = sessionId || enrollment.sessionId;
  const targetProgramId = programId || enrollment.programId;

  // Check for duplicate email in same program+session (excluding this enrollment)
  const existing = await prisma.enrollment.findFirst({
    where: {
      studentEmail: studentEmail || enrollment.studentEmail,
      programId: targetProgramId,
      sessionId: finalSessionId,
      organizationId,
      id: { not: id }
    }
  });
  if (existing) {
    res.status(400).json({ success: false, message: 'An application with this email already exists for this program and session' });
    return;
  }

  // Update enrollment details and change status back to document_review
  const updatedEnrollment = await prisma.enrollment.update({
    where: { id },
    data: {
      studentName: studentName !== undefined ? studentName : enrollment.studentName,
      studentEmail: studentEmail !== undefined ? studentEmail : enrollment.studentEmail,
      studentPhone: studentPhone !== undefined ? studentPhone : enrollment.studentPhone,
      studentAddress: studentAddress !== undefined ? studentAddress : enrollment.studentAddress,
      specialisation: specialisation !== undefined ? specialisation : enrollment.specialisation,
      abcId: abcId !== undefined ? abcId : enrollment.abcId,
      debId: debId !== undefined ? debId : enrollment.debId,
      dob: dob !== undefined ? dob : enrollment.dob,
      religion: religion !== undefined ? religion : enrollment.religion,
      caste: caste !== undefined ? caste : enrollment.caste,
      fatherName: fatherName !== undefined ? fatherName : enrollment.fatherName,
      motherName: motherName !== undefined ? motherName : enrollment.motherName,
      parentMobile: parentMobile !== undefined ? parentMobile : enrollment.parentMobile,
      studentPhoto: studentPhoto !== undefined ? studentPhoto : enrollment.studentPhoto,
      pincode: pincode !== undefined ? pincode : enrollment.pincode,
      alternativePhone: alternativePhone !== undefined ? alternativePhone : enrollment.alternativePhone,
      maritalStatus: maritalStatus !== undefined ? maritalStatus : enrollment.maritalStatus,
      currentlyWorking: currentlyWorking !== undefined ? currentlyWorking : enrollment.currentlyWorking,
      admissionDate: admissionDate !== undefined ? (admissionDate ? new Date(admissionDate) : null) : enrollment.admissionDate,
      programId: targetProgramId,
      sessionId: finalSessionId,
      status: 'pending_doc_review',
      departmentRemarks: null, // Clear remarks since it is re-submitted
      documents: documents ? (typeof documents === 'string' ? JSON.parse(documents) : documents) : enrollment.documents,
      educationalDetails: educationalDetails ? (typeof educationalDetails === 'string' ? JSON.parse(educationalDetails) : educationalDetails) : enrollment.educationalDetails,
    }
  });

  res.status(200).json({ success: true, data: updatedEnrollment });
});

export const processPaymentStage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { paymentType, emiDetails, paymentProof } = req.body;

  const dbEnrollment = await prisma.enrollment.findUnique({
    where: { id },
    include: { program: { include: { university: true } } }
  });

  if (!dbEnrollment) {
    res.status(404).json({ success: false, message: 'Enrollment not found' });
    return;
  }

  if (dbEnrollment.status !== 'payment_pending') {
    res.status(400).json({ success: false, message: 'Enrollment is not in payment pending stage' });
    return;
  }

  const category = (dbEnrollment.program.university as any).category || 'team_lease';

  if (category === 'direct_iits' && paymentType === 'wallet') {
    // Determine fee
    let feeStructure = await prisma.programFeeStructure.findFirst({
      where: {
        organizationId: req.user.organizationId,
        programId: dbEnrollment.programId,
        admissionSessionId: dbEnrollment.sessionId,
        level: 'program'
      }
    });

    if (!feeStructure) {
      feeStructure = await prisma.programFeeStructure.findFirst({
        where: { organizationId: req.user.organizationId, programId: dbEnrollment.programId }
      });
    }

    if (!feeStructure) {
      res.status(400).json({ success: false, message: 'Program fee structure is not configured' });
      return;
    }

    const addFees = Array.isArray(feeStructure.additionalFees) ? feeStructure.additionalFees : [];
    const nonGstFees = addFees.filter((f: any) => f.label !== 'GST');
    const additionalFeesTotal = nonGstFees.reduce((s: number, f: any) => s + f.amount, 0);

    let breakdowns = (feeStructure as any).feeBreakdown;
    if (typeof breakdowns === 'string') {
      try { breakdowns = JSON.parse(breakdowns); } catch (e) { breakdowns = []; }
    }

    let subtotal = 0;
    if (breakdowns && Array.isArray(breakdowns) && breakdowns.length > 0) {
      const b = breakdowns[0];
      let breakdownAdditionalFeesTotal = 0;
      if (typeof b.additionalFees === 'string' && b.additionalFees.trim() !== '') {
        const custom = b.additionalFees.split(',').map((s: string) => {
          const parts = s.trim().split(':');
          return Number(parts[1]) || 0;
        });
        breakdownAdditionalFeesTotal = custom.reduce((sum: number, val: number) => sum + val, 0);
      }
      subtotal = Number(b.baseFee || 0) + Number(b.examFee || 0) + additionalFeesTotal + breakdownAdditionalFeesTotal;
    } else {
      subtotal = feeStructure.baseFee + additionalFeesTotal;
    }

    const gstEntry = addFees.find((f: any) => f.label === 'GST');
    const gstAmount = gstEntry ? Math.round((subtotal * gstEntry.amount) / 100) : 0;
    const totalFee = (dbEnrollment as any).totalFee || (subtotal + gstAmount);

    await prisma.$transaction(async (tx) => {
      const wallet = await tx.studyCenterWallet.findUnique({
        where: { studyCenterId: dbEnrollment.studyCenterId }
      });

      if (!wallet || wallet.balance < totalFee) {
        throw new Error(`Insufficient wallet balance. Required: ₹${totalFee}`);
      }

      await tx.studyCenterWallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: totalFee } }
      });

      await tx.enrollmentPayment.create({
        data: {
          enrollmentId: dbEnrollment.id,
          studyCenterId: dbEnrollment.studyCenterId,
          walletId: wallet.id,
          amount: totalFee
        }
      });

      await tx.enrollment.update({
        where: { id },
        data: {
          status: 'pending_finance_review',
          paymentType: 'wallet'
        }
      });
    });

  } else if (category === 'premium') {
    await prisma.enrollment.update({
      where: { id },
      data: {
        status: 'pending_finance_review',
        paymentType: paymentType || 'direct_to_university',
        emiDetails: emiDetails || null,
        documents: paymentProof ? [
          ...(Array.isArray(dbEnrollment.documents) ? dbEnrollment.documents : []),
          { reqName: 'Payment Proof', url: paymentProof }
        ] : dbEnrollment.documents
      }
    });
  } else {
    res.status(400).json({ success: false, message: 'Invalid payment stage operation for this category' });
    return;
  }

  res.json({ success: true, message: 'Payment stage completed' });
});
