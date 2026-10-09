// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { hashPassword, generateUserId, generateStudyCenterUserId } from '../utils/authUtils.js';
import { mapFrontendToPrismaCourseType, mapPrismaToFrontendCourseType } from '../utils/courseTypeHelper.js';

// Universities
export const getUniversities = asyncHandler(async (req: AuthRequest, res: Response) => {
  const universities = await prisma.university.findMany({
    where: {
      singletonKey: 'primary',
      organizationId: req.user.organizationId,
    },
    include: { allowedBranches: true }
  });
  const mapped = universities.map(u => ({
    ...u,
    _id: u.id,
    allowedBranchIds: u.allowedBranches || []
  }));
  res.json({ success: true, count: mapped.length, data: mapped });
});
export const getUniversity = asyncHandler(async (req: AuthRequest, res: Response) => {
  const university = await prisma.university.findFirst({
    where: {
      id: req.params.id,
      singletonKey: 'primary',
      organizationId: req.user.organizationId,
    },
    include: { allowedBranches: true }
  });
  if (!university) {
    res.status(404).json({ success: false, message: 'University not found' });
    return;
  }
  if (university) {
    (university as any)._id = university.id;
    (university as any).allowedBranchIds = university.allowedBranches || [];
  }
  res.json({ success: true, data: university });
});
export const createUniversity = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existingUniversity = await prisma.university.findUnique({
    where: { singletonKey: 'primary' },
    select: { id: true },
  });
  if (existingUniversity) {
    res.status(409).json({ success: false, message: 'Only one university is allowed.' });
    return;
  }

  const { allowedBranchIds, ...rest } = req.body;
  const data: any = { organizationId: req.user.organizationId };
  for (const field of ['name', 'code', 'address', 'contact', 'country', 'status', 'subDepartmentId', 'category', 'coordinatorName', 'optionalFields']) {
    if (rest[field] !== undefined) data[field] = rest[field];
  }
  let university;
  try {
    university = await prisma.university.create({
      data: {
        ...data,
        allowedBranches: allowedBranchIds && allowedBranchIds.length > 0
          ? { connect: allowedBranchIds.map((id: string) => ({ id })) }
          : undefined
      }
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      res.status(409).json({ success: false, message: 'Only one university is allowed.' });
      return;
    }
    throw error;
  }
  res.status(201).json({ success: true, data: { ...university, _id: university.id } });
});
export const updateUniversity = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existingUniversity = await prisma.university.findFirst({
    where: {
      id: req.params.id,
      singletonKey: 'primary',
      organizationId: req.user.organizationId,
    },
    select: { id: true },
  });
  if (!existingUniversity) {
    res.status(404).json({ success: false, message: 'University not found' });
    return;
  }

  const { allowedBranchIds, ...rest } = req.body;
  const data: any = {};
  for (const field of ['name', 'code', 'address', 'contact', 'country', 'status', 'subDepartmentId', 'category', 'coordinatorName', 'optionalFields']) {
    if (rest[field] !== undefined) data[field] = rest[field];
  }
  const university = await prisma.university.update({
    where: { id: req.params.id },
    data: {
      ...data,
      allowedBranches: allowedBranchIds
        ? { set: allowedBranchIds.map((id: string) => ({ id })) }
        : undefined
    }
  });
  res.json({ success: true, data: { ...university, _id: university.id } });
});
export const deleteUniversity = asyncHandler(async (req: AuthRequest, res: Response) => {
  const university = await prisma.university.findFirst({
    where: {
      id: req.params.id,
      singletonKey: 'primary',
      organizationId: req.user.organizationId,
    },
    select: { id: true },
  });
  if (!university) {
    res.status(404).json({ success: false, message: 'University not found' });
    return;
  }
  res.status(409).json({
    success: false,
    message: 'The single university cannot be deleted. Use the protected single-tenant reset script to start over.',
  });
});
export const activateUniversity = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existingUniversity = await prisma.university.findFirst({
    where: {
      id: req.params.id,
      singletonKey: 'primary',
      organizationId: req.user.organizationId,
    },
    select: { id: true },
  });
  if (!existingUniversity) {
    res.status(404).json({ success: false, message: 'University not found' });
    return;
  }
  const university = await prisma.university.update({ where: { id: existingUniversity.id }, data: { status: 'active' as any } });
  res.json({ success: true, data: { ...university, _id: university.id } });
});

