import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { HiringStatus, EmploymentRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { generateUserId } from '../utils/authUtils.js';

// Manager API: Create a hiring request
export const createHiringRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { departmentId, designationId, title, description, count } = req.body;
    const organizationId = req.user.organizationId;
    const requestedBy = req.user.id;
    const requestedCount = Number(count);
    const department = await prisma.department.findFirst({
      where: { id: departmentId, organizationId },
      select: { id: true },
    });

    if (!department) {
      res.status(400).json({ success: false, message: 'Select a department in your organization' });
      return;
    }
    if (typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ success: false, message: 'Job title is required' });
      return;
    }
    if (!Number.isInteger(requestedCount) || requestedCount < 1) {
      res.status(400).json({ success: false, message: 'Position count must be at least one' });
      return;
    }

    const request = await prisma.hiringRequest.create({
      data: {
        organizationId,
        departmentId,
        designationId: designationId || null,
        title: title.trim(),
        description: typeof description === 'string' ? description.trim() || null : null,
        count: requestedCount,
        requestedBy,
        status: 'pending_hr_approval'
      }
    });

    res.status(201).json({ success: true, data: request });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// HR API: Get all hiring requests
export const getHiringRequests = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user.organizationId;
    const requests = await prisma.hiringRequest.findMany({
      where: { organizationId },
      include: {
        department: true,
        requester: { select: { name: true, email: true } },
        vacancy: true,
        candidates: { orderBy: { createdAt: 'desc' } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: requests });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// HR API: Approve or Reject Hiring Request
export const updateHiringRequestStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, hrRemarks } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      res.status(400).json({ success: false, message: 'Choose approve or reject for this request' });
      return;
    }

    const request = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "HiringRequest" WHERE "id" = ${id} AND "organizationId" = ${req.user.organizationId} FOR UPDATE`;
      const existing = await tx.hiringRequest.findFirst({
        where: { id, organizationId: req.user.organizationId },
        include: { vacancy: true },
      });
      if (!existing) {
        return { error: 'Hiring request not found', statusCode: 404 as const };
      }
      if (existing.status !== 'pending_hr_approval') {
        return { error: 'Only pending requests can be reviewed', statusCode: 400 as const };
      }

      let vacancy = existing.vacancy;
      if (status === 'approved') {
        vacancy = await tx.vacancy.create({
          data: {
            organizationId: existing.organizationId,
            departmentId: existing.departmentId,
            hiringRequestId: existing.id,
            designation: existing.title,
            count: existing.count,
            status: 'open',
          },
        });
      }

      const updated = await tx.hiringRequest.update({
        where: { id: existing.id },
        data: {
          status,
          hrRemarks: typeof hrRemarks === 'string' ? hrRemarks.trim() || null : null,
          hrApprovedBy: req.user.id,
        },
        include: { department: true, vacancy: true, candidates: true },
      });
      return { data: updated, vacancy };
    });

    if ('error' in request) {
      res.status(request.statusCode).json({ success: false, message: request.error });
      return;
    }
    res.json({ success: true, data: request.data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// HR API: Add Candidate to Hiring Request
export const addCandidate = async (req: AuthRequest, res: Response) => {
  try {
    const { hiringRequestId, name, email, phone, offerLetterUrl } = req.body;
    const organizationId = req.user.organizationId;

    if (typeof name !== 'string' || !name.trim() ||
      typeof email !== 'string' || !email.trim() ||
      typeof phone !== 'string' || !phone.trim()) {
      res.status(400).json({ success: false, message: 'Candidate name, email, and phone are required' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "HiringRequest" WHERE "id" = ${hiringRequestId} AND "organizationId" = ${organizationId} FOR UPDATE`;
      const request = await tx.hiringRequest.findFirst({
        where: { id: hiringRequestId, organizationId },
        include: { vacancy: true, candidates: { select: { status: true } } },
      });
      if (!request) {
        return { error: 'Hiring request not found', statusCode: 404 as const };
      }
      if (request.status !== 'approved') {
        return { error: 'Candidates can only be added to an HR-approved hiring request', statusCode: 400 as const };
      }
      const activeCandidates = request.candidates.filter(candidate => candidate.status !== 'rejected').length;
      if (activeCandidates >= request.count) {
        return { error: 'Candidate limit reached for this hiring request', statusCode: 400 as const };
      }

      if (!request.vacancy) {
        await tx.vacancy.create({
          data: {
            organizationId,
            departmentId: request.departmentId,
            hiringRequestId: request.id,
            designation: request.title,
            count: request.count,
            status: 'open',
          },
        });
      }

      const candidate = await tx.candidate.create({
        data: {
          organizationId,
          hiringRequestId: request.id,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          offerLetterUrl: typeof offerLetterUrl === 'string' ? offerLetterUrl.trim() || null : null,
          status: 'offer_sent',
        },
      });
      return { data: candidate };
    });
    if ('error' in result) {
      res.status(result.statusCode).json({ success: false, message: result.error });
      return;
    }
    res.status(201).json({ success: true, data: result.data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// HR API: Update Candidate Status
export const updateCandidateStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, appointmentLetterUrl, joinDate, employmentRole } = req.body;
    const organizationId = req.user.organizationId;
    const statusTransitions: Record<string, string[]> = {
      offer_sent: ['joined', 'rejected'],
      joined: ['appointment_sent'],
      appointment_sent: ['induction_pending'],
      induction_pending: ['induction_completed'],
    };
    if (!Object.values(HiringStatus).includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid candidate status' });
      return;
    }
    if (employmentRole && !Object.values(EmploymentRole).includes(employmentRole)) {
      res.status(400).json({ success: false, message: 'Invalid employment role' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      let candidate = await tx.candidate.findFirst({
        where: { id, organizationId },
        include: { hiringRequest: { include: { vacancy: true } } },
      });
      if (!candidate) {
        return { error: 'Candidate not found', statusCode: 404 as const };
      }
      if (candidate.hiringRequest.status !== 'approved') {
        return { error: 'The hiring request must be approved before processing candidates', statusCode: 400 as const };
      }
      if (!statusTransitions[candidate.status]?.includes(status)) {
        return { error: `Candidate cannot move from ${candidate.status} to ${status}`, statusCode: 400 as const };
      }

      const updateData: any = { status };
      if (appointmentLetterUrl !== undefined) updateData.appointmentLetterUrl = appointmentLetterUrl || null;
      if (joinDate) {
        const parsedJoinDate = new Date(joinDate);
        if (Number.isNaN(parsedJoinDate.getTime())) {
          return { error: 'Joining date is invalid', statusCode: 400 as const };
        }
        updateData.joinDate = parsedJoinDate;
      }
      if (employmentRole) updateData.employmentRole = employmentRole as EmploymentRole;

      if (status === 'joined' && !candidate.employeeId) {
        let vacancy = candidate.hiringRequest.vacancy;
        if (!vacancy) {
          vacancy = await tx.vacancy.create({
            data: {
              organizationId,
              departmentId: candidate.hiringRequest.departmentId,
              hiringRequestId: candidate.hiringRequest.id,
              designation: candidate.hiringRequest.title,
              count: candidate.hiringRequest.count,
              status: 'open',
            },
          });
        }
        const existingUser = await tx.user.findUnique({
          where: { email: candidate.email },
          select: { id: true },
        });
        if (existingUser) {
          return { error: 'A user with the candidate email already exists', statusCode: 409 as const };
        }
        const reservedPosition = await tx.vacancy.updateMany({
          where: { id: vacancy.id, status: 'open', filled: { lt: vacancy.count } },
          data: { filled: { increment: 1 } },
        });
        if (!reservedPosition.count) {
          return { error: 'All positions for this hiring request have been filled', statusCode: 400 as const };
        }
        await tx.vacancy.updateMany({
          where: { id: vacancy.id, filled: { gte: vacancy.count } },
          data: { status: 'closed' },
        });

        const passwordHash = await bcrypt.hash('password123', 10);
        const newUser = await tx.user.create({
          data: {
            userId: await generateUserId(organizationId),
            organizationId,
            universityId: req.user.universityId,
            name: candidate.name,
            email: candidate.email,
            phone: candidate.phone,
            password: passwordHash,
            role: 'employee',
            departmentId: candidate.hiringRequest.departmentId,
            designation: candidate.hiringRequest.title,
            status: 'active',
          },
        });
        const newEmployee = await tx.employeeProfile.create({
          data: {
            organizationId,
            userId: newUser.id,
            employmentType: 'full_time',
            employmentRole: employmentRole || 'probation',
            inductionStatus: 'pending',
            joinDate: new Date(joinDate || new Date()),
          },
        });
        updateData.employeeId = newEmployee.id;
      }

      if (status === 'induction_completed') {
        updateData.inductionStatus = 'completed';
        updateData.inductionCompletedBy = req.user.id;
        updateData.inductionCompletedAt = new Date();
      }

      candidate = await tx.candidate.update({
        where: { id: candidate.id },
        data: updateData,
        include: { hiringRequest: { include: { department: true, vacancy: true } } },
      });
      return { data: candidate };
    });

    if ('error' in result) {
      res.status(result.statusCode).json({ success: false, message: result.error });
      return;
    }
    res.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Manager API: Get Hiring Requests by Department
export const getManagerHiringRequests = async (req: AuthRequest, res: Response) => {
  try {
    const requestedBy = req.user.id;
    const requests = await prisma.hiringRequest.findMany({
      where: { requestedBy },
      include: {
        department: true,
        vacancy: true,
        candidates: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: requests });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyDocuments = async (req: AuthRequest, res: Response) => {
  try {
    const candidate = await prisma.candidate.findFirst({
      where: { email: req.user.email }
    });
    res.json({ success: true, data: candidate });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch documents' });
  }
};
