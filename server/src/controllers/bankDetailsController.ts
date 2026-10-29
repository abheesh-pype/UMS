import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Collection bank account shown on every invoice for making payments.
export const BANK_DETAIL_FIELDS = [
  'bankName',
  'accountHolder',
  'accountNumber',
  'ifscCode',
  'branch',
  'upiId',
  'panNumber',
  'gstin',
  'instructions',
] as const;

const REQUIRED_FIELDS: Record<string, string> = {
  bankName: 'Bank name',
  accountHolder: 'Account holder name',
  accountNumber: 'Account number',
  ifscCode: 'IFSC code',
};

const emptyBankDetails = () => Object.fromEntries(BANK_DETAIL_FIELDS.map(field => [field, ''])) as Record<string, string>;

export const getBankDetails = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organization = await prisma.organization.findUnique({
    where: { id: req.user.organizationId },
    select: { bankDetails: true },
  });
  const saved = (organization?.bankDetails as Record<string, any>) || {};
  res.json({
    success: true,
    data: { ...emptyBankDetails(), ...saved },
    configured: Boolean(saved.accountNumber && saved.ifscCode),
  });
});

export const updateBankDetails = asyncHandler(async (req: AuthRequest, res: Response) => {
  const values: Record<string, string> = {};
  for (const field of BANK_DETAIL_FIELDS) {
    const raw = req.body?.[field];
    values[field] = typeof raw === 'string' ? raw.trim() : '';
  }
  values.ifscCode = values.ifscCode.toUpperCase();
  values.panNumber = values.panNumber.toUpperCase();
  values.gstin = values.gstin.toUpperCase();
  values.accountNumber = values.accountNumber.replace(/\s+/g, '');

  const missing = Object.entries(REQUIRED_FIELDS).filter(([field]) => !values[field]).map(([, label]) => label);
  if (missing.length > 0) {
    res.status(400).json({ success: false, message: `${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} required` });
    return;
  }
  if (!/^\d{6,20}$/.test(values.accountNumber)) {
    res.status(400).json({ success: false, message: 'Account number must be 6 to 20 digits' });
    return;
  }
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(values.ifscCode)) {
    res.status(400).json({ success: false, message: 'IFSC code must be 11 characters, e.g. SBIN0001234' });
    return;
  }
  if (values.upiId && !/^[\w.-]{2,}@[a-zA-Z][\w.-]*$/.test(values.upiId)) {
    res.status(400).json({ success: false, message: 'UPI ID must look like name@bank' });
    return;
  }
  if (values.panNumber && !/^[A-Z]{5}\d{4}[A-Z]$/.test(values.panNumber)) {
    res.status(400).json({ success: false, message: 'PAN must be 10 characters, e.g. ABCDE1234F' });
    return;
  }
  if (values.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(values.gstin)) {
    res.status(400).json({ success: false, message: 'GSTIN must be 15 characters, e.g. 27ABCDE1234F1Z5' });
    return;
  }

  const bankDetails = {
    ...values,
    updatedAt: new Date().toISOString(),
    updatedBy: req.user.name || null,
  };
  await prisma.organization.update({
    where: { id: req.user.organizationId },
    data: { bankDetails },
  });
  res.json({ success: true, data: bankDetails, configured: true, message: 'Bank details updated' });
});
