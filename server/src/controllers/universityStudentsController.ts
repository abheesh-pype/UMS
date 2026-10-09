// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { prisma } from '../config/postgres.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Get all enrolled students for a specific university
export const getUniversityStudents = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { universityId } = req.params;
  const organizationId = req.user.organizationId;

  // Verify university exists and belongs to org
  const university = await prisma.university.findFirst({
    where: { id: universityId, organizationId, singletonKey: 'primary' }
  });

  if (!university) {
    res.status(404).json({ success: false, message: 'University not found' });
    return;
  }

  // Build query filters
  const where: any = {
    organizationId: organizationId,
    status: 'enrolled' as any,
    program: { universityId }
  };

  if (req.query.search) {
    const search = req.query.search as string;
    where.OR = [
      { studentName: { contains: search, mode: 'insensitive' } },
      { studentEmail: { contains: search, mode: 'insensitive' } },
      { enrollmentNumber: { contains: search, mode: 'insensitive' } }
    ];
  }

  if (req.query.programId) {
    where.programId = req.query.programId as string;
  }

  if (req.query.studyCenterId) {
    where.studyCenterId = req.query.studyCenterId as string;
  }

  if (req.query.sessionId) {
    where.sessionId = req.query.sessionId as string;
  }

  const enrollments = await prisma.enrollment.findMany({
    where,
    include: {
      program: { select: { id: true, name: true, code: true, courseType: true } },
      studyCenter: { select: { id: true, name: true, code: true, city: true } },
      session: { select: { id: true, name: true, startDate: true, endDate: true } },
      student: { select: { id: true, enrollmentNo: true, phone: true, address: true } }
    },
    orderBy: { enrolledAt: 'desc' }
  });

  // Get summary stats
  const stats = {
    totalEnrolled: enrollments.length,
    byProgram: {} as Record<string, number>,
    byCenter: {} as Record<string, number>,
    recentEnrollments: enrollments.slice(0, 5).length
  };

  enrollments.forEach(e => {
    const progName = e.program.name;
    const centerName = e.studyCenter.name;
    stats.byProgram[progName] = (stats.byProgram[progName] || 0) + 1;
    stats.byCenter[centerName] = (stats.byCenter[centerName] || 0) + 1;
  });

  res.status(200).json({
    success: true,
    count: enrollments.length,
    data: enrollments,
    stats,
    university: {
      id: university.id,
      name: university.name,
      code: university.code
    }
  });
});

// Get university dashboard metrics
export const getUniversityMetrics = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { universityId } = req.params;
  const organizationId = req.user.organizationId;

  const university = await prisma.university.findFirst({
    where: { id: universityId, organizationId, singletonKey: 'primary' }
  });

  if (!university) {
    res.status(404).json({ success: false, message: 'University not found' });
    return;
  }

  const [totalEnrolled, totalPrograms, totalCenters, recentEnrollments] = await Promise.all([
    prisma.enrollment.count({
      where: {
        organizationId: organizationId,
        status: 'enrolled' as any,
        program: { universityId }
      }
    }),
    prisma.program.count({
      where: { universityId, status: 'active' as any }
    }),
    prisma.studyCenter.count({
      where: {
        organizationId: organizationId,
        status: 'active' as any,
        universityIds: { has: universityId }
      }
    }),
    prisma.enrollment.count({
      where: {
        organizationId: organizationId,
        status: 'enrolled' as any,
        program: { universityId },
        enrolledAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    })
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalEnrolled,
      totalPrograms,
      totalCenters,
      recentEnrollments,
      university: {
        id: university.id,
        name: university.name,
        code: university.code
      }
    }
  });
});

export const updateEnrollmentUniNumber = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { uniEnrollmentNumber } = req.body;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id }
  });

  if (!enrollment) {
    res.status(404).json({ success: false, message: 'Enrollment not found' });
    return;
  }

  const updated = await prisma.enrollment.update({
    where: { id },
    data: { uniEnrollmentNumber }
  });

  if (updated.studentId) {
    await prisma.student.update({
      where: { id: updated.studentId },
      data: { uniEnrollmentNumber }
    });
  }

  res.json({ success: true, data: updated });
});
