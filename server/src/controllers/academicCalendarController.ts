// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const VALID_CATEGORIES = [
  'Classes & Teaching',
  'Assessment & Assignments',
  'University Events',
  'Meetings',
  'Examinations',
  'Holidays',
  'Administrative Deadlines',
  'Others',
];

export const getAcademicCalendarEvents = asyncHandler(async (req: AuthRequest, res: Response) => {
  const {
    academicSessionId,
    programId,
    semesterId,
    departmentId,
    studyCenterId,
    category,
    search,
    startDate,
    endDate,
  } = req.query;

  const where: any = {
    organizationId: req.user.organizationId,
  };

  if (academicSessionId && academicSessionId !== 'all') {
    where.academicSessionId = String(academicSessionId);
  }
  if (programId && programId !== 'all') {
    where.programId = String(programId);
  }
  if (semesterId && semesterId !== 'all') {
    where.semesterId = String(semesterId);
  }
  if (departmentId && departmentId !== 'all') {
    where.departmentId = String(departmentId);
  }
  if (studyCenterId && studyCenterId !== 'all') {
    where.studyCenterId = String(studyCenterId);
  }
  if (category && category !== 'all') {
    where.category = String(category);
  }
  if (search && String(search).trim()) {
    where.OR = [
      { title: { contains: String(search).trim(), mode: 'insensitive' } },
      { description: { contains: String(search).trim(), mode: 'insensitive' } },
    ];
  }
  if (startDate && endDate) {
    where.AND = [
      { startDate: { lte: new Date(String(endDate)) } },
      { endDate: { gte: new Date(String(startDate)) } },
    ];
  }

  const events = await prisma.academicCalendar.findMany({
    where,
    include: {
      academicSession: {
        select: { id: true, name: true, startDate: true, endDate: true },
      },
      program: {
        select: { id: true, name: true, code: true },
      },
      semester: {
        select: { id: true, semesterName: true, semesterNumber: true },
      },
      department: {
        select: { id: true, name: true },
      },
      studyCenter: {
        select: { id: true, name: true, code: true },
      },
    },
    orderBy: [
      { startDate: 'asc' },
      { startTime: 'asc' },
    ],
  });

  res.json({ success: true, count: events.length, data: events });
});

export const createAcademicCalendarEvent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const {
    title,
    category,
    academicSessionId,
    programId,
    semesterId,
    departmentId,
    studyCenterId,
    startDate,
    endDate,
    startTime,
    endTime,
    description,
  } = req.body;

  if (!title || !title.trim()) {
    res.status(400).json({ success: false, message: 'Event title is required' });
    return;
  }
  if (!category || !category.trim()) {
    res.status(400).json({ success: false, message: 'Event category is required' });
    return;
  }
  if (!startDate) {
    res.status(400).json({ success: false, message: 'Start date is required' });
    return;
  }
  if (!endDate) {
    res.status(400).json({ success: false, message: 'End date is required' });
    return;
  }

  const parsedStart = new Date(startDate);
  const parsedEnd = new Date(endDate);

  if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
    res.status(400).json({ success: false, message: 'Invalid start or end date format' });
    return;
  }

  // Ensure end date is not earlier than start date
  const startDay = new Date(parsedStart.getFullYear(), parsedStart.getMonth(), parsedStart.getDate());
  const endDay = new Date(parsedEnd.getFullYear(), parsedEnd.getMonth(), parsedEnd.getDate());

  if (endDay < startDay) {
    res.status(400).json({ success: false, message: 'End date cannot be earlier than start date' });
    return;
  }

  // If on the same date and both start and end time are provided, check time order
  if (endDay.getTime() === startDay.getTime() && startTime && endTime) {
    if (endTime < startTime) {
      res.status(400).json({ success: false, message: 'End time cannot be earlier than start time' });
      return;
    }
  }

  const event = await prisma.academicCalendar.create({
    data: {
      organizationId: req.user.organizationId,
      title: title.trim(),
      category: category.trim(),
      academicSessionId: academicSessionId && academicSessionId !== 'all' ? academicSessionId : null,
      programId: programId && programId !== 'all' ? programId : null,
      semesterId: semesterId && semesterId !== 'all' ? semesterId : null,
      departmentId: departmentId && departmentId !== 'all' ? departmentId : null,
      studyCenterId: studyCenterId && studyCenterId !== 'all' ? studyCenterId : null,
      startDate: parsedStart,
      endDate: parsedEnd,
      startTime: startTime ? startTime.trim() : null,
      endTime: endTime ? endTime.trim() : null,
      description: description ? description.trim() : null,
      createdBy: req.user.id,
    },
    include: {
      academicSession: { select: { id: true, name: true } },
      program: { select: { id: true, name: true, code: true } },
      semester: { select: { id: true, semesterName: true, semesterNumber: true } },
    },
  });

  res.status(201).json({ success: true, data: event });
});

