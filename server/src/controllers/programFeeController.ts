// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getProgramFees = asyncHandler(async (req: AuthRequest, res: Response) => {
  const fees = await prisma.programFeeStructure.findMany({
    where: { organizationId: req.user.organizationId },
    include: { 
      program: true,
      university: true,
      admissionSession: true
    }
  });
  const mapped = fees.map(fee => ({
    ...fee,
    programId: fee.program || fee.programId,
    effectiveFrom: fee.createdAt
  }));
  res.json({ success: true, count: mapped.length, data: mapped });
});

export const getProgramFee = asyncHandler(async (req: AuthRequest, res: Response) => {
  const fee = await prisma.programFeeStructure.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId },
    include: { 
      program: true,
      university: true,
      admissionSession: true
    }
  });
  if (fee) {
    const mapped = {
      ...fee,
      programId: fee.program || fee.programId,
      effectiveFrom: fee.createdAt
    };
    res.json({ success: true, data: mapped });
  } else {
    res.status(404).json({ success: false, message: 'Program fee structure not found' });
  }
});

// Older university configurations only send a billing-cycle breakdown; validate the payment options when they are sent
const getUniversityPaymentOptionsError = (level: string, fullProgramFee: unknown, yearlyFee: unknown, semesterFees: unknown) => {
  if (level !== 'university' || yearlyFee === undefined || yearlyFee === null) return null;
  if (![fullProgramFee, yearlyFee].every(value => Number.isFinite(Number(value)) && Number(value) > 0)) {
    return 'Full program and yearly university fees must both be greater than zero';
  }
  if (semesterFees !== undefined && (
    !Array.isArray(semesterFees)
    || !semesterFees.every(value => Number.isFinite(Number(value)) && Number(value) > 0)
  )) {
    return 'Every semester university fee must be greater than zero';
  }
  return null;
};

