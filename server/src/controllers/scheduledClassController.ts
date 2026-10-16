import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const scheduledClassInclude = {
  academicSession: { select: { id: true, name: true } },
  program: { select: { id: true, name: true } },
  semester: { select: { id: true, semesterName: true, semesterNumber: true } },
  module: { select: { id: true, moduleName: true, moduleCode: true, moduleType: true } },
  _count: { select: { students: true } },
};

export const getSchedulableStudents = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { academicSessionId, programId } = req.query;
  if (typeof academicSessionId !== 'string' || typeof programId !== 'string') {
    res.status(400).json({ success: false, message: 'Academic session and program are required' });
    return;
  }

  const students = await prisma.student.findMany({
    where: {
      organizationId: req.user.organizationId,
      programId,
      status: 'enrolled',
      OR: [
        { sessionId: academicSessionId },
        { enrollments: { some: { sessionId: academicSessionId, status: 'enrolled' } } },
      ],
    },
    select: { id: true, name: true, enrollmentNo: true, email: true },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, count: students.length, data: students });
});

export const getScheduledClasses = asyncHandler(async (req: AuthRequest, res: Response) => {
  const scheduledClasses = await prisma.scheduledClass.findMany({
    where: { organizationId: req.user.organizationId },
    include: scheduledClassInclude,
    orderBy: { startsAt: 'asc' },
  });

  res.json({ success: true, count: scheduledClasses.length, data: scheduledClasses });
});

export const createScheduledClass = asyncHandler(async (req: AuthRequest, res: Response) => {
  const {
    academicSessionId,
    programId,
    semesterId,
    moduleId,
    title,
    startsAt: startsAtValue,
    meetingUrl,
    studentIds,
  } = req.body;

  if (!academicSessionId || !programId || !semesterId || !moduleId || !title?.trim() || !startsAtValue || !meetingUrl?.trim()) {
    res.status(400).json({ success: false, message: 'Session, program, semester, module, title, date/time, and meeting link are required' });
    return;
  }

  if (!Array.isArray(studentIds) || studentIds.length === 0 || studentIds.some(id => typeof id !== 'string')) {
    res.status(400).json({ success: false, message: 'Select at least one enrolled student' });
    return;
  }

  const startsAt = new Date(startsAtValue);
  if (Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) {
    res.status(400).json({ success: false, message: 'Class start time must be a valid future date and time' });
    return;
  }

  let parsedMeetingUrl: URL;
  try {
    parsedMeetingUrl = new URL(meetingUrl.trim());
  } catch {
    res.status(400).json({ success: false, message: 'Enter a valid meeting link' });
    return;
  }
  if (parsedMeetingUrl.protocol !== 'http:' && parsedMeetingUrl.protocol !== 'https:') {
    res.status(400).json({ success: false, message: 'Meeting link must use HTTP or HTTPS' });
    return;
  }

  const [session, program, semester, module] = await Promise.all([
    prisma.admissionSession.findFirst({
      where: { id: academicSessionId, organizationId: req.user.organizationId },
      select: { id: true },
    }),
    prisma.program.findFirst({
      where: { id: programId, organizationId: req.user.organizationId, isDeleted: false },
      select: { id: true },
    }),
    prisma.semester.findFirst({
      where: {
        id: semesterId,
        organizationId: req.user.organizationId,
        programId,
        academicSessionId,
      },
      select: { id: true },
    }),
    prisma.module.findFirst({
      where: {
        id: moduleId,
        organizationId: req.user.organizationId,
        programId,
        semesterId,
        OR: [{ academicSessionId }, { academicSessionId: null }],
      },
      select: { id: true },
    }),
  ]);
  if (!session || !program || !semester || !module) {
    res.status(400).json({ success: false, message: 'The selected session, program, semester, or module is invalid' });
    return;
  }

  const uniqueStudentIds = [...new Set(studentIds)];
  const eligibleStudents = await prisma.student.findMany({
    where: {
      id: { in: uniqueStudentIds },
      organizationId: req.user.organizationId,
      programId,
      status: 'enrolled',
      OR: [
        { sessionId: academicSessionId },
        { enrollments: { some: { sessionId: academicSessionId, status: 'enrolled' } } },
      ],
    },
    select: { id: true },
  });
  if (eligibleStudents.length !== uniqueStudentIds.length) {
    res.status(400).json({ success: false, message: 'All selected students must be enrolled in the selected program and session' });
    return;
  }

  const scheduledClass = await prisma.scheduledClass.create({
    data: {
      organizationId: req.user.organizationId,
      academicSessionId,
      programId,
      semesterId,
      moduleId,
      title: title.trim(),
      startsAt,
      meetingUrl: parsedMeetingUrl.toString(),
      createdBy: req.user.id,
      students: {
        create: uniqueStudentIds.map(studentId => ({ studentId })),
      },
    },
    include: scheduledClassInclude,
  });

  res.status(201).json({ success: true, data: scheduledClass });
});

export const getStudentScheduledClasses = asyncHandler(async (req: AuthRequest, res: Response) => {
  const student = await prisma.student.findFirst({
    where: { email: req.user.email, organizationId: req.user.organizationId },
    select: { id: true },
  });
  if (!student) {
    res.status(404).json({ success: false, message: 'Student record not found' });
    return;
  }

  const scheduledClasses = await prisma.scheduledClass.findMany({
    where: {
      organizationId: req.user.organizationId,
      startsAt: { gte: new Date() },
      students: { some: { studentId: student.id } },
    },
    include: {
      academicSession: { select: { id: true, name: true } },
      program: { select: { id: true, name: true } },
      semester: { select: { id: true, semesterName: true, semesterNumber: true } },
      module: { select: { id: true, moduleName: true, moduleCode: true, moduleType: true } },
    },
    orderBy: { startsAt: 'asc' },
  });

  res.json({ success: true, count: scheduledClasses.length, data: scheduledClasses });
});
