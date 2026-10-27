// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const syncStudentNotifications = async (req: AuthRequest) => {
  if (req.user.role !== 'student') return;

  const student = await prisma.student.findFirst({
    where: {
      organizationId: req.user.organizationId,
      email: req.user.email,
      status: 'active',
    },
    include: {
      program: { select: { id: true, name: true, academicSessionId: true } },
      invoices: {
        select: {
          id: true,
          invoiceNo: true,
          invoiceType: true,
          total: true,
          paidAmount: true,
          balanceAmount: true,
          status: true,
          dueDate: true,
          createdAt: true,
          paidAt: true,
          period: true,
        },
      },
    },
  });

  if (!student) return;

  const targetSessionId = student.sessionId || student.program?.academicSessionId;

  const candidates: Array<{
    organizationId: string;
    userId: string;
    title: string;
    message: string;
    type: 'announcement' | 'system' | 'general';
    priority: 'high' | 'medium' | 'low';
    link: string;
    createdAt?: Date;
  }> = [];

  const now = new Date();

  // 1. Examinations
  if (targetSessionId && student.programId) {
    const examinations = await prisma.examination.findMany({
      where: {
        organizationId: req.user.organizationId,
        programId: student.programId,
        academicSessionId: targetSessionId,
      },
      include: { academicSession: { select: { name: true } } },
    });

    for (const examination of examinations) {
      candidates.push({
        organizationId: req.user.organizationId,
        userId: req.user.id,
        title: 'New Examination Published',
        message: `${examination.examinationType} has been scheduled for ${examination.academicSession?.name || 'your session'}.`,
        type: 'general',
        priority: 'high',
        link: `examinations/${examination.id}`,
      });
    }
  }

  // 2. Fees, Invoices & Financial Alerts
  for (const inv of (student.invoices || [])) {
    // 2A. New Invoices Generated
    candidates.push({
      organizationId: req.user.organizationId,
      userId: req.user.id,
      title: `New Invoice Generated: ${inv.invoiceNo}`,
      message: `${(inv.invoiceType || 'Tuition').toUpperCase()} invoice of ₹${Number(inv.total || 0).toLocaleString()} issued for ${inv.period || 'current term'}.${inv.dueDate ? ` Due date: ${new Date(inv.dueDate).toLocaleDateString()}.` : ''}`,
      type: 'system',
      priority: inv.balanceAmount > 0 && inv.dueDate && new Date(inv.dueDate) < now ? 'high' : 'medium',
      link: `fees/invoice/${inv.id}`,
      createdAt: inv.createdAt ? new Date(inv.createdAt) : undefined,
    });

    // 2B. Installment Due Date & Overdue Reminders
    if (inv.status !== 'paid' && Number(inv.balanceAmount) > 0 && inv.dueDate) {
      const dueDate = new Date(inv.dueDate);
      if (dueDate < now) {
        candidates.push({
          organizationId: req.user.organizationId,
          userId: req.user.id,
          title: `Overdue Fee Reminder: ${inv.invoiceNo}`,
          message: `Overdue fee reminder to avoid late penalties: Outstanding balance of ₹${Number(inv.balanceAmount).toLocaleString()} was due on ${dueDate.toLocaleDateString()}. Please clear to avoid registration blocks.`,
          type: 'system',
          priority: 'high',
          link: `fees/overdue/${inv.id}`,
        });
      } else {
        candidates.push({
          organizationId: req.user.organizationId,
          userId: req.user.id,
          title: `Upcoming Fee Due Reminder`,
          message: `Upcoming installment payment of ₹${Number(inv.balanceAmount).toLocaleString()} due on ${dueDate.toLocaleDateString()}.`,
          type: 'system',
          priority: 'high',
          link: `fees/due/${inv.id}`,
        });
      }
    }

    // 2C. Payment Acknowledgement
    if (inv.status === 'paid' && (inv.paidAt || inv.paidAmount > 0)) {
      candidates.push({
        organizationId: req.user.organizationId,
        userId: req.user.id,
        title: `Payment Acknowledged: ${inv.invoiceNo}`,
        message: `Instant Confirmation: Payment of ₹${Number(inv.total || inv.paidAmount).toLocaleString()} has been received, verified, and recorded by the finance department.`,
        type: 'system',
        priority: 'low',
        link: `fees/receipt/${inv.id}`,
      });
    }
  }

  // 3. Curriculum Materials & Recorded Video Lectures
  if (student.programId) {
    const materials = await prisma.programMaterial.findMany({
      where: {
        organizationId: req.user.organizationId,
        programId: student.programId,
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    for (const mat of materials) {
      const isVideo = mat.category === 'video_class' || mat.category === 'video';
      const isEbook = mat.category === 'ebook' || mat.category === 'syllabus';
      const semLabel = mat.semesterNumber ? `Semester ${mat.semesterNumber}` : 'your curriculum';
      const matTitle = mat.title || mat.fileName || 'Course Material';

      if (isVideo) {
        candidates.push({
          organizationId: req.user.organizationId,
          userId: req.user.id,
          title: 'New Video Lecture Uploaded',
          message: `A new video lecture '${matTitle}' has been uploaded for ${semLabel}.`,
          type: 'announcement',
          priority: 'low',
          link: `materials/video/${mat.id}`,
          createdAt: mat.createdAt ? new Date(mat.createdAt) : undefined,
        });
      } else if (isEbook) {
        candidates.push({
          organizationId: req.user.organizationId,
          userId: req.user.id,
          title: 'E-Books & Syllabus Updates',
          message: `New curriculum study material and reference resource '${matTitle}' is available for ${semLabel}.`,
          type: 'announcement',
          priority: 'low',
          link: `materials/ebook/${mat.id}`,
          createdAt: mat.createdAt ? new Date(mat.createdAt) : undefined,
        });
      }
    }
  }

  // 4. Academic Session & Calendar Milestones
  if (targetSessionId) {
    const session = await prisma.admissionSession.findFirst({
      where: { id: targetSessionId },
    });

    if (session && session.startDate) {
      candidates.push({
        organizationId: req.user.organizationId,
        userId: req.user.id,
        title: 'Academic Session Commencement',
        message: `Academic Session '${session.name}' official session start date is ${new Date(session.startDate).toLocaleDateString()}. Orientation and academic activities have commenced.`,
        type: 'general',
        priority: 'medium',
        link: `session/commence/${session.id}`,
      });
    }

    candidates.push({
      organizationId: req.user.organizationId,
      userId: req.user.id,
      title: 'Semester Progression / Re-registration',
      message: `Review your completed modules and prepare for Semester progression re-registration for the upcoming academic cycle.`,
      type: 'general',
      priority: 'medium',
      link: `session/progression/${student.id}`,
    });

    const calendarEvents = await prisma.academicCalendar.findMany({
      where: {
        organizationId: req.user.organizationId,
        OR: [
          { academicSessionId: targetSessionId },
          { programId: student.programId },
        ],
      },
      orderBy: { startDate: 'desc' },
      take: 10,
    });

    for (const ev of calendarEvents) {
      const isHoliday = ev.category?.toLowerCase() === 'holiday' || ev.title?.toLowerCase().includes('holiday');
      candidates.push({
        organizationId: req.user.organizationId,
        userId: req.user.id,
        title: isHoliday ? `University Holiday & Recess: ${ev.title}` : `Academic Milestone: ${ev.title}`,
        message: `${ev.description || ev.title} scheduled for ${new Date(ev.startDate).toLocaleDateString()}.`,
        type: 'general',
        priority: isHoliday ? 'low' : 'medium',
        link: `calendar/event/${ev.id}`,
      });
    }
  }

  // 5. Scheduled Live Classes
  if (student.programId) {
    const scheduled = await prisma.scheduledClass.findMany({
      where: {
        organizationId: req.user.organizationId,
        programId: student.programId,
      },
      orderBy: { startsAt: 'desc' },
      take: 5,
    });

    for (const sc of scheduled) {
      candidates.push({
        organizationId: req.user.organizationId,
        userId: req.user.id,
        title: `Live Scheduled Class: ${sc.title}`,
        message: `Live lecture on '${sc.title}' scheduled for ${new Date(sc.startsAt).toLocaleString()}.`,
        type: 'announcement',
        priority: 'high',
        link: `classes/live/${sc.id}`,
      });
    }
  }

  // Deduplicate against existing notifications for this student
  const candidateLinks = candidates.map(c => c.link);
  const existing = await prisma.notification.findMany({
    where: { userId: req.user.id, link: { in: candidateLinks } },
    select: { link: true },
  });
  const existingLinks = new Set(existing.map(n => n.link));
  const missing = candidates.filter(c => !existingLinks.has(c.link));

  if (missing.length > 0) {
    await prisma.notification.createMany({
      data: missing.map(m => ({
        organizationId: m.organizationId,
        userId: m.userId,
        title: m.title,
        message: m.message,
        type: m.type as any,
        priority: m.priority as any,
        link: m.link,
        read: false,
        createdAt: m.createdAt || new Date(),
      })),
    });
  }
};

export const getMyNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  await syncStudentNotifications(req);
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' }
  });
  const unreadCount = await prisma.notification.count({ where: { userId: req.user.id, read: false } });
  res.json({ success: true, data: notifications, unreadCount });
});

