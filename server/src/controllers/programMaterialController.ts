// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getProgramMaterials = asyncHandler(async (req: AuthRequest, res: Response) => {
  const materials = await prisma.programMaterial.findMany({
    where: { 
      programId: req.params.programId, 
      organizationId: req.user.organizationId, 
      isActive: true 
    },
    include: {
      uploader: {
        select: { name: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ success: true, count: materials.length, data: materials });
});

export const getAllProgramEbooks = asyncHandler(async (req: AuthRequest, res: Response) => {
  const materials = await prisma.programMaterial.findMany({
    where: {
      organizationId: req.user.organizationId,
      category: 'ebook',
      isActive: true,
    },
    include: {
      program: {
        select: {
          id: true,
          name: true,
          academicSession: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const moduleIds = materials
    .map(material => material.description?.match(/^Module: ([\w-]+) - /)?.[1])
    .filter(Boolean);
  const modules = moduleIds.length
    ? await prisma.module.findMany({
      where: { id: { in: moduleIds }, organizationId: req.user.organizationId },
      select: {
        id: true,
        moduleName: true,
        academicSession: { select: { id: true, name: true } },
      },
    })
    : [];
  const modulesById = new Map(modules.map(module => [module.id, module]));
  const data = materials.map(material => {
    const moduleId = material.description?.match(/^Module: ([\w-]+) - /)?.[1];
    const module = moduleId ? modulesById.get(moduleId) : null;
    return {
      ...material,
      module,
      session: module?.academicSession || material.program.academicSession,
    };
  }).filter(material => material.module);

  res.json({ success: true, count: data.length, data });
});

export const getProgramDetail = asyncHandler(async (req: AuthRequest, res: Response) => {
  const program = await prisma.program.findUnique({ 
    where: { id: req.params.programId }, 
    include: { university: true } 
  });
  res.json({ success: true, data: program });
});

export const uploadProgramMaterial = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: 'Please upload a file' });
    return;
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  const fileName = req.file.originalname;

  const material = await prisma.programMaterial.create({
    data: {
      title: req.body.title || 'Untitled',
      description: req.body.description,
      category: req.body.category || 'study_material',
      semesterNumber: req.body.semesterNumber ? String(req.body.semesterNumber) : null,
      fileUrl,
      fileName,
      isActive: true,
      program: { connect: { id: req.params.programId } },
      organization: { connect: { id: req.user.organizationId } },
      uploader: { connect: { id: req.user.id } }
    }
  });
  res.status(201).json({ success: true, data: material });
});

export const updateProgramMaterial = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existingMaterial = await prisma.programMaterial.findFirst({
    where: {
      id: req.params.materialId,
      programId: req.params.programId,
      organizationId: req.user.organizationId,
      isActive: true,
    },
    select: { id: true },
  });
  if (!existingMaterial) {
    res.status(404).json({ success: false, message: 'Material not found' });
    return;
  }

  const data: any = {};
  if (req.body.title !== undefined) data.title = req.body.title;
  if (req.body.description !== undefined) data.description = req.body.description;
  if (req.body.category !== undefined) data.category = req.body.category;
  if (req.body.semesterNumber !== undefined) {
    data.semesterNumber = req.body.semesterNumber ? String(req.body.semesterNumber) : null;
  }

  if (req.file) {
    data.fileUrl = `/uploads/${req.file.filename}`;
    data.fileName = req.file.originalname;
  }

  const material = await prisma.programMaterial.update({ 
    where: { id: req.params.materialId }, 
    data 
  });
  res.json({ success: true, data: material });
});

export const deleteProgramMaterial = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await prisma.programMaterial.updateMany({
    where: {
      id: req.params.materialId,
      programId: req.params.programId,
      organizationId: req.user.organizationId,
      isActive: true,
    },
    data: { isActive: false },
  });
  if (result.count === 0) {
    res.status(404).json({ success: false, message: 'Material not found' });
    return;
  }
  res.json({ success: true, data: {} });
});
