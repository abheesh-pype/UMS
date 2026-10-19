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

const startAutoPunchOutCron = () => {
  // Run at 00:01 AM every day (1 minute past midnight)
  cron.schedule('1 0 * * *', async () => {
    console.log('🔄 Running auto punch out check for previous day...');
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const activeAttendances = await prisma.attendance.findMany({
        where: { 
          checkOut: null, 
          checkIn: { not: null },
          // Only auto punch out if the checkIn was before today (avoiding midnight race conditions)
          date: { lt: new Date(new Date().setHours(0, 0, 0, 0)) }
        }
      });
      
      console.log(`Found ${activeAttendances.length} users needing auto punch out.`);

      for (const record of activeAttendances) {
        if (!record.checkIn) continue;
        
        // Auto check out at 11:59:59 PM of the check-in day
        const checkOutTime = new Date(record.date);
        checkOutTime.setHours(23, 59, 59, 999);
        
        const start = record.checkIn.getTime();
        const end = checkOutTime.getTime();
        // Working hours mapped to typical structure: (ms -> hours)
        const workingHours = (end - start) / (1000 * 60 * 60);

        await prisma.attendance.update({
          where: { id: record.id },
          data: {
            checkOut: checkOutTime,
            workingHours: Number(workingHours.toFixed(2)),
            checkOutLocation: { systemAutoPunchOut: true, time: new Date() }
          }
        });
      }
      if (activeAttendances.length > 0) {
        console.log(`✅ Auto punched out ${activeAttendances.length} users`);
      }
    } catch (error) {
      console.error('❌ Auto punch out cron error:', error);
    }
  });
};
