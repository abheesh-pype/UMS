// @ts-nocheck
import prisma from '../lib/prisma.js';

/**
 * Calculates current Financial Year string (e.g. "FY 2026-27")
 * In India, FY runs from April 1 to March 31.
 */
export const calculateFinancialYear = (date: Date = new Date()): string => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1 - 12
  const startYear = month >= 4 ? year : year - 1;
  const nextYearShort = String((startYear + 1) % 100).padStart(2, '0');
  return `FY ${startYear}-${nextYearShort}`;
};

/**
 * Calculates Academic Year string (e.g. "AY 2026-27")
 */
export const calculateAcademicYear = (sessionName?: string | null, date: Date = new Date()): string => {
  if (sessionName && sessionName.trim()) {
    // If session name already looks like "2026-2027" or "2026-27"
    if (/\d{4}/.test(sessionName)) {
      return sessionName.trim();
    }
  }
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const startYear = month >= 6 ? year : year - 1;
  const nextYearShort = String((startYear + 1) % 100).padStart(2, '0');
  return `AY ${startYear}-${nextYearShort}`;
};

/**
 * Generates next sequential Invoice Number (e.g. "INV-2026-00001")
 */
export const generateNextInvoiceNumber = async (organizationId: string): Promise<string> => {
  const currentYear = new Date().getFullYear();
  const count = await prisma.invoice.count({
    where: { organizationId }
  });

  let nextSeq = count + 1;
  let candidate = `INV-${currentYear}-${String(nextSeq).padStart(5, '0')}`;

  // Ensure uniqueness in case of race condition
  let exists = await prisma.invoice.findUnique({ where: { invoiceNo: candidate } });
  while (exists) {
    nextSeq += 1;
    candidate = `INV-${currentYear}-${String(nextSeq).padStart(5, '0')}`;
    exists = await prisma.invoice.findUnique({ where: { invoiceNo: candidate } });
  }

  return candidate;
};

/**
 * Generates next sequential Receipt Number (e.g. "RCP-2026-00001")
 */
export const generateNextReceiptNumber = async (organizationId: string): Promise<string> => {
  const currentYear = new Date().getFullYear();
  const count = await prisma.paymentEntry.count({
    where: { organizationId }
  });

  let nextSeq = count + 1;
  let candidate = `RCP-${currentYear}-${String(nextSeq).padStart(5, '0')}`;

  // Ensure uniqueness in case of race condition
  let exists = await prisma.paymentEntry.findFirst({ where: { receiptNo: candidate } });
  while (exists) {
    nextSeq += 1;
    candidate = `RCP-${currentYear}-${String(nextSeq).padStart(5, '0')}`;
    exists = await prisma.paymentEntry.findFirst({ where: { receiptNo: candidate } });
  }

  return candidate;
};

/**
 * Generates an Invoice for an Enrollment.
 * If an active invoice already exists for this enrollment, returns the existing one.
 */
