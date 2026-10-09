// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getOrganizations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizations = await prisma.organization.findMany({
    where: { singletonKey: 'primary' },
  });
  res.status(200).json({ success: true, count: organizations.length, data: organizations });
});

export const getOrganization = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organization = await prisma.organization.findFirst({
    where: { id: req.params.id, singletonKey: 'primary' },
  });
  if (!organization) {
    res.status(404).json({ success: false, message: 'Organization not found' });
    return;
  }
  res.status(200).json({ success: true, data: organization });
});

export const createOrganization = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existingOrganization = await prisma.organization.findUnique({
    where: { singletonKey: 'primary' },
    select: { id: true },
  });
  if (existingOrganization) {
    res.status(409).json({ success: false, message: 'Only one organization is allowed.' });
    return;
  }

  const { name, email, phone, ...rest } = req.body;
  
  const slug = rest.slug || name.toLowerCase()
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '') + '-' + Math.random().toString(36).substring(2, 7);

  let organization;
  try {
    organization = await prisma.organization.create({
      data: {
        name,
        email,
        phone,
        slug,
        address: rest.address,
        contactEmail: email || rest.contactEmail,
        contactPhone: phone || rest.contactPhone,
        plan: rest.plan,
        logo: rest.logo,
        status: rest.status,
        licenseId: rest.licenseId,
        licenseExpiry: rest.licenseExpiry,
        metadata: rest.metadata,
      }
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      res.status(409).json({ success: false, message: 'Only one organization is allowed.' });
      return;
    }
    throw error;
  }
  res.status(201).json({ success: true, data: organization });
});

export const updateOrganization = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organization = await prisma.organization.findFirst({
    where: { id: req.params.id, singletonKey: 'primary' },
  });
  if (!organization) {
    res.status(404).json({ success: false, message: 'Organization not found' });
    return;
  }

  const { name, email, phone, address, contactEmail, contactPhone, plan, logo, status, licenseId, licenseExpiry, metadata } = req.body;
  const updatedOrganization = await prisma.organization.update({
    where: { id: organization.id },
    data: { name, email, phone, address, contactEmail, contactPhone, plan, logo, status, licenseId, licenseExpiry, metadata }
  });
  res.status(200).json({ success: true, data: updatedOrganization });
});

export const deleteOrganization = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organization = await prisma.organization.findFirst({
    where: { id: req.params.id, singletonKey: 'primary' },
    select: { id: true },
  });
  if (!organization) {
    res.status(404).json({ success: false, message: 'Organization not found' });
    return;
  }
  res.status(409).json({
    success: false,
    message: 'The single organization cannot be deleted. Use the protected single-tenant reset script to start over.',
  });
});

export const assignLicense = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { licenseId, durationMonths } = req.body;
  const organization = await prisma.organization.findFirst({
    where: { id: req.params.id, singletonKey: 'primary' },
    select: { id: true },
  });
  if (!organization) {
    res.status(404).json({ success: false, message: 'Organization not found' });
    return;
  }
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + durationMonths);

  const updatedOrg = await prisma.organization.update({
    where: { id: organization.id },
    data: {
      licenseId,
      licenseExpiry: expiryDate,
    }
  });
  res.status(200).json({ success: true, data: updatedOrg });
});