// Programs
export const getPrograms = asyncHandler(async (req: AuthRequest, res: Response) => {
  const programs = await prisma.program.findMany({ 
    where: {
      organizationId: req.user.organizationId,
      isDeleted: false,
      university: { singletonKey: 'primary' },
    },
    include: { university: true } 
  });
  const mapped = programs.map(p => ({
    ...p,
    _id: p.id,
    courseType: mapPrismaToFrontendCourseType(p.courseType)
  }));
  res.json({ success: true, count: mapped.length, data: mapped });
});
export const getProgram = asyncHandler(async (req: AuthRequest, res: Response) => {
  const program = await prisma.program.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.user.organizationId,
      university: { singletonKey: 'primary' },
    },
    include: { university: true },
  });
  if (!program) {
    res.status(404).json({ success: false, message: 'Program not found' });
    return;
  }
  (program as any)._id = program.id;
  program.courseType = mapPrismaToFrontendCourseType(program.courseType);
  res.json({ success: true, data: program });
});
export const createProgram = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (req.body.courseType) {
    req.body.courseType = mapFrontendToPrismaCourseType(req.body.courseType);
  }
  const university = await prisma.university.findFirst({
    where: {
      id: req.user.universityId,
      organizationId: req.user.organizationId,
      singletonKey: 'primary',
    },
    select: { id: true },
  });
  if (!university) {
    res.status(400).json({ success: false, message: 'A university is required before adding a program' });
    return;
  }

  const data: any = {
    organization: { connect: { id: req.user.organizationId } },
    university: { connect: { id: university.id } },
  };
  if (req.body.academicSessionId) {
    data.academicSession = { connect: { id: req.body.academicSessionId } };
  }
  for (const field of ['subDepartmentId', 'name', 'courseName', 'description', 'code', 'courseType', 'duration', 'hasSemesters', 'semesters', 'status', 'specialisations']) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }
  if (!data.code) data.code = String(data.name).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
  data.duration = Number(data.duration);
  if (!Number.isFinite(data.duration) || data.duration < 1) {
    res.status(400).json({ success: false, message: 'Duration must be at least 1 year' });
    return;
  }
  const program = await prisma.program.create({ data });
  program.courseType = mapPrismaToFrontendCourseType(program.courseType);
  res.status(201).json({ success: true, data: { ...program, _id: program.id } });
});
export const updateProgram = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (req.body.courseType) {
    req.body.courseType = mapFrontendToPrismaCourseType(req.body.courseType);
  }
  const data: any = {};
  for (const field of ['academicSessionId', 'subDepartmentId', 'name', 'courseName', 'description', 'code', 'courseType', 'duration', 'hasSemesters', 'semesters', 'status', 'specialisations']) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }
  const existingProgram = await prisma.program.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.user.organizationId,
      university: { singletonKey: 'primary' },
    },
    select: { id: true },
  });
  if (!existingProgram) {
    res.status(404).json({ success: false, message: 'Program not found' });
    return;
  }
  data.universityId = req.user.universityId;
  const program = await prisma.program.update({ where: { id: existingProgram.id }, data });
  program.courseType = mapPrismaToFrontendCourseType(program.courseType);
  res.json({ success: true, data: { ...program, _id: program.id } });
});
export const deleteProgram = asyncHandler(async (req: AuthRequest, res: Response) => {
  const program = await prisma.program.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.user.organizationId,
      university: { singletonKey: 'primary' },
    },
    include: { _count: { select: { enrollments: true } } }
  });

  if (!program) {
    res.status(404).json({ success: false, message: 'Program not found' });
    return;
  }

  if (program._count.enrollments > 0) {
    res.status(400).json({ success: false, message: 'Cannot delete program with active enrollments. Consider marking it as inactive.' });
    return;
  }

  await prisma.program.update({
    where: { id: req.params.id },
    data: { isDeleted: true, status: 'inactive' }
  });
  res.json({ success: true, data: {} });
});
export const activateProgram = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existingProgram = await prisma.program.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.user.organizationId,
      university: { singletonKey: 'primary' },
    },
    select: { id: true },
  });
  if (!existingProgram) {
    res.status(404).json({ success: false, message: 'Program not found' });
    return;
  }
  const program = await prisma.program.update({ where: { id: existingProgram.id }, data: { status: 'active' as any } });
  program.courseType = mapPrismaToFrontendCourseType(program.courseType);
  res.json({ success: true, data: { ...program, _id: program.id } });
});

const normalizeSemesterDate = (value: unknown, fieldName: string) => {
  const date = new Date(String(value));
  if (!value || Number.isNaN(date.getTime())) {
    const error = new Error(`${fieldName} must be a valid date`);
    (error as any).statusCode = 400;
    throw error;
  }
  return date;
};

export const getProgramSemesters = asyncHandler(async (req: AuthRequest, res: Response) => {
  const program = await prisma.program.findFirst({
    where: {
      id: req.params.programId,
      organizationId: req.user.organizationId,
      isDeleted: false,
      university: { singletonKey: 'primary' },
    },
    select: { id: true },
  });
  if (!program) {
    res.status(404).json({ success: false, message: 'Program not found' });
    return;
  }
  const semesters = await prisma.semester.findMany({ where: { programId: program.id, organizationId: req.user.organizationId }, orderBy: { semesterNumber: 'asc' } });
  res.json({ success: true, count: semesters.length, data: semesters });
});

export const createProgramSemester = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { semesterName, semesterNumber, academicSessionId } = req.body;
  if (!semesterName?.trim() || !academicSessionId || !Number.isInteger(Number(semesterNumber)) || Number(semesterNumber) < 1) {
    res.status(400).json({ success: false, message: 'Semester name, number, and academic session are required' });
    return;
  }
  const program = await prisma.program.findFirst({
    where: {
      id: req.params.programId,
      organizationId: req.user.organizationId,
      isDeleted: false,
      university: { singletonKey: 'primary' },
    },
    select: { id: true },
  });
  if (!program) {
    res.status(404).json({ success: false, message: 'Program not found' });
    return;
  }
  const semester = await prisma.semester.create({ data: {
    organizationId: req.user.organizationId,
    programId: program.id,
    academicSessionId,
    semesterName: semesterName.trim(),
    semesterNumber: Number(semesterNumber),
    startDate: normalizeSemesterDate(req.body.startDate, 'Start Date'),
    endDate: normalizeSemesterDate(req.body.endDate, 'End Date'),
    status: req.body.status || 'active',
  } });
  res.status(201).json({ success: true, data: semester });
});