export const generateInvoiceForEnrollment = async (
  enrollmentId: string,
  options?: {
    invoiceType?: string;
    dueDate?: Date;
    cycleIndex?: number;
    forceNew?: boolean;
  }
) => {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      student: true,
      program: {
        include: {
          university: true
        }
      },
      session: true,
      studyCenter: true,
      organization: true,
      payment: true,
      studentFeeReceipts: true,
      invoices: {
        include: {
          payments: true
        }
      }
    }
  });

  if (!enrollment) {
    throw new Error(`Enrollment not found for ID: ${enrollmentId}`);
  }

  // If not forcing new and an invoice already exists for this enrollment, return existing
  if (!options?.forceNew && enrollment.invoices && enrollment.invoices.length > 0) {
    return enrollment.invoices[0];
  }

  const organization = enrollment.organization;
  const program = enrollment.program;
  const university = program?.university;
  const student = enrollment.student;
  const session = enrollment.session;
  const studyCenter = enrollment.studyCenter;

  // 1. Fetch fee structure
  let feeStructure = await prisma.programFeeStructure.findFirst({
    where: {
      organizationId: enrollment.organizationId,
      programId: enrollment.programId,
      admissionSessionId: enrollment.sessionId,
      level: 'program'
    }
  });

  if (!feeStructure) {
    feeStructure = await prisma.programFeeStructure.findFirst({
      where: {
        organizationId: enrollment.organizationId,
        programId: enrollment.programId,
        level: 'program'
      }
    });
  }

  if (!feeStructure && university?.id) {
    feeStructure = await prisma.programFeeStructure.findFirst({
      where: {
        organizationId: enrollment.organizationId,
        universityId: university.id,
        admissionSessionId: enrollment.sessionId,
        level: 'university'
      }
    });
  }

  if (!feeStructure && university?.id) {
    feeStructure = await prisma.programFeeStructure.findFirst({
      where: {
        organizationId: enrollment.organizationId,
        universityId: university.id,
        level: 'university'
      }
    });
  }

  // 2. Prepare fee items
  const items: Array<{
    description: string;
    category: string;
    quantity: number;
    rate: number;
    taxRate: number;
    amount: number;
  }> = [];

  let subtotal = 0;
  let taxRatePercent = 0;
  let gstSetting = await prisma.gSTSetting.findFirst({
    where: {
      organizationId: enrollment.organizationId,
      status: 'active'
    }
  });

  if (feeStructure) {
    const additionalFees = Array.isArray(feeStructure.additionalFees)
      ? (feeStructure.additionalFees as any[])
      : [];
    const gstFee = additionalFees.find(f => f.label?.toLowerCase() === 'gst');
    taxRatePercent = gstFee ? Number(gstFee.amount || 0) : (gstSetting ? gstSetting.gstPercentage : 0);

    let breakdowns = feeStructure.feeBreakdown;
    if (typeof breakdowns === 'string') {
      try { breakdowns = JSON.parse(breakdowns); } catch (e) { breakdowns = []; }
    }

    if (Array.isArray(breakdowns) && breakdowns.length > 0) {
      const cycleIdx = options?.cycleIndex !== undefined ? options.cycleIndex : 0;
      const b = breakdowns[cycleIdx] || breakdowns[0];

      if (b.baseFee && Number(b.baseFee) > 0) {
        items.push({
          description: `Tuition Fee (${b.year || session?.name || 'Semester/Year 1'})`,
          category: 'tuition',
          quantity: 1,
          rate: Number(b.baseFee),
          taxRate: taxRatePercent,
          amount: Number(b.baseFee)
        });
      }

      if (b.examFee && Number(b.examFee) > 0) {
        items.push({
          description: 'Examination Fee',
          category: 'examination',
          quantity: 1,
          rate: Number(b.examFee),
          taxRate: taxRatePercent,
          amount: Number(b.examFee)
        });
      }

      if (b.universityFee && Number(b.universityFee) > 0) {
        items.push({
          description: 'University Registration / Portal Fee',
          category: 'university',
          quantity: 1,
          rate: Number(b.universityFee),
          taxRate: taxRatePercent,
          amount: Number(b.universityFee)
        });
      }

      // Cycle custom additional fees e.g. "Lab:1000, Library:500"
      if (typeof b.additionalFees === 'string' && b.additionalFees.trim()) {
        b.additionalFees.split(',').forEach((entry: string) => {
          const parts = entry.trim().split(':');
          const label = parts[0]?.trim();
          const amt = Number(parts[1]) || 0;
          if (label && amt > 0) {
            items.push({
              description: label,
              category: 'misc',
              quantity: 1,
              rate: amt,
              taxRate: taxRatePercent,
              amount: amt
            });
          }
        });
      }

      // First cycle receives global additional non-GST fees
      if (cycleIdx === 0) {
        additionalFees
          .filter(f => f.label && f.label.toLowerCase() !== 'gst' && Number(f.amount) > 0)
          .forEach(f => {
            items.push({
              description: f.label,
              category: 'admission',
              quantity: 1,
              rate: Number(f.amount),
              taxRate: taxRatePercent,
              amount: Number(f.amount)
            });
          });
      }
    } else {
      // Flat fee structure
      if (feeStructure.baseFee && feeStructure.baseFee > 0) {
        items.push({
          description: `Tuition Fee (${program?.name || 'Course Fee'})`,
          category: 'tuition',
          quantity: 1,
          rate: feeStructure.baseFee,
          taxRate: taxRatePercent,
          amount: feeStructure.baseFee
        });
      }

      if (feeStructure.universityFee && feeStructure.universityFee > 0) {
        items.push({
          description: 'University Administration Fee',
          category: 'university',
          quantity: 1,
          rate: feeStructure.universityFee,
          taxRate: taxRatePercent,
          amount: feeStructure.universityFee
        });
      }

      additionalFees
        .filter(f => f.label && f.label.toLowerCase() !== 'gst' && Number(f.amount) > 0)
        .forEach(f => {
          items.push({
            description: f.label,
            category: 'additional',
            quantity: 1,
            rate: Number(f.amount),
            taxRate: taxRatePercent,
            amount: Number(f.amount)
          });
        });
    }
  }

  const extraFees = Array.isArray(enrollment.extraFees) ? enrollment.extraFees : [];

  // Use the legacy fallback only when the enrollment has no explicit or extra fees.
  if (items.length === 0 && extraFees.length === 0) {
    const feeAmt = enrollment.totalFee || 25000;
    items.push({
      description: `Course Enrollment Fee - ${program?.name || 'Academic Course'}`,
      category: 'tuition',
      quantity: 1,
      rate: feeAmt,
      taxRate: taxRatePercent,
      amount: feeAmt
    });
  }

  extraFees.forEach((fee: any, index: number) => {
    const amount = Number(fee.amount) || 0;
    if (amount <= 0) return;
    items.push({
      description: fee.reason || 'Additional Fee',
      category: 'extra_fee',
      quantity: 1,
      rate: amount,
      taxRate: taxRatePercent,
      amount,
      extraFeeId: fee.id || `legacy-extra-fee-${index}`
    });
  });

  subtotal = items.reduce((sum, item) => sum + item.amount, 0);

  // If enrollment.totalFee is explicitly recorded and differs, ensure consistency
  let taxAmount = 0;
  if (taxRatePercent > 0) {
    taxAmount = Math.round((subtotal * taxRatePercent) / 100);
  }

  let totalPayable = subtotal + taxAmount;
  const recordedEnrollmentFee = Number(enrollment.totalFee || 0) + extraFees.reduce(
    (sum: number, fee: any) => sum + (Number(fee.amount) || 0),
    0
  );
  if (recordedEnrollmentFee && Math.abs(recordedEnrollmentFee - totalPayable) < 5) {
    totalPayable = recordedEnrollmentFee;
  }

  // 3. Tax breakdown (CGST + SGST or IGST)
  const isInterstate = false; // By default intra-state CGST + SGST 50-50
  const taxDetails = {
    taxRatePercent,
    taxAmount,
    cgstRate: isInterstate ? 0 : taxRatePercent / 2,
    cgstAmount: isInterstate ? 0 : Math.round(taxAmount / 2),
    sgstRate: isInterstate ? 0 : taxRatePercent / 2,
    sgstAmount: isInterstate ? 0 : Math.round(taxAmount / 2),
    igstRate: isInterstate ? taxRatePercent : 0,
    igstAmount: isInterstate ? taxAmount : 0,
    hsnSacCode: gstSetting?.sacCode || '999293', // Educational services SAC code
    gstin: (university?.optionalFields as any)?.gstin || organization?.metadata?.gstin || '27AAACG0584P1Z3'
  };

  // 4. University Details snapshot
  const uniOpt = (university?.optionalFields as any) || {};
  const universityDetails = {
    id: university?.id || null,
    name: university?.name || organization?.name || 'Autonomous State University',
    code: university?.code || 'UNIV',
    logo: organization?.logo || uniOpt.logo || '/logo.png',
    address: university?.address || organization?.address || '123 University Campus, Academic Avenue, EduCity',
    contact: university?.contact || organization?.contactPhone || organization?.phone || '+91 98765 43210',
    email: organization?.contactEmail || organization?.email || 'finance@university.edu',
    website: organization?.slug ? `https://${organization.slug}.edu` : 'https://prohostix.edu',
    gstin: taxDetails.gstin,
    panNumber: uniOpt.pan || 'AAACG0584P',
    bankDetails: {
      bankName: uniOpt.bankName || 'State Bank of India',
      accountName: uniOpt.accountName || university?.name || organization?.name || 'University Collection A/C',
      accountNumber: uniOpt.accountNumber || '40928374921',
      ifscCode: uniOpt.ifscCode || 'SBIN0001234',
      branch: uniOpt.branch || 'University Campus Main Branch',
      upiId: uniOpt.upiId || 'payments@universityupi'
    }
  };

  // 5. Student Details snapshot
  const studentDetails = {
    id: student?.id || null,
    studentId: student?.enrollmentNo || student?.id || `STU-${enrollment.id.substring(0, 8)}`,
    fullName: enrollment.studentName,
    email: enrollment.studentEmail,
    phone: enrollment.studentPhone,
    address: enrollment.studentAddress,
    enrollmentNumber: enrollment.enrollmentNumber || student?.enrollmentNo || 'PENDING',
    uniEnrollmentNumber: enrollment.uniEnrollmentNumber || student?.enrollmentNo || enrollment.enrollmentNumber || 'PENDING',
    programName: program?.name || 'Higher Education Degree',
    programCode: program?.code || 'PRG',
    specialisation: enrollment.specialisation || student?.specialisation || 'General',
    sessionName: session?.name || 'Current Session',
    studyCenterName: studyCenter?.name || null,
    studyCenterCode: studyCenter?.code || null,
    admissionType: studyCenter ? `Study Centre (${studyCenter.name})` : 'Direct University'
  };

  // 6. Payment Instructions snapshot
  const paymentInstructions = {
    instructions: 'Please make payments strictly via official University NetBanking, UPI, or through the verified Student Portal. Reference the Invoice Number on all remittances.',
    bankName: universityDetails.bankDetails.bankName,
    accountHolder: universityDetails.bankDetails.accountName,
    accountNumber: universityDetails.bankDetails.accountNumber,
    ifscCode: universityDetails.bankDetails.ifscCode,
    branch: universityDetails.bankDetails.branch,
    upiId: universityDetails.bankDetails.upiId,
    terms: 'Fees once paid are non-refundable according to University UGC norms. Late fees may apply for delayed installments.'
  };

  // 7. Calculate existing verified payments (e.g. from studentFeeReceipts or enrollment.payment)
  const manualReceipts = (enrollment.studentFeeReceipts || []).reduce(
    (sum, r) => sum + (Number(r.amount) || 0),
    0
  );
  const initialWalletPayment = Number(enrollment.payment?.amount || 0);
  const totalPaidPrior = manualReceipts + initialWalletPayment;

  const paidAmount = Math.min(totalPaidPrior, totalPayable);
  const balanceAmount = Math.max(0, totalPayable - paidAmount);

  // Due Date calculation (defaults to 15 days from issue or custom)
  const issuedAt = new Date();
  const dueDate = options?.dueDate
    ? new Date(options.dueDate)
    : new Date(issuedAt.getTime() + 15 * 24 * 60 * 60 * 1000);

  // Status computation
  let status = 'unpaid';
  if (totalPayable === 0 || balanceAmount <= 0) {
    status = 'paid';
  } else if (paidAmount > 0) {
    status = 'partially_paid';
  } else if (dueDate < new Date()) {
    status = 'overdue';
  }

  // 8. Generate unique invoice number
  const invoiceNo = await generateNextInvoiceNumber(enrollment.organizationId);
  const financialYear = calculateFinancialYear(issuedAt);
  const academicYear = calculateAcademicYear(session?.name, issuedAt);
  const invoiceType = options?.invoiceType || (enrollment.paymentMethod === 'installment' ? 'installment' : 'tuition');

  // 9. Create Invoice in database
  const invoice = await prisma.invoice.create({
    data: {
      organizationId: enrollment.organizationId,
      enrollmentId: enrollment.id,
      studentId: student?.id || null,
      centerId: studyCenter?.id || null,
      universityId: university?.id || null,
      invoiceNo,
      invoiceType,
      financialYear,
      academicYear,
      period: session?.name || 'Semester 1',
      amount: subtotal,
      tax: taxAmount,
      total: totalPayable,
      paidAmount,
      balanceAmount,
      status,
      items,
      taxDetails,
      universityDetails,
      studentDetails,
      paymentInstructions,
      issuedAt,
      dueDate,
      paidAt: status === 'paid' ? new Date() : null
    }
  });

  // 10. If there are prior payments (e.g. studentFeeReceipts), link them to PaymentEntry records
  const fallbackUser = await prisma.user.findFirst({
    where: { organizationId: enrollment.organizationId },
    select: { id: true }
  });
  const defaultReceiverId = enrollment.financeReviewedBy || enrollment.assignedFinanceUserId || fallbackUser?.id;

  if (enrollment.studentFeeReceipts && enrollment.studentFeeReceipts.length > 0 && defaultReceiverId) {
    for (const r of enrollment.studentFeeReceipts) {
      const receiptNo = await generateNextReceiptNumber(enrollment.organizationId);
      await prisma.paymentEntry.create({
        data: {
          organizationId: enrollment.organizationId,
          invoiceId: invoice.id,
          amount: Number(r.amount),
          method: r.paymentMode || 'Direct Deposit',
          studentFeeReceiptId: r.id,
          referenceNo: r.referenceNo || null,
          receiptNo,
          receiptDate: r.receiptDate || new Date(),
          receivedBy: r.recordedBy || defaultReceiverId,
          receivedAt: r.receiptDate || new Date(),
          notes: r.remarks || `Receipt synced from enrollment approval (${r.id})`
        }
      });
    }
  }

  if (initialWalletPayment > 0 && defaultReceiverId) {
    const receiptNo = await generateNextReceiptNumber(enrollment.organizationId);
    await prisma.paymentEntry.create({
      data: {
        organizationId: enrollment.organizationId,
        invoiceId: invoice.id,
        amount: initialWalletPayment,
        method: 'Wallet / Direct Payment',
        referenceNo: enrollment.payment?.transactionId || null,
        receiptNo,
        receiptDate: enrollment.payment?.createdAt || new Date(),
        receivedBy: defaultReceiverId,
        receivedAt: enrollment.payment?.createdAt || new Date(),
        notes: 'Initial admission fee payment'
      }
    });
  }

  // Recalculate and return enriched invoice
  return await recalculateInvoiceBalance(invoice.id);
};