export const updateAcademicCalendarEvent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const existing = await prisma.academicCalendar.findFirst({
    where: { id, organizationId: req.user.organizationId },
  });

  if (!existing) {
    res.status(404).json({ success: false, message: 'Academic event not found' });
    return;
  }

  const {
    title,
    category,
    academicSessionId,
    programId,
    semesterId,
    departmentId,
    studyCenterId,
    startDate,
    endDate,
    startTime,
    endTime,
    description,
  } = req.body;

  const updateData: any = {};
  if (title !== undefined) updateData.title = title.trim();
  if (category !== undefined) updateData.category = category.trim();
  if (academicSessionId !== undefined) {
    updateData.academicSessionId = academicSessionId && academicSessionId !== 'all' ? academicSessionId : null;
  }
  if (programId !== undefined) {
    updateData.programId = programId && programId !== 'all' ? programId : null;
  }
  if (semesterId !== undefined) {
    updateData.semesterId = semesterId && semesterId !== 'all' ? semesterId : null;
  }
  if (departmentId !== undefined) {
    updateData.departmentId = departmentId && departmentId !== 'all' ? departmentId : null;
  }
  if (studyCenterId !== undefined) {
    updateData.studyCenterId = studyCenterId && studyCenterId !== 'all' ? studyCenterId : null;
  }
  if (startTime !== undefined) updateData.startTime = startTime ? startTime.trim() : null;
  if (endTime !== undefined) updateData.endTime = endTime ? endTime.trim() : null;
  if (description !== undefined) updateData.description = description ? description.trim() : null;

  const effectiveStart = startDate ? new Date(startDate) : existing.startDate;
  const effectiveEnd = endDate ? new Date(endDate) : existing.endDate;

  const startDay = new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), effectiveStart.getDate());
  const endDay = new Date(effectiveEnd.getFullYear(), effectiveEnd.getMonth(), effectiveEnd.getDate());

  if (endDay < startDay) {
    res.status(400).json({ success: false, message: 'End date cannot be earlier than start date' });
    return;
  }

  const effectiveStartTime = startTime !== undefined ? startTime : existing.startTime;
  const effectiveEndTime = endTime !== undefined ? endTime : existing.endTime;

  if (endDay.getTime() === startDay.getTime() && effectiveStartTime && effectiveEndTime) {
    if (effectiveEndTime < effectiveStartTime) {
      res.status(400).json({ success: false, message: 'End time cannot be earlier than start time' });
      return;
    }
  }

  if (startDate) updateData.startDate = effectiveStart;
  if (endDate) updateData.endDate = effectiveEnd;

  const updated = await prisma.academicCalendar.update({
    where: { id },
    data: updateData,
    include: {
      academicSession: { select: { id: true, name: true } },
      program: { select: { id: true, name: true, code: true } },
      semester: { select: { id: true, semesterName: true, semesterNumber: true } },
    },
  });

  res.json({ success: true, data: updated });
});

export const deleteAcademicCalendarEvent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const existing = await prisma.academicCalendar.findFirst({
    where: { id, organizationId: req.user.organizationId },
  });

  if (!existing) {
    res.status(404).json({ success: false, message: 'Academic event not found' });
    return;
  }

  await prisma.academicCalendar.delete({ where: { id } });
  res.json({ success: true, message: 'Academic event deleted successfully' });
});
