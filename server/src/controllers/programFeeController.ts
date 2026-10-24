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

export const createProgramFee = asyncHandler(async (req: AuthRequest, res: Response) => {
  const {
    level,
    programId,
    studyCenterId,
    universityId,
    admissionSessionId,
    billingCycle,
    baseFee,
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

  if (studyCenterId) {
    const center = await prisma.studyCenter.findFirst({
      where: {
        id: studyCenterId,
        organizationId: req.user.organizationId,
        OR: [
          {
            programAllocations: {
              some: { organizationId: req.user.organizationId, programId, isActive: true },
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
      baseFee: baseFee !== undefined ? parseFloat(baseFee) : 0,
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
  if (nextCenterId) {
    const center = await prisma.studyCenter.findFirst({
      where: {
        id: nextCenterId,
        organizationId: req.user.organizationId,
        OR: [
          {
            programAllocations: {
              some: { organizationId: req.user.organizationId, programId: nextProgramId, isActive: true },
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
  if (baseFee !== undefined) data.baseFee = parseFloat(baseFee);
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