/**
 * Recalculates Invoice paidAmount, balanceAmount, and status based on linked PaymentEntries.
 */
export const recalculateInvoiceBalance = async (invoiceId: string) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      payments: {
        orderBy: { receivedAt: 'desc' },
        include: { receiver: { select: { name: true, email: true } } }
      },
      enrollment: {
        include: {
          program: true,
          studyCenter: true
        }
      },
      student: true,
      center: true
    }
  });

  if (!invoice) {
    throw new Error(`Invoice not found for ID: ${invoiceId}`);
  }

  const payments = invoice.payments || [];
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const paidAmount = Math.min(totalPaid, invoice.total);
  const balanceAmount = Math.max(0, invoice.total - paidAmount);

  let status = invoice.status;
  // If cancelled, keep cancelled
  if (status !== 'cancelled') {
    if (invoice.total === 0 || balanceAmount <= 0) {
      status = 'paid';
    } else if (paidAmount > 0) {
      status = 'partially_paid';
    } else if (invoice.dueDate && new Date(invoice.dueDate) < new Date()) {
      status = 'overdue';
    } else {
      status = 'unpaid';
    }
  }

  const mostRecentPayment = payments[0];
  const paidAt = status === 'paid' ? (mostRecentPayment?.receivedAt || new Date()) : null;

  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      paidAmount,
      balanceAmount,
      status,
      paidAt
    },
    include: {
      payments: {
        orderBy: { receivedAt: 'desc' },
        include: { receiver: { select: { name: true, email: true } } }
      },
      enrollment: {
        include: {
          program: true,
          studyCenter: true
        }
      },
      student: true,
      center: true
    }
  });

  return updatedInvoice;
};