export const updateProgramSemester = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existing = await prisma.semester.findFirst({ where: { id: req.params.semesterId, programId: req.params.programId, organizationId: req.user.organizationId } });
  if (!existing) { res.status(404).json({ success: false, message: 'Semester not found' }); return; }
  const { semesterName, semesterNumber, startDate, endDate, status } = req.body;
  const semester = await prisma.semester.update({ where: { id: existing.id }, data: {
    semesterName: semesterName.trim(), semesterNumber: Number(semesterNumber),
    startDate: normalizeSemesterDate(startDate, 'Start Date'), endDate: normalizeSemesterDate(endDate, 'End Date'), status,
  } });
  res.json({ success: true, data: semester });
});

export const deleteProgramSemester = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existing = await prisma.semester.findFirst({ where: { id: req.params.semesterId, programId: req.params.programId, organizationId: req.user.organizationId }, select: { id: true } });
  if (!existing) { res.status(404).json({ success: false, message: 'Semester not found' }); return; }
  await prisma.semester.delete({ where: { id: existing.id } });
  res.json({ success: true, data: {} });
});

export const getProgramModules = asyncHandler(async (req: AuthRequest, res: Response) => {
  const program = await prisma.program.findFirst({
    where: {
      id: req.params.programId,
      organizationId: req.user.organizationId,
      isDeleted: false,
      university: { singletonKey: 'primary' },
    },
    select: { id: true }
  });
  if (!program) {
    res.status(404).json({ success: false, message: 'Program not found' });
    return;
  }

  const modules = await prisma.module.findMany({
    where: { programId: program.id, organizationId: req.user.organizationId, ...(req.query.semesterId ? { semesterId: String(req.query.semesterId) } : {}) },
    orderBy: { moduleCode: 'asc' }
  });
  res.json({ success: true, count: modules.length, data: modules });
});

export const createProgramModule = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { moduleCode, moduleName, moduleType, academicSessionId, semesterId } = req.body;
  if (!moduleCode?.trim() || !moduleName?.trim() || !moduleType?.trim()) {
    res.status(400).json({ success: false, message: 'Module code, name, and type are required' });
    return;
  }

  const program = await prisma.program.findFirst({
    where: {
      id: req.params.programId,
      organizationId: req.user.organizationId,
      isDeleted: false,
      university: { singletonKey: 'primary' },
    },
    select: { id: true, academicSessionId: true }
  });
  if (!program) {
    res.status(404).json({ success: false, message: 'Program not found' });
    return;
  }

  if (semesterId) {
    const semester = await prisma.semester.findFirst({ where: { id: semesterId, programId: program.id, organizationId: req.user.organizationId } });
    if (!semester) {
      res.status(400).json({ success: false, message: 'Semester does not belong to this program' });
      return;
    }
  }

  const module = await prisma.module.create({
    data: {
      organizationId: req.user.organizationId,
      programId: program.id,
      academicSessionId: academicSessionId || program.academicSessionId || null,
      semesterId: semesterId || null,
      moduleCode: moduleCode.trim(),
      moduleName: moduleName.trim(),
      moduleType: moduleType.trim(),
    }
  });
  res.status(201).json({ success: true, data: module });
});

export const updateProgramModule = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { moduleCode, moduleName, moduleType, semesterId } = req.body;
  if (!moduleCode?.trim() || !moduleName?.trim() || !moduleType?.trim()) {
    res.status(400).json({ success: false, message: 'Module code, name, and type are required' });
    return;
  }

  const existingModule = await prisma.module.findFirst({
    where: {
      id: req.params.moduleId,
      programId: req.params.programId,
      organizationId: req.user.organizationId,
    }
  });
  if (!existingModule) {
    res.status(404).json({ success: false, message: 'Module not found' });
    return;
  }

  if (semesterId) {
    const semester = await prisma.semester.findFirst({ where: { id: semesterId, programId: req.params.programId, organizationId: req.user.organizationId } });
    if (!semester) {
      res.status(400).json({ success: false, message: 'Semester does not belong to this program' });
      return;
    }
  }

  const module = await prisma.module.update({
    where: { id: existingModule.id },
    data: {
      moduleCode: moduleCode.trim(),
      moduleName: moduleName.trim(),
      moduleType: moduleType.trim(),
      semesterId: semesterId || null,
    }
  });
  res.json({ success: true, data: module });
});

export const deleteProgramModule = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existingModule = await prisma.module.findFirst({
    where: {
      id: req.params.moduleId,
      programId: req.params.programId,
      organizationId: req.user.organizationId,
    },
    select: { id: true }
  });
  if (!existingModule) {
    res.status(404).json({ success: false, message: 'Module not found' });
    return;
  }

  await prisma.module.delete({ where: { id: existingModule.id } });
  res.json({ success: true, data: {} });
});

export const getExaminations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const examinations = await prisma.examination.findMany({
    where: {
      organizationId: req.user.organizationId,
      ...(req.query.academicSessionId && { academicSessionId: String(req.query.academicSessionId) }),
      ...(req.query.programId && { programId: String(req.query.programId) }),
      ...(req.query.semesterId && { semesterId: String(req.query.semesterId) }),
      ...(req.query.status && { status: String(req.query.status) }),
    },
    include: { academicSession: true, program: true, semester: true },
    orderBy: { startDate: 'desc' },
  });
  res.json({ success: true, count: examinations.length, data: examinations });
});