export const markAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const notification = await prisma.notification.update({ where: { id: req.params.id }, data: { read: true } });
  res.json({ success: true, data: notification });
});

export const markAllAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id }, data: { read: true } });
  res.json({ success: true, message: 'All marked as read' });
});

export const deleteNotification = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.notification.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: {} });
});

export const createNotification = async (organizationId: string, userId: string, type: string, title: string, message: string, data?: any) => {
  return await prisma.notification.create({
    data: { organizationId, userId, type, title, message, data, read: false }
  });
};

export const broadcastNotification = async (organizationId: string, type: string, title: string, message: string, roles?: string[]) => {
  const users = await prisma.user.findMany({
    where: { organizationId, role: roles ? { in: roles } : undefined }
  });
  const notifications = users.map(u => ({ organizationId, userId: u.id, type, title, message, read: false }));
  return await prisma.notification.createMany({ data: notifications });
};

export const sendBroadcastNotification = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { target, targetId, title, message, priority, link } = req.body;
  const organizationId = req.user.organizationId;
  const senderRole = req.user.role;

  // Security checks:
  // - Operations role can target 'students', 'centers', 'student', 'center'.
  // - Finance role can target 'centers', 'center'.
  if (['finance_admin', 'finance'].includes(senderRole) && !['centers', 'center'].includes(target)) {
    res.status(403).json({ success: false, message: 'Finance users can only send notifications to centers' });
    return;
  }

  let userIds: string[] = [];

  if (target === 'students') {
    const students = await prisma.user.findMany({
      where: { organizationId, role: 'student', status: 'active' },
      select: { id: true }
    });
    userIds = students.map(s => s.id);
  } else if (target === 'student') {
    const studentUser = await prisma.user.findFirst({
      where: { organizationId, role: 'student', id: targetId },
      select: { id: true }
    });
    if (studentUser) userIds = [studentUser.id];
  } else if (target === 'centers') {
    const centers = await prisma.user.findMany({
      where: { organizationId, role: 'center_admin', status: 'active' },
      select: { id: true }
    });
    userIds = centers.map(c => c.id);
  } else if (target === 'center') {
    const centerAdmins = await prisma.user.findMany({
      where: { organizationId, role: 'center_admin', studyCenterId: targetId, status: 'active' },
      select: { id: true }
    });
    userIds = centerAdmins.map(ca => ca.id);
  }

  if (userIds.length === 0) {
    res.status(404).json({ success: false, message: 'No recipient users found for this target' });
    return;
  }

  const notificationType = target === 'students' || target === 'student' ? 'announcement' : 'system';

  const notificationsData = userIds.map(uid => ({
    organizationId,
    userId: uid,
    title,
    message,
    type: notificationType as any,
    priority: (priority || 'medium') as any,
    link: link || null,
    read: false
  }));

  await prisma.notification.createMany({
    data: notificationsData
  });

  res.status(201).json({ success: true, message: `Notification sent to ${userIds.length} users` });
});