/**
 * Records a payment against an invoice, creates a receipt, and updates balance.
 */
export const recordPaymentForInvoice = async (
  invoiceId: string,
  paymentData: {
    amount: number;
    method: string;
    referenceNo?: string;
    receivedBy: string;
    notes?: string;
    receivedAt?: Date;
  }
) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId }
  });

  if (!invoice) {
    throw new Error(`Invoice not found for ID: ${invoiceId}`);
  }

  const paymentAmount = Number(paymentData.amount);
  if (!paymentAmount || paymentAmount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  // 1. Generate sequential receipt number
  const receiptNo = await generateNextReceiptNumber(invoice.organizationId);
  const receivedAtDate = paymentData.receivedAt ? new Date(paymentData.receivedAt) : new Date();

  // Validate or fallback receiver User
  let receiverUserId = paymentData.receivedBy;
  const userCheck = receiverUserId
    ? await prisma.user.findFirst({ where: { id: receiverUserId }, select: { id: true } })
    : null;
  if (!userCheck) {
    const fallbackUser = await prisma.user.findFirst({
      where: { organizationId: invoice.organizationId },
      select: { id: true }
    });
    receiverUserId = fallbackUser?.id || paymentData.receivedBy;
  }

  // If linked to an enrollment, create the legacy receipt and link it to this invoice payment.
  let studentFeeReceiptId: string | undefined;
  if (invoice.enrollmentId) {
    const studentFeeReceipt = await prisma.studentFeeReceipt.create({
      data: {
        organizationId: invoice.organizationId,
        enrollmentId: invoice.enrollmentId,
        amount: paymentAmount,
        paymentMode: paymentData.method || 'Online Transfer',
        referenceNo: paymentData.referenceNo || receiptNo,
        remarks: paymentData.notes || `Payment against invoice ${invoice.invoiceNo} (Receipt: ${receiptNo})`,
        receiptDate: receivedAtDate,
        recordedBy: receiverUserId
      }
    });
    studentFeeReceiptId = studentFeeReceipt.id;
  }

  const payment = await prisma.paymentEntry.create({
    data: {
      organizationId: invoice.organizationId,
      invoiceId: invoice.id,
      studentFeeReceiptId,
      amount: paymentAmount,
      method: paymentData.method || 'Online Transfer',
      referenceNo: paymentData.referenceNo || null,
      receiptNo,
      receiptDate: receivedAtDate,
      receivedBy: receiverUserId,
      receivedAt: receivedAtDate,
      notes: paymentData.notes || null
    }
  });

  const updatedInvoice = await recalculateInvoiceBalance(invoice.id);

  return {
    invoice: updatedInvoice,
    payment,
    receiptNo
  };
};