export const getExaminationRegistrations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const registrations = await prisma.examinationRegistration.findMany({
    where: { organizationId: req.user.organizationId, examinationId: req.params.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: registrations });
});

export const getAllExaminationRegistrations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const registrations = await prisma.examinationRegistration.findMany({
    where: { organizationId: req.user.organizationId },
    include: { examination: { select: { examinationName: true, examinationType: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, count: registrations.length, data: registrations });
});

export const removeExaminationRegistration = asyncHandler(async (req: AuthRequest, res: Response) => {
  const registration = await prisma.examinationRegistration.findFirst({
    where: { id: req.params.registrationId, organizationId: req.user.organizationId },
    select: { id: true },
  });
  if (!registration) {
    res.status(404).json({ success: false, message: 'Registration not found' });
    return;
  }
  await prisma.examinationRegistration.delete({ where: { id: registration.id } });
  res.json({ success: true, data: {} });
});

export const createExamination = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { examinationName, examinationType, academicSessionId, programId, semesterId, startDate, endDate, description, moduleIds, schedule } = req.body;
  if (!examinationName?.trim() || !examinationType || !academicSessionId || !programId || !semesterId || !startDate || !endDate) {
    res.status(400).json({ success: false, message: 'All examination fields except description are required' });
    return;
  }
  const semester = await prisma.semester.findFirst({ where: { id: semesterId, programId, academicSessionId, organizationId: req.user.organizationId } });
  if (!semester) { res.status(400).json({ success: false, message: 'Semester does not match the selected session and program' }); return; }
  const examination = await prisma.examination.create({ data: {
    organizationId: req.user.organizationId, examinationName: examinationName.trim(), examinationType,
    academicSessionId, programId, semesterId, startDate: normalizeSessionDate(startDate, 'Start Date'),
    endDate: normalizeSessionDate(endDate, 'End Date'), description: description?.trim() || null,
    moduleIds: Array.isArray(moduleIds) ? moduleIds : [],
    schedule: Array.isArray(schedule) ? schedule : [],
  } });
  const session = await prisma.admissionSession.findUnique({
    where: { id: academicSessionId },
    select: { name: true },
  });

  const matchingStudents = await prisma.student.findMany({
    where: {
      organizationId: req.user.organizationId,
      programId,
      status: 'active',
      OR: [
        { sessionId: academicSessionId },
        { enrollments: { some: { sessionId: academicSessionId, status: 'enrolled' } } },
      ],
    },
    select: { user: { select: { id: true } } },
  });

  if (matchingStudents.length > 0) {
    await prisma.notification.createMany({
      data: matchingStudents.map(({ user }) => ({
        organizationId: req.user.organizationId,
        userId: user.id,
        title: 'New Examination Published',
        message: `${examinationType} has been created for your ${session?.name || 'admission session'}.`,
        type: 'general' as any,
        priority: 'medium' as any,
        link: `examinations/${examination.id}`,
      })),
    });
  }

  res.status(201).json({ success: true, data: examination });
});

export const updateExamination = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existing = await prisma.examination.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Examination not found' });
    return;
  }

  const { examinationName, examinationType, academicSessionId, programId, semesterId, startDate, endDate, description, moduleIds, schedule } = req.body;
  if (!examinationName?.trim() || !examinationType || !academicSessionId || !programId || !semesterId || !startDate || !endDate) {
    res.status(400).json({ success: false, message: 'All examination fields except description are required' });
    return;
  }

  const semester = await prisma.semester.findFirst({ where: { id: semesterId, programId, academicSessionId, organizationId: req.user.organizationId } });
  if (!semester) {
    res.status(400).json({ success: false, message: 'Semester does not match the selected session and program' });
    return;
  }

  const updated = await prisma.examination.update({
    where: { id: existing.id },
    data: {
      examinationName: examinationName.trim(),
      examinationType,
      academicSessionId,
      programId,
      semesterId,
      startDate: normalizeSessionDate(startDate, 'Start Date'),
      endDate: normalizeSessionDate(endDate, 'End Date'),
      description: description?.trim() || null,
      moduleIds: Array.isArray(moduleIds) ? moduleIds : [],
      schedule: Array.isArray(schedule) ? schedule : [],
    }
  });

  res.json({ success: true, data: updated });
});

export const deleteExamination = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existing = await prisma.examination.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Examination not found' });
    return;
  }

  await prisma.examination.delete({ where: { id: existing.id } });
  res.json({ success: true, data: {} });
});

export const updateExaminationModules = asyncHandler(async (req: AuthRequest, res: Response) => {
  const examination = await prisma.examination.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
  if (!examination) { res.status(404).json({ success: false, message: 'Examination not found' }); return; }
  const updated = await prisma.examination.update({ where: { id: examination.id }, data: { moduleIds: Array.isArray(req.body.moduleIds) ? req.body.moduleIds : [] } });
  res.json({ success: true, data: updated });
});

