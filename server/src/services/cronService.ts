// @ts-nocheck
import cron from 'node-cron';
import prisma from '../lib/prisma.js';
import { startEscalationCron } from './escalationService.js';
import { checkOverdueInvoices } from './invoiceService.js';

export const startAllCronJobs = () => {
  startInviteExpiryCron();
  startEscalationCron();
  startAutoPunchOutCron();
  startOverdueInvoicesCron();
  console.log('✅ All cron jobs started');
};

const startOverdueInvoicesCron = () => {
  // Check overdue invoices every day at midnight (00:05 AM)
  cron.schedule('5 0 * * *', async () => {
    console.log('🔄 Running overdue invoices check...');
    try {
      const count = await checkOverdueInvoices();
      if (count > 0) {
        console.log(`✅ Marked ${count} invoices as overdue`);
      }
    } catch (error) {
      console.error('❌ Overdue invoice check error:', error);
    }
  });
};

const startInviteExpiryCron = () => {
  cron.schedule('0 1 * * *', async () => {
    console.log('🔄 Running invite token expiry check...');
    try {
      const result = await prisma.studyCenterInvite.updateMany({
        where: {
          status: 'pending' as any,
          expiresAt: { lt: new Date() }
        },
        data: { status: 'expired' as any }
      });
      console.log(`✅ Expired ${result.count} invite tokens`);
    } catch (error) {
      console.error('❌ Invite expiry cron error:', error);
    }
  });
};

const getMinutesOfDay = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
};

const getBreakMinutes = (checkIn: Date, checkOut: Date, settings: any) => {
  const officeHours = settings?.officeHours && typeof settings.officeHours === 'object'
    ? settings.officeHours
    : {};
  const dayName = checkIn.toLocaleDateString('en-US', { weekday: 'long' });
  const override = Array.isArray(officeHours.dayOverrides)
    ? officeHours.dayOverrides.find((item: any) => item?.day === dayName)
    : null;
  const breakStart = getMinutesOfDay(officeHours.breakStartTime || '13:00');
  const breakEnd = getMinutesOfDay(officeHours.breakEndTime || '14:00');
  if (breakStart === null || breakEnd === null || breakEnd <= breakStart) return 0;

  const breakStartTime = new Date(checkIn);
  breakStartTime.setHours(Math.floor(breakStart / 60), breakStart % 60, 0, 0);
  const breakEndTime = new Date(checkIn);
  breakEndTime.setHours(Math.floor(breakEnd / 60), breakEnd % 60, 0, 0);
  const overlap = Math.max(
    0,
    Math.min(checkOut.getTime(), breakEndTime.getTime()) -
      Math.max(checkIn.getTime(), breakStartTime.getTime())
  ) / 60000;
  const configuredDuration = Number(override?.breakDurationMinutes ?? officeHours.breakDurationMinutes);
  return Number.isFinite(configuredDuration) && configuredDuration >= 0
    ? Math.min(overlap, configuredDuration)
    : overlap;
};

const autoPunchOutOpenAttendances = async () => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const activeAttendances = await prisma.attendance.findMany({
    where: {
      checkOut: null,
      checkIn: { not: null },
      date: { lt: todayStart },
    },
  });
  if (!activeAttendances.length) return 0;

  const settingsByOrganization = new Map<string, any>();
  for (const record of activeAttendances) {
    if (!record.checkIn) continue;
    let settings = settingsByOrganization.get(record.organizationId);
    if (settings === undefined) {
      settings = await prisma.hRSettings.findUnique({
        where: { organizationId: record.organizationId },
      });
      settingsByOrganization.set(record.organizationId, settings || null);
    }

    const checkOutTime = new Date(record.date);
    checkOutTime.setHours(23, 59, 59, 999);
    const breakMinutes = getBreakMinutes(record.checkIn, checkOutTime, settings);
    const workingMinutes = Math.max(
      0,
      (checkOutTime.getTime() - record.checkIn.getTime()) / 60000 - breakMinutes
    );
    const result = await prisma.attendance.updateMany({
      where: { id: record.id, checkOut: null },
      data: {
        checkOut: checkOutTime,
        workingHours: Number((workingMinutes / 60).toFixed(2)),
        checkOutLocation: { systemAutoPunchOut: true, time: new Date() },
      },
    });
    if (result.count > 0) {
      console.log(`✅ Auto punched out attendance ${record.id} at 11:59 PM`);
    }
  }
  return activeAttendances.length;
};

const startAutoPunchOutCron = () => {
  // Close missed open attendance records at 11:59 PM of their attendance day.
  cron.schedule('1 0 * * *', async () => {
    console.log('🔄 Running auto punch out check for previous day...');
    try {
      const count = await autoPunchOutOpenAttendances();
      if (count > 0) console.log(`✅ Auto punch-out check completed for ${count} attendance records`);
    } catch (error) {
      console.error('❌ Auto punch out cron error:', error);
    }
  });

  void autoPunchOutOpenAttendances().catch(error => {
    console.error('❌ Startup auto punch out check error:', error);
  });
};