export const syncStudentFeeReceiptsToInvoices = async (organizationId: string) => {
  const receipts = await prisma.studentFeeReceipt.findMany({
    where: {
      organizationId,
      invoicePayment: null
    },
    orderBy: { receiptDate: 'asc' }
  });
  const syncedInvoiceIds = new Set<string>();

  for (const receipt of receipts) {
    let invoice = await prisma.invoice.findFirst({
      where: { enrollmentId: receipt.enrollmentId, organizationId },
      orderBy: { createdAt: 'desc' }
    });

    if (!invoice) {
      invoice = await generateInvoiceForEnrollment(receipt.enrollmentId);
    } else {
      const possibleLegacyPayments = await prisma.paymentEntry.findMany({
        where: {
          organizationId,
          invoiceId: invoice.id,
          studentFeeReceiptId: null,
          amount: Number(receipt.amount),
          method: receipt.paymentMode || 'Direct Deposit',
          referenceNo: receipt.referenceNo || null,
          receivedAt: receipt.receiptDate
        }
      });

      if (possibleLegacyPayments.length === 1) {
        await prisma.paymentEntry.update({
          where: { id: possibleLegacyPayments[0].id },
          data: { studentFeeReceiptId: receipt.id }
        });
      } else {
        await prisma.paymentEntry.create({
          data: {
            organizationId,
            invoiceId: invoice.id,
            studentFeeReceiptId: receipt.id,
            amount: Number(receipt.amount),
            method: receipt.paymentMode || 'Direct Deposit',
            referenceNo: receipt.referenceNo || null,
            receiptNo: await generateNextReceiptNumber(organizationId),
            receiptDate: receipt.receiptDate,
            receivedBy: receipt.recordedBy,
            receivedAt: receipt.receiptDate,
            notes: receipt.remarks || `Student fee receipt ${receipt.id}`
          }
        });
      }
    }

    syncedInvoiceIds.add(invoice.id);
  }

  for (const invoiceId of syncedInvoiceIds) {
    await recalculateInvoiceBalance(invoiceId);
  }

  return { syncedReceipts: receipts.length };
};