// Study Centers
export const getStudyCenters = asyncHandler(async (req: AuthRequest, res: Response) => {
  const departmentType = req.user.department?.type || req.user.subDepartment?.parentDept?.type;
  const isAssignedOperationsUser = req.user.role === 'ops_sub_admin'
    || (req.user.role === 'employee' && departmentType === 'operations');
  const isFinanceDepartmentUser = ['finance_admin', 'finance_sub_admin'].includes(req.user.role)
    || (req.user.role === 'employee' && departmentType === 'finance');
  const isAssignedFinanceUser = req.user.role === 'finance_sub_admin'
    || (req.user.role === 'employee' && departmentType === 'finance');

  const where: any = { organizationId: req.user.organizationId };
  if (isFinanceDepartmentUser) {
    if (req.query.status === 'rejected') {
      where.status = 'rejected';
      where.verifiedBy = { not: null };
      where.paymentRemarks = { not: null };
    } else if (req.query.status === 'active') {
      where.status = 'active';
      where.verifiedBy = { not: null };
    } else {
      where.OR = [
        {
          status: { in: ['pending_payment', 'active', 'inactive', 'suspended'] },
          verifiedBy: { not: null },
        },
        {
          status: 'rejected',
          verifiedBy: { not: null },
          paymentRemarks: { not: null },
        },
      ];
    }
    if (isAssignedFinanceUser) where.assignedFinanceUserId = req.user.id;
  } else if (isAssignedOperationsUser) {
    where.assignedOperationsUserId = req.user.id;
    if (req.query.status === 'rejected') {
      where.status = 'rejected';
    } else if (req.query.status === 'progress') {
      where.status = { notIn: ['pending', 'pending_verification', 'rejected'] };
    } else if (req.query.status && req.query.status !== 'all') {
      where.status = req.query.status as string;
    }
  } else if (req.user.role === 'ops_admin') {
    if (req.query.status === 'rejected') {
      where.status = 'rejected';
    } else if (req.query.status === 'progress') {
      where.status = { notIn: ['pending', 'pending_verification', 'rejected'] };
    } else {
      where.status = { notIn: ['pending', 'pending_verification', 'rejected'] };
    }
  } else if (req.query.status && req.query.status !== 'all') {
    where.status = req.query.status as string;
  }
  if (req.query.universityId) {
    where.universityIds = { has: req.query.universityId as string };
  }
  const centers = await prisma.studyCenter.findMany({
    where,
    include: {
      referrer: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          branch: { select: { id: true, name: true } },
          designationRef: {
            include: {
              branch: { select: { id: true, name: true } }
            }
          }
        }
      }
    }
  });
  const mapped = centers.map(c => ({
    ...c,
    _id: c.id
  }));
  res.json({ success: true, count: mapped.length, data: mapped });
});
export const getStudyCenter = asyncHandler(async (req: AuthRequest, res: Response) => {
  const center = await prisma.studyCenter.findUnique({
    where: { id: req.params.id },
    include: {
      referrer: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          branch: { select: { id: true, name: true } },
          designationRef: {
            include: {
              branch: { select: { id: true, name: true } }
            }
          }
        }
      }
    }
  });
  if (center) {
    (center as any)._id = center.id;
  }
  res.json({ success: true, data: center });
});
export const createStudyCenter = asyncHandler(async (req: AuthRequest, res: Response) => {
  const isSales = req.user.role === 'sales_admin' || req.user.role === 'bde' || req.user.role === 'employee';
  const { name, referredById, ...restBody } = req.body;
  const email = req.body.email || req.body.contactEmail;

  if (!email) {
    res.status(400).json({ success: false, message: 'Email or contactEmail is required' });
    return;
  }

  // Check if user email already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    res.status(400).json({ success: false, message: 'A user with this email already exists' });
    return;
  }

  // 1. Generate credentials
  const rawPassword = `Center@${Math.floor(1000 + Math.random() * 9000)}`;
  const hashedPassword = await hashPassword(rawPassword);
  const userId = await generateStudyCenterUserId(req.user.organizationId);

  // 2. Create in transaction
  const centerWithCreds = await prisma.$transaction(async (tx) => {
    const allowedFields = ['name', 'code', 'address', 'city', 'state', 'status', 'universityIds', 'programIds'];
    const linkedUniversityIds = req.user.universityId
      ? [req.user.universityId]
      : (Array.isArray(req.body.universityIds) ? req.body.universityIds : []);
    const dbData: any = {
      organizationId: req.user.organizationId,
      status: isSales ? 'pending_verification' : (req.body.status || 'pending'),
      referredBy: isSales ? req.user.id : (referredById === 'null' || !referredById ? null : referredById),
      credentials: { userId, password: rawPassword },
      email,
      contact: req.body.contact || req.body.contactPhone || req.body.contactPerson || 'Not Provided',
      universityIds: linkedUniversityIds
    };

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) dbData[field] = req.body[field];
    }

    // A university-scoped admin cannot assign the center to another university.
    dbData.universityIds = linkedUniversityIds;

    const center = await tx.studyCenter.create({ 
      data: dbData
    });

    // 3. Create center admin user
    await tx.user.create({
      data: {
        userId,
        email,
        password: hashedPassword,
        name: `${name} Admin`,
        role: 'center_admin',
        organizationId: req.user.organizationId,
        universityId: linkedUniversityIds[0] || null,
        studyCenterId: center.id,
        status: 'active' as any
      }
    });

    return { ...center, _id: center.id, credentials: { userId, password: rawPassword } };
  });

  res.status(201).json({ success: true, data: centerWithCreds });
});
export const updateStudyCenter = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { referredById, ...rest } = req.body;
  const data: any = { ...rest };
  if (Object.prototype.hasOwnProperty.call(req.body, 'referredById')) {
    data.referredBy = referredById === '__none__' || !referredById ? null : referredById;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'assignedOperationsUserId')) {
    if (req.user.role !== 'ops_admin') {
      res.status(403).json({ success: false, message: 'Only Operations Admin can assign study centers' });
      return;
    }
    const assignedUserId = req.body.assignedOperationsUserId;
    if (assignedUserId) {
      const assignedUser = await prisma.user.findFirst({
        where: {
          id: assignedUserId,
          organizationId: req.user.organizationId,
          role: { in: ['ops_sub_admin', 'employee'] },
        },
        select: { id: true },
      });
      if (!assignedUser) {
        res.status(400).json({ success: false, message: 'Assignee must be an Operations sub-admin or employee in this organization' });
        return;
      }
    }
    data.assignedOperationsUserId = assignedUserId || null;
  }
  const center = await prisma.studyCenter.update({ where: { id: req.params.id }, data });
  res.json({ success: true, data: { ...center, _id: center.id } });
});