export const createProgramFee = asyncHandler(async (req: AuthRequest, res: Response) => {
  const {
    level,
    programId,
    studyCenterId,
    universityId,
    admissionSessionId,
    billingCycle,
    baseFee,
    fullProgramFee,
    yearlyFee,
    semesterFee,
    semesterFees,
    universityFee,
    additionalFees,
    commissionRate,
    currency,
    feeBreakdown
  } = req.body;

  if (!['program', 'university'].includes(level)) {
    res.status(400).json({ success: false, message: 'Fee configuration level must be program or university' });
    return;
  }

  if (level === 'program' && !programId) {
    res.status(400).json({ success: false, message: 'A program is required for a study-centre fee configuration' });
    return;
  }
  if (level === 'university' && (!universityId || !programId)) {
    res.status(400).json({ success: false, message: 'A university and program are required for a university fee configuration' });
    return;
  }
  if (level === 'program' && !studyCenterId) {
    res.status(400).json({ success: false, message: 'A study centre is required for a program fee configuration' });
    return;
  }
  if (level === 'university' && studyCenterId) {
    res.status(400).json({ success: false, message: 'University fee configurations cannot be assigned to a study centre' });
    return;
  }
  if (level === 'program' && ![fullProgramFee, yearlyFee]
    .every(value => Number.isFinite(Number(value)) && Number(value) > 0)) {
    res.status(400).json({ success: false, message: 'Full program and yearly fees must both be greater than zero' });
    return;
  }
  // University fees configured with the one-time / yearly / semester form
  const universityPaymentOptionsError = getUniversityPaymentOptionsError(level, fullProgramFee, yearlyFee, semesterFees);
  if (universityPaymentOptionsError) {
    res.status(400).json({ success: false, message: universityPaymentOptionsError });
    return;
  }

  const program = await prisma.program.findFirst({
    where: { id: programId, organizationId: req.user.organizationId, isDeleted: false },
    select: { id: true, universityId: true },
  });
  if (!program) {
    res.status(404).json({ success: false, message: 'Program not found in this organization' });
    return;
  }

  if (level === 'university' && program.universityId !== universityId) {
    res.status(400).json({ success: false, message: 'The selected program does not belong to this university' });
    return;
  }
  const semesterCount = level === 'program' && admissionSessionId
    ? await prisma.semester.count({
        where: {
          organizationId: req.user.organizationId,
          programId,
          academicSessionId: admissionSessionId,
        },
      })
    : 0;
  const configuredSemesterFees = semesterFees === undefined
    ? Array.from({ length: semesterCount }, () => Number(semesterFee))
    : semesterFees;
  if (level === 'program' && (
    !Array.isArray(configuredSemesterFees)
    || configuredSemesterFees.length !== semesterCount
    || !configuredSemesterFees.every(value => Number.isFinite(Number(value)) && Number(value) > 0)
  )) {
    res.status(400).json({ success: false, message: `Provide a positive fee for each of the ${semesterCount} semesters` });
    return;
  }

  if (admissionSessionId) {
    const session = await prisma.admissionSession.findFirst({
      where: {
        id: admissionSessionId,
        organizationId: req.user.organizationId,
        OR: [{ programId }, { programId: null }],
      },
      select: { id: true, universityId: true },
    });
    if (!session || (session.universityId && session.universityId !== program.universityId)) {
      res.status(400).json({ success: false, message: 'The admission session is not available for this program' });
      return;
    }
  }

  if (studyCenterId) {
    const center = await prisma.studyCenter.findFirst({
      where: {
        id: studyCenterId,
        organizationId: req.user.organizationId,
        OR: [
          {
            programAllocations: {
              some: {
                organizationId: req.user.organizationId,
                programId,
                isActive: true,
                OR: [
                  { admissionSessionId: admissionSessionId || null },
                  { admissionSessionId: null },
                ],
              },
            },
          },
          { programIds: { has: programId } },
        ],
      },
      select: { id: true },
    });
    if (!center) {
      res.status(400).json({ success: false, message: 'The program is not actively allocated to this study centre' });
      return;
    }
  }

  const existing = await prisma.programFeeStructure.findFirst({
    where: {
      organizationId: req.user.organizationId,
      level,
      programId,
      studyCenterId: level === 'program' ? studyCenterId : null,
      universityId: level === 'university' ? universityId : program.universityId,
      admissionSessionId: admissionSessionId || null,
    }
  });
  if (existing) {
    res.status(400).json({
      success: false,
      message: level === 'program'
        ? 'A fee structure already exists for this study centre, program, and session. Edit the existing one.'
        : 'A university fee structure already exists for this university, program, and session. Edit the existing one.'
    });
    return;
  }

  const fee = await prisma.programFeeStructure.create({
    data: {
      level,
      programId,
      studyCenterId: level === 'program' ? studyCenterId : null,
      universityId: level === 'university' ? universityId : program.universityId,
      admissionSessionId: admissionSessionId || null,
      billingCycle,
      baseFee: level === 'program' ? parseFloat(yearlyFee) : (baseFee !== undefined ? parseFloat(baseFee) : 0),
      fullProgramFee: fullProgramFee !== undefined ? parseFloat(fullProgramFee) : 0,
      yearlyFee: level === 'program'
        ? parseFloat(yearlyFee)
        : yearlyFee !== undefined ? parseFloat(yearlyFee) : null,
      semesterFee: (level === 'program' || Array.isArray(semesterFees)) && configuredSemesterFees.length > 0
        ? configuredSemesterFees.reduce((total, fee) => total + Number(fee), 0) / configuredSemesterFees.length
        : null,
      semesterFees: level === 'program' || Array.isArray(semesterFees) ? configuredSemesterFees.map(Number) : [],
      universityFee: universityFee !== undefined ? parseFloat(universityFee) : 0,
      additionalFees: additionalFees || [],
      feeBreakdown: feeBreakdown || [],
      currency: currency || 'INR',
      commissionRate: commissionRate !== undefined ? parseFloat(commissionRate) : 0,
      organizationId: req.user.organizationId,
      createdBy: req.user.id
    }
  });
  res.status(201).json({ success: true, data: fee });
});