export const syncPaidUniversityFeeInvoices = async (organizationId: string) => {
  const feePayments = await prisma.universityFeePayment.findMany({
    where: { organizationId, status: 'paid' },
    include: {
      student: {
        include: {
          program: { select: { id: true, name: true, code: true } },
          center: { select: { id: true, name: true, code: true } }
        }
      }
    },
    orderBy: { paidAt: 'asc' }
  });
  const receiver = await prisma.user.findFirst({
    where: { organizationId },
    select: { id: true }
  });
  if (feePayments.length > 0 && !receiver) {
    throw new Error(`Cannot invoice university fee payments for organization ${organizationId}: no receipt receiver user exists`);
  }

  let generated = 0;
  for (const feePayment of feePayments) {
    if (!feePayment.student) {
      throw new Error(`Cannot invoice university fee payment ${feePayment.id}: student record not found`);
    }
    const receivedAt = feePayment.paidAt || feePayment.createdAt;
    const invoiceNo = `INV-UF-${feePayment.id}`;
    let invoice = await prisma.invoice.findUnique({ where: { invoiceNo } });
    if (!invoice && feePayment.invoiceId) {
      const linkedInvoice = await prisma.invoice.findFirst({
        where: {
          id: feePayment.invoiceId,
          organizationId,
          invoiceType: 'university_fee',
          period: feePayment.semesterOrYear
        }
      });
      if (linkedInvoice) invoice = linkedInvoice;
    }
    if (!invoice) {
      const student = feePayment.student;
      const item = {
        description: `${feePayment.semesterOrYear} University Fee`,
        category: 'university',
        quantity: 1,
        rate: Number(feePayment.amount),
        taxRate: 0,
        amount: Number(feePayment.amount)
      };
      invoice = await prisma.invoice.create({
        data: {
          organizationId,
          centerId: student.centerId || null,
          studentId: student.id,
          invoiceNo,
          invoiceType: 'university_fee',
          financialYear: calculateFinancialYear(receivedAt),
          period: feePayment.semesterOrYear,
          amount: Number(feePayment.amount),
          tax: 0,
          total: Number(feePayment.amount),
          paidAmount: Number(feePayment.amount),
          balanceAmount: 0,
          status: 'paid',
          items: [item],
          studentDetails: {
            id: student.id,
            fullName: student.name,
            studentId: student.enrollmentNo || student.id,
            enrollmentNumber: student.enrollmentNo || 'N/A',
            programName: student.program?.name || 'University Fee',
            programCode: student.program?.code || '',
            admissionType: student.center ? `Study Centre (${student.center.name})` : 'Direct University'
          },
          issuedAt: receivedAt,
          paidAt: receivedAt
        }
      });
    }

    const linkedPayment = await prisma.paymentEntry.findFirst({
      where: {
        organizationId,
        invoiceId: invoice.id,
        notes: `University fee payment ${feePayment.id}`
      }
    });
    if (!linkedPayment) {
      await prisma.paymentEntry.create({
        data: {
          organizationId,
          invoiceId: invoice.id,
          amount: Number(feePayment.amount),
          method: 'University Fee Payment',
          referenceNo: feePayment.referenceNo || feePayment.screenshot || null,
          receiptNo: await generateNextReceiptNumber(organizationId),
          receiptDate: receivedAt,
          receivedBy: receiver!.id,
          receivedAt,
          notes: `University fee payment ${feePayment.id}`
        }
      });
    }

    if (feePayment.invoiceId !== invoice.id) {
      await prisma.universityFeePayment.update({
        where: { id: feePayment.id },
        data: { invoiceId: invoice.id }
      });
    }
    await recalculateInvoiceBalance(invoice.id);
    generated += 1;
  }

  return { syncedPayments: generated };
};

