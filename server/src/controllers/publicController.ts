// @ts-nocheck
import { Response, Request } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const validateInviteToken = asyncHandler(async (req: Request, res: Response) => {
  const invite = await prisma.studyCenterInvite.findUnique({ where: { token: req.params.token } });
  res.json({ success: true, data: invite });
});

export const publicRegister = asyncHandler(async (req: Request, res: Response) => {
  const { referredById, ...restBody } = req.body;
  const center = await prisma.studyCenter.create({
    data: {
      ...restBody,
      status: 'pending_verification' as any,
      referredBy: referredById || null
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