export const updateBranchSettings = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { branchName, ...settings } = req.body;
  if (!branchName) {
    res.status(400).json({ success: false, message: 'branchName is required' });
    return;
  }
  
  const centers = await prisma.studyCenter.findMany({
    where: {
      organizationId: req.user.organizationId,
      OR: [
        { branchName },
        { referrer: { branch: { name: branchName } } },
        { referrer: { designationRef: { branch: { name: branchName } } } }
      ]
    },
    select: { id: true }
  });

  const centerIds = centers.map(c => c.id);
  let count = 0;
  if (centerIds.length > 0) {
    const result = await prisma.studyCenter.updateMany({
      where: { id: { in: centerIds } },
      data: settings
    });
    count = result.count;
  }

  res.json({ success: true, message: `Updated ${count} center(s) in branch "${branchName}"`, count });
});
export const deleteStudyCenter = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.studyCenter.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: {} });
});
export const approveStudyCenter = asyncHandler(async (req: AuthRequest, res: Response) => {
  const center = await prisma.studyCenter.update({ where: { id: req.params.id }, data: { status: 'active' as any } });
  res.json({ success: true, data: { ...center, _id: center.id } });
});
export const suspendStudyCenter = asyncHandler(async (req: AuthRequest, res: Response) => {
  const center = await prisma.studyCenter.update({ where: { id: req.params.id }, data: { status: 'suspended' as any } });
  res.json({ success: true, data: { ...center, _id: center.id } });
});