/**
 * Auto-generates missing invoices for all enrolled students in the organization.
 */
export const autoGenerateMissingInvoices = async (organizationId: string) => {
  // Find all enrolled students who don't have an invoice
  const enrollments = await prisma.enrollment.findMany({
    where: {
      organizationId,
      status: 'enrolled',
      invoices: {
        none: {}
      }
    },
    select: {
      id: true,
      studentName: true,
      enrollmentNumber: true
    }
  });

  const results = {
    totalEligible: enrollments.length,
    generated: 0,
    errors: [] as string[]
  };

  for (const enr of enrollments) {
    try {
      await generateInvoiceForEnrollment(enr.id);
      results.generated += 1;
    } catch (err: any) {
      results.errors.push(`Enrollment ${enr.enrollmentNumber || enr.id} (${enr.studentName}): ${err.message}`);
    }
  }

  return results;
};

/**
 * Checks for overdue invoices and updates their status.
 */
export const checkOverdueInvoices = async (organizationId?: string) => {
  const where: any = {
    status: { in: ['unpaid', 'partially_paid'] },
    dueDate: { lt: new Date() },
    balanceAmount: { gt: 0 }
  };

  if (organizationId) {
    where.organizationId = organizationId;
  }

  const result = await prisma.invoice.updateMany({
    where,
    data: {
      status: 'overdue'
    }
  });

  return result.count;
};