export const updateProgramFee = asyncHandler(async (req: AuthRequest, res: Response) => {
  const {
    level,
    programId,
    studyCenterId,
    universityId,
    admissionSessionId,
    billingCycle,
    baseFee,
    fullProgramFee,
    yearlyFee,
    semesterFee,
    semesterFees,
    universityFee,
    additionalFees,
    commissionRate,
    currency,
    feeBreakdown
  } = req.body;
  const existingFee = await prisma.programFeeStructure.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId },
  });
  if (!existingFee) {
    res.status(404).json({ success: false, message: 'Fee structure not found' });
    return;
  }

  const nextLevel = level ?? existingFee.level;
  const nextProgramId = programId ?? existingFee.programId;
  const nextCenterId = studyCenterId !== undefined ? studyCenterId : existingFee.studyCenterId;
  const nextUniversityId = universityId ?? existingFee.universityId;
  const nextSessionId = admissionSessionId !== undefined ? (admissionSessionId || null) : existingFee.admissionSessionId;

  if (!['program', 'university'].includes(nextLevel)) {
    res.status(400).json({ success: false, message: 'Fee configuration level must be program or university' });
    return;
  }
  if (!nextProgramId) {
    res.status(400).json({ success: false, message: 'A program is required for this fee configuration' });
    return;
  }
  if (nextLevel === 'program' && !nextCenterId) {
    res.status(400).json({ success: false, message: 'A study centre is required for a program fee configuration' });
    return;
  }
  if (nextLevel === 'university' && (!nextUniversityId || nextCenterId)) {
    res.status(400).json({ success: false, message: 'University fee configurations require a university and cannot be assigned to a study centre' });
    return;
  }
  if (existingFee.level === 'program' && nextCenterId !== existingFee.studyCenterId) {
    res.status(400).json({ success: false, message: 'A study-centre fee structure cannot be moved to another study centre' });
    return;
  }
  if (nextLevel === 'program' && ![
    fullProgramFee ?? existingFee.fullProgramFee,
    yearlyFee ?? existingFee.yearlyFee ?? existingFee.baseFee,
  ].every(value => Number.isFinite(Number(value)) && Number(value) > 0)) {
    res.status(400).json({ success: false, message: 'Full program and yearly fees must both be greater than zero' });
    return;
  }
  const universityPaymentOptionsError = getUniversityPaymentOptionsError(nextLevel, fullProgramFee, yearlyFee, semesterFees);
  if (universityPaymentOptionsError) {
    res.status(400).json({ success: false, message: universityPaymentOptionsError });
    return;
  }

  const program = await prisma.program.findFirst({
    where: { id: nextProgramId, organizationId: req.user.organizationId, isDeleted: false },
    select: { id: true, universityId: true },
  });
  if (!program) {
    res.status(404).json({ success: false, message: 'Program not found in this organization' });
    return;
  }
  if (nextLevel === 'university' && program.universityId !== nextUniversityId) {
    res.status(400).json({ success: false, message: 'The selected program does not belong to this university' });
    return;
  }
  const semesterCount = nextLevel === 'program' && nextSessionId
    ? await prisma.semester.count({
        where: {
          organizationId: req.user.organizationId,
          programId: nextProgramId,
          academicSessionId: nextSessionId,
        },
      })
    : 0;
  const existingSemesterFees = Array.isArray(existingFee.semesterFees)
    ? existingFee.semesterFees.map(Number)
    : [];
  const configuredSemesterFees = semesterFees === undefined
    ? existingSemesterFees.length === semesterCount
      ? existingSemesterFees
      : semesterCount > 0
        ? Array.from({ length: semesterCount }, () => Number(semesterFee ?? existingFee.semesterFee ?? existingFee.baseFee))
        : []
    : semesterFees;
  if (nextLevel === 'program' && (
    !Array.isArray(configuredSemesterFees)
    || configuredSemesterFees.length !== semesterCount
    || !configuredSemesterFees.every(value => Number.isFinite(Number(value)) && Number(value) > 0)
  )) {
    res.status(400).json({ success: false, message: `Provide a positive fee for each of the ${semesterCount} semesters` });
    return;
  }
  if (nextSessionId) {
    const session = await prisma.admissionSession.findFirst({
      where: {
        id: nextSessionId,
        organizationId: req.user.organizationId,
        OR: [{ programId: nextProgramId }, { programId: null }],
      },
      select: { id: true, universityId: true },
    });
    if (!session || (session.universityId && session.universityId !== program.universityId)) {
      res.status(400).json({ success: false, message: 'The admission session is not available for this program' });
      return;
    }
  }
  if (nextCenterId) {
    const center = await prisma.studyCenter.findFirst({
      where: {
        id: nextCenterId,
        organizationId: req.user.organizationId,
        OR: [
          {
            programAllocations: {
              some: {
                organizationId: req.user.organizationId,
                programId: nextProgramId,
                isActive: true,
                OR: [
                  { admissionSessionId: nextSessionId },
                  { admissionSessionId: null },
                ],
              },
            },
          },
          { programIds: { has: nextProgramId } },
        ],
      },
      select: { id: true },
    });
    if (!center) {
      res.status(400).json({ success: false, message: 'The program is not actively allocated to this study centre' });
      return;
    }
  }

  const duplicate = await prisma.programFeeStructure.findFirst({
    where: {
      id: { not: existingFee.id },
      organizationId: req.user.organizationId,
      level: nextLevel,
      programId: nextProgramId,
      studyCenterId: nextLevel === 'program' ? nextCenterId : null,
      universityId: nextLevel === 'university' ? nextUniversityId : program.universityId,
      admissionSessionId: nextSessionId,
    },
  });
  if (duplicate) {
    res.status(400).json({ success: false, message: 'A fee structure already exists for this configuration and session' });
    return;
  }

  const data: any = {
    level: nextLevel,
    program: { connect: { id: nextProgramId } },
    studyCenter: nextLevel === 'program' ? { connect: { id: nextCenterId } } : { disconnect: true },
    university: { connect: { id: nextLevel === 'university' ? nextUniversityId : program.universityId } },
    admissionSession: nextSessionId ? { connect: { id: nextSessionId } } : { disconnect: true },
  };
  if (billingCycle !== undefined) data.billingCycle = billingCycle;
  if (nextLevel === 'program') {
    if (yearlyFee !== undefined) data.yearlyFee = parseFloat(yearlyFee);
    if (semesterFees !== undefined || semesterFee !== undefined) {
      data.semesterFees = configuredSemesterFees.map(Number);
      data.semesterFee = configuredSemesterFees.length > 0
        ? configuredSemesterFees.reduce((total, fee) => total + Number(fee), 0) / configuredSemesterFees.length
        : null;
    }
    if (fullProgramFee !== undefined) data.fullProgramFee = parseFloat(fullProgramFee);
    if (yearlyFee !== undefined) data.baseFee = parseFloat(yearlyFee);
  } else {
    if (baseFee !== undefined) data.baseFee = parseFloat(baseFee);
    if (fullProgramFee !== undefined) data.fullProgramFee = parseFloat(fullProgramFee);
    if (yearlyFee !== undefined) data.yearlyFee = yearlyFee === null ? null : parseFloat(yearlyFee);
    if (Array.isArray(semesterFees)) {
      data.semesterFees = semesterFees.map(Number);
      data.semesterFee = semesterFees.length > 0
        ? semesterFees.reduce((total, fee) => total + Number(fee), 0) / semesterFees.length
        : null;
    }
  }
  if (universityFee !== undefined) data.universityFee = parseFloat(universityFee);
  if (additionalFees !== undefined) data.additionalFees = additionalFees;
  if (feeBreakdown !== undefined) data.feeBreakdown = feeBreakdown;
  if (currency !== undefined) data.currency = currency;
  if (commissionRate !== undefined) data.commissionRate = parseFloat(commissionRate);

  const fee = await prisma.programFeeStructure.update({
    where: { id: existingFee.id },
    data
  });
  res.json({ success: true, data: fee });
});

export const deleteProgramFee = asyncHandler(async (req: AuthRequest, res: Response) => {
  const fee = await prisma.programFeeStructure.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId },
    select: { id: true },
  });
  if (!fee) {
    res.status(404).json({ success: false, message: 'Fee structure not found' });
    return;
  }
  await prisma.programFeeStructure.delete({ where: { id: fee.id } });
  res.json({ success: true, data: {} });
});