// Admission Sessions
const normalizeSessionDate = (value: unknown, fieldName: string) => {
  if (!value) return null;
  const rawValue = String(value);
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(rawValue) ? `${rawValue}T00:00:00.000Z` : rawValue);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${fieldName} must be a valid date`);
    (error as any).statusCode = 400;
    throw error;
  }
  return date;
};

export const getAdmissionSessions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const where: any = { organizationId: req.user.organizationId };
  if (req.query.universityId) {
    where.universityId = req.query.universityId as string;
  }
  const sessions = await prisma.admissionSession.findMany({ where });
  res.json({ success: true, count: sessions.length, data: sessions });
});
export const getAdmissionSession = asyncHandler(async (req: AuthRequest, res: Response) => {
  const session = await prisma.admissionSession.findUnique({ where: { id: req.params.id } });
  res.json({ success: true, data: session });
});
export const createAdmissionSession = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data: any = {
    ...req.body,
    organizationId: req.user.organizationId,
    startDate: normalizeSessionDate(req.body.startDate, 'Session From'),
    endDate: normalizeSessionDate(req.body.endDate, 'Session To'),
  };
  if (!data.startDate || !data.endDate) {
    res.status(400).json({ success: false, message: 'Session From and Session To are required' });
    return;
  }
  if (req.body.examDate) data.examDate = normalizeSessionDate(req.body.examDate, 'Exam Date');
  if (req.body.reregPaymentClosingDate) data.reregPaymentClosingDate = normalizeSessionDate(req.body.reregPaymentClosingDate, 'Payment Closing Date');
  const session = await prisma.$transaction(async (tx) => {
    if (data.status === 'active') {
      await tx.admissionSession.updateMany({
        where: { organizationId: req.user.organizationId, universityId: data.universityId || null },
        data: { status: 'inactive' }
      });
    }
    return tx.admissionSession.create({ data });
  });
  res.status(201).json({ success: true, data: session });
});
export const updateAdmissionSession = asyncHandler(async (req: AuthRequest, res: Response) => {
  const session = await prisma.$transaction(async (tx) => {
    const current = await tx.admissionSession.findUnique({ where: { id: req.params.id } });
    if (!current || current.organizationId !== req.user.organizationId) throw new Error('Session not found');
    const data: any = { ...req.body };
    if (req.body.startDate !== undefined) data.startDate = normalizeSessionDate(req.body.startDate, 'Session From');
    if (req.body.endDate !== undefined) data.endDate = normalizeSessionDate(req.body.endDate, 'Session To');
    if (req.body.examDate !== undefined) data.examDate = req.body.examDate ? normalizeSessionDate(req.body.examDate, 'Exam Date') : null;
    if (req.body.reregPaymentClosingDate !== undefined) data.reregPaymentClosingDate = req.body.reregPaymentClosingDate ? normalizeSessionDate(req.body.reregPaymentClosingDate, 'Payment Closing Date') : null;
    if (data.status === 'active') {
      await tx.admissionSession.updateMany({
        where: { organizationId: current.organizationId, universityId: data.universityId ?? current.universityId, id: { not: req.params.id } },
        data: { status: 'inactive' }
      });
    }
    return tx.admissionSession.update({ where: { id: req.params.id }, data });
  });
  res.json({ success: true, data: session });
});
export const deleteAdmissionSession = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.admissionSession.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: {} });
});
export const approveAdmissionSession = asyncHandler(async (req: AuthRequest, res: Response) => {
  const session = await prisma.admissionSession.update({ where: { id: req.params.id }, data: { status: 'approved' as any, approvedBy: req.user.id, approvedAt: new Date() } });
  res.json({ success: true, data: session });
});

export const duplicateSession = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const originalSession = await prisma.admissionSession.findUnique({
    where: { id },
    include: { programFeeStructures: true }
  });

  if (!originalSession || originalSession.organizationId !== req.user.organizationId) {
    res.status(404).json({ success: false, message: 'Session not found' });
    return;
  }

  const newSession = await prisma.admissionSession.create({
    data: {
      organizationId: originalSession.organizationId,
      name: `${originalSession.name} (Copy)`,
      startDate: originalSession.startDate,
      endDate: originalSession.endDate,
      status: originalSession.status,
      programId: originalSession.programId,
      universityId: originalSession.universityId,
      studyCenterId: originalSession.studyCenterId,
      capacity: originalSession.capacity,
      createdBy: req.user.id,
      subDepartmentId: originalSession.subDepartmentId,
      reregPaymentClosingDate: originalSession.reregPaymentClosingDate,
      programFeeStructures: {
        create: originalSession.programFeeStructures.map(fee => ({
          organizationId: fee.organizationId,
          universityId: fee.universityId,
          programId: fee.programId,
          baseFee: fee.baseFee,
          additionalFees: fee.additionalFees || [],
          totalFee: fee.totalFee,
          status: fee.status,
          currency: fee.currency,
          minDownPayment: fee.minDownPayment,
          installmentOptions: fee.installmentOptions || [],
          lateFeePolicy: fee.lateFeePolicy || {}
        }))
      }
    }
  });

  res.status(201).json({ success: true, data: newSession });
});

// Internal Marks
export const getInternalMarks = asyncHandler(async (req: AuthRequest, res: Response) => {
  const marks = await prisma.internalMark.findMany({ where: { organizationId: req.user.organizationId }, include: { student: true } });
  res.json({ success: true, count: marks.length, data: marks });
});
export const createInternalMark = asyncHandler(async (req: AuthRequest, res: Response) => {
  const mark = await prisma.internalMark.create({ data: { ...req.body, organizationId: req.user.organizationId, enteredBy: req.user.id } });
  res.status(201).json({ success: true, data: mark });
});
export const updateInternalMark = asyncHandler(async (req: AuthRequest, res: Response) => {
  const mark = await prisma.internalMark.update({ where: { id: req.params.id }, data: req.body });
  res.json({ success: true, data: mark });
});
export const deleteInternalMark = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.internalMark.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: {} });
});

// Announcements
export const getAnnouncements = asyncHandler(async (req: AuthRequest, res: Response) => {
  const announcements = await prisma.announcement.findMany({ where: { organizationId: req.user.organizationId }, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, count: announcements.length, data: announcements });
});
export const getAnnouncement = asyncHandler(async (req: AuthRequest, res: Response) => {
  const announcement = await prisma.announcement.findUnique({ where: { id: req.params.id } });
  res.json({ success: true, data: announcement });
});
export const createAnnouncement = asyncHandler(async (req: AuthRequest, res: Response) => {
  const announcement = await prisma.announcement.create({ data: { ...req.body, organizationId: req.user.organizationId, createdById: req.user.id } });
  res.status(201).json({ success: true, data: announcement });
});
export const updateAnnouncement = asyncHandler(async (req: AuthRequest, res: Response) => {
  const announcement = await prisma.announcement.update({ where: { id: req.params.id }, data: req.body });
  res.json({ success: true, data: announcement });
});
export const deleteAnnouncement = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.announcement.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: {} });
});

// Onboarding
export const getPendingVerificationCenters = asyncHandler(async (req: AuthRequest, res: Response) => {
  const departmentType = req.user.department?.type || req.user.subDepartment?.parentDept?.type;
  const isAssignedOperationsUser = req.user.role === 'ops_sub_admin'
    || (req.user.role === 'employee' && departmentType === 'operations');
  const centers = await prisma.studyCenter.findMany({
    where: {
      organizationId: req.user.organizationId,
      status: { in: ['pending', 'pending_verification'] } as any,
      ...(isAssignedOperationsUser ? { assignedOperationsUserId: req.user.id } : {}),
    },
  });
  res.json({ success: true, data: centers });
});
export const verifyCenter = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { action, remarks } = req.body;
  if (!['approve', 'reject'].includes(action)) {
    res.status(400).json({ success: false, message: 'action must be approve or reject' });
    return;
  }
  if (action === 'reject' && !remarks?.trim()) {
    res.status(400).json({ success: false, message: 'Remarks are required when rejecting a center' });
    return;
  }

  const departmentType = req.user.department?.type || req.user.subDepartment?.parentDept?.type;
  const isAssignedOperationsUser = req.user.role === 'ops_sub_admin'
    || (req.user.role === 'employee' && departmentType === 'operations');
  if (isAssignedOperationsUser) {
    const assignedCenter = await prisma.studyCenter.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
        assignedOperationsUserId: req.user.id,
      },
      select: { id: true },
    });
    if (!assignedCenter) {
      res.status(404).json({ success: false, message: 'Assigned study center not found' });
      return;
    }
  }

  const center = await prisma.studyCenter.update({
    where: { id: req.params.id },
    data: {
      status: action === 'approve' ? 'pending_payment' as any : 'rejected' as any,
      opsRemarks: remarks?.trim() || null,
      verifiedBy: req.user.id,
      verifiedAt: new Date()
    }
  });
  res.json({ success: true, data: center });
});

// Allocations
export const getProgramAllocations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const allocations = await prisma.programAllocation.findMany({ where: { centerId: req.params.id }, include: { program: true } });
  res.json({ success: true, data: allocations });
});
export const allocateProgram = asyncHandler(async (req: AuthRequest, res: Response) => {
  const allocation = await prisma.programAllocation.create({ data: { ...req.body, centerId: req.params.id, organizationId: req.user.organizationId, allocatedBy: req.user.id } });
  res.status(201).json({ success: true, data: allocation });
});
export const removeAllocation = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.programAllocation.delete({ where: { id: req.params.allocId } });
  res.json({ success: true, data: {} });
});

export const getUniversityAllocations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const allocations = await prisma.universityAllocation.findMany({ where: { centerId: req.params.id }, include: { university: true } });
  res.json({ success: true, data: allocations });
});
export const allocateUniversity = asyncHandler(async (req: AuthRequest, res: Response) => {
  const allocation = await prisma.universityAllocation.create({ data: { ...req.body, centerId: req.params.id, organizationId: req.user.organizationId, allocatedBy: req.user.id } });
  res.status(201).json({ success: true, data: allocation });
});
export const removeUniversityAllocation = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.universityAllocation.delete({ where: { id: req.params.allocId } });
  res.json({ success: true, data: {} });
});

export const bulkImportStudyCenters = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { centers } = req.body;

  if (!Array.isArray(centers)) {
    res.status(400).json({ success: false, message: 'Invalid payload: centers must be an array' });
    return;
  }

  const organizationId = req.user.organizationId;
  if (!organizationId) {
    res.status(400).json({ success: false, message: 'Organization ID is required' });
    return;
  }

  const results = {
    total: centers.length,
    successCount: 0,
    failedCount: 0,
    errors: [] as any[]
  };

  const processedCodes = new Set<string>();
  const processedEmails = new Set<string>();

  for (let i = 0; i < centers.length; i++) {
    const rawCenter = centers[i];
    const rowNum = i + 2; // Excel row numbering

    const name = rawCenter.name?.toString().trim();
    const code = rawCenter.code?.toString().trim().toUpperCase();
    const email = rawCenter.email?.toString().trim().toLowerCase();
    const contact = rawCenter.contact?.toString().trim() || 'Not Provided';
    const city = rawCenter.city?.toString().trim() || '';
    const state = rawCenter.state?.toString().trim() || '';
    const address = rawCenter.address?.toString().trim() || '';
    const referredById = rawCenter.referredById?.toString().trim() || null;

    if (!name || !code || !email) {
      results.failedCount++;
      results.errors.push({
        row: rowNum,
        code: code || 'Unknown',
        message: 'Name, Code, and Email are required fields'
      });
      continue;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      results.failedCount++;
      results.errors.push({
        row: rowNum,
        code,
        message: 'Invalid email format'
      });
      continue;
    }

    // Check duplicates in payload
    if (processedCodes.has(code)) {
      results.failedCount++;
      results.errors.push({
        row: rowNum,
        code,
        message: 'Duplicate Center Code in the upload file'
      });
      continue;
    }
    processedCodes.add(code);

    if (processedEmails.has(email)) {
      results.failedCount++;
      results.errors.push({
        row: rowNum,
        code,
        message: 'Duplicate Email in the upload file'
      });
      continue;
    }
    processedEmails.add(email);

    // Check duplicate code in DB
    const dbCenterExists = await prisma.studyCenter.findFirst({
      where: { organizationId, code }
    });
    if (dbCenterExists) {
      results.failedCount++;
      results.errors.push({
        row: rowNum,
        code,
        message: 'A study center with this code already exists'
      });
      continue;
    }

    // Check duplicate email in DB users table
    const dbUserExists = await prisma.user.findUnique({
      where: { email }
    });
    if (dbUserExists) {
      results.failedCount++;
      results.errors.push({
        row: rowNum,
        code,
        message: 'A user with this email already exists'
      });
      continue;
    }

    try {
      const rawPassword = `Center@${Math.floor(1000 + Math.random() * 9000)}`;
      const hashedPassword = await hashPassword(rawPassword);
      const userId = await generateStudyCenterUserId(organizationId);

      await prisma.$transaction(async (tx) => {
        const center = await tx.studyCenter.create({
          data: {
            organizationId,
            name,
            code,
            email,
            contact,
            city,
            state,
            address,
            status: 'active',
            credentials: { userId, password: rawPassword },
            ...(referredById ? { referredBy: referredById } : {})
          }
        });

        await tx.user.create({
          data: {
            userId,
            email,
            password: hashedPassword,
            name: `${name} Admin`,
            role: 'center_admin',
            organizationId,
            studyCenterId: center.id,
            status: 'active'
          }
        });
      });

      results.successCount++;
    } catch (err: any) {
      results.failedCount++;
      results.errors.push({
        row: rowNum,
        code,
        message: err.message || 'Database error occurred during creation'
      });
    }
  }

  res.status(200).json({
    success: true,
    data: results
  });
});
