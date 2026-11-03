// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { saveUploadedFile, deleteStoredFileByUrl } from '../services/fileStorage.js';

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
  const program = await prisma.program.findFirst({
    where: {
      id: req.params.programId,
      organizationId: req.user.organizationId,
      isDeleted: false,
    },
    include: {
      university: true,
      academicSession: true,
      assignedSubDepts: true,
    },
  });
  if (!program) {
    res.status(404).json({ success: false, message: 'Program not found' });
    return;
  }

  const materials = await prisma.programMaterial.findMany({
    where: {
      programId: program.id,
      organizationId: req.user.organizationId,
      isActive: true,
    },
    include: {
      uploader: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const byCategory = materials.reduce<Record<string, typeof materials>>((categories, material) => {
    (categories[material.category] ||= []).push(material);
    return categories;
  }, {});

  res.json({ success: true, data: { program, materials, byCategory } });
});

export const uploadProgramMaterial = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: 'Please upload a file' });
    return;
  }
  const fileUrl = await saveUploadedFile(req.file, req.user.organizationId);
  const fileName = req.file.originalname;

  const material = await prisma.programMaterial.create({
    data: {
      title: req.body.title?.trim() || req.file.originalname,
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

export const uploadProgramVideo = asyncHandler(async (req: AuthRequest, res: Response) => {
  // A module video is either an uploaded file or a link (YouTube or a direct video URL).
  const videoUrl = typeof req.body?.videoUrl === 'string' ? req.body.videoUrl.trim() : '';
  if (!req.file && !videoUrl) {
    res.status(400).json({ success: false, message: 'Please upload a video file or provide a video link' });
    return;
  }
  if (!req.file && !/^https?:\/\/\S+$/i.test(videoUrl)) {
    res.status(400).json({ success: false, message: 'Video link must start with http:// or https://' });
    return;
  }
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title) {
    res.status(400).json({ success: false, message: 'Video name is required' });
    return;
  }
  if (typeof req.body?.moduleId !== 'string' || !req.body.moduleId.trim()) {
    res.status(400).json({ success: false, message: 'A module is required for this video' });
    return;
  }

  const module = await prisma.module.findFirst({
    where: {
      id: req.body.moduleId.trim(),
      programId: req.params.programId,
      organizationId: req.user.organizationId,
    },
    select: { id: true, moduleName: true },
  });
  if (!module) {
    res.status(404).json({ success: false, message: 'Module not found for this program' });
    return;
  }

  const material = await prisma.programMaterial.create({
    data: {
      title,
      description: `Module: ${module.id} - ${module.moduleName}`,
      category: 'video',
      fileUrl: req.file ? await saveUploadedFile(req.file, req.user.organizationId) : videoUrl,
      fileName: req.file ? req.file.originalname : 'Video Link',
      isActive: true,
      program: { connect: { id: req.params.programId } },
      organization: { connect: { id: req.user.organizationId } },
      uploader: { connect: { id: req.user.id } },
    },
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
    select: { id: true, fileUrl: true },
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
    data.fileUrl = await saveUploadedFile(req.file, req.user.organizationId);
    data.fileName = req.file.originalname;
  }

  const material = await prisma.programMaterial.update({
    where: { id: req.params.materialId },
    data
  });
  // The replaced file is no longer referenced.
  if (req.file) await deleteStoredFileByUrl(existingMaterial.fileUrl);
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

export const getAllVideoClasses = asyncHandler(async (req: AuthRequest, res: Response) => {
  const materials = await prisma.programMaterial.findMany({
    where: {
      organizationId: req.user.organizationId,
      category: 'video_class',
      isActive: true,
    },
    include: {
      program: {
        select: {
          id: true,
          name: true,
          academicSessionId: true,
          academicSession: { select: { id: true, name: true, startDate: true, endDate: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const data = materials.map(item => {
    let meta: any = {};
    try {
      meta = JSON.parse(item.description || '{}');
    } catch {
      meta = { text: item.description };
    }
    return {
      id: item.id,
      title: item.title,
      description: meta.text !== undefined ? meta.text : (item.description || ''),
      sessionId: meta.sessionId || item.program?.academicSessionId || '',
      sessionName: meta.sessionName || item.program?.academicSession?.name || '',
      programId: item.programId,
      programName: meta.programName || item.program?.name || '',
      semesterId: meta.semesterId || '',
      semesterName: meta.semesterName || '',
      moduleId: meta.moduleId || '',
      moduleName: meta.moduleName || '',
      fileUrl: item.fileUrl,
      fileName: item.fileName,
      youtubeUrl: meta.youtubeUrl || (item.fileUrl?.startsWith('http') ? item.fileUrl : ''),
      createdAt: item.createdAt,
    };
  });

  res.json({ success: true, count: data.length, data });
});

export const createVideoClass = asyncHandler(async (req: AuthRequest, res: Response) => {
  const {
    title,
    description,
    sessionId,
    sessionName,
    programId,
    programName,
    semesterId,
    semesterName,
    moduleId,
    moduleName,
    youtubeUrl,
  } = req.body;

  if (!title?.trim()) {
    res.status(400).json({ success: false, message: 'Video title is required' });
    return;
  }
  if (!programId) {
    res.status(400).json({ success: false, message: 'Program is required' });
    return;
  }

  let fileUrl = '';
  let fileName = '';

  if (req.file) {
    fileUrl = await saveUploadedFile(req.file, req.user.organizationId);
    fileName = req.file.originalname;
  } else if (youtubeUrl?.trim()) {
    fileUrl = youtubeUrl.trim();
    fileName = 'YouTube Video';
  } else {
    res.status(400).json({ success: false, message: 'Please upload a video file or provide a YouTube video link' });
    return;
  }

  const meta = {
    text: description || '',
    sessionId: sessionId || '',
    sessionName: sessionName || '',
    programId,
    programName: programName || '',
    semesterId: semesterId || '',
    semesterName: semesterName || '',
    moduleId: moduleId || '',
    moduleName: moduleName || '',
    youtubeUrl: youtubeUrl || '',
  };

  const material = await prisma.programMaterial.create({
    data: {
      title: title.trim(),
      description: JSON.stringify(meta),
      category: 'video_class',
      semesterNumber: semesterId || null,
      fileUrl,
      fileName,
      isActive: true,
      program: { connect: { id: programId } },
      organization: { connect: { id: req.user.organizationId } },
      uploader: { connect: { id: req.user.id } },
    },
  });

  res.status(201).json({ success: true, data: material });
});

export const updateVideoClass = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const {
    title,
    description,
    sessionId,
    sessionName,
    programId,
    programName,
    semesterId,
    semesterName,
    moduleId,
    moduleName,
    youtubeUrl,
  } = req.body;

  const existing = await prisma.programMaterial.findFirst({
    where: {
      id,
      organizationId: req.user.organizationId,
      category: 'video_class',
      isActive: true,
    },
  });

  if (!existing) {
    res.status(404).json({ success: false, message: 'Video class not found' });
    return;
  }

  let fileUrl = existing.fileUrl;
  let fileName = existing.fileName;

  if (req.file) {
    fileUrl = await saveUploadedFile(req.file, req.user.organizationId);
    fileName = req.file.originalname;
  } else if (youtubeUrl !== undefined && youtubeUrl.trim()) {
    fileUrl = youtubeUrl.trim();
    fileName = 'YouTube Video';
  }

  let prevMeta: any = {};
  try {
    prevMeta = JSON.parse(existing.description || '{}');
  } catch {
    prevMeta = {};
  }

  const meta = {
    text: description !== undefined ? description : (prevMeta.text || ''),
    sessionId: sessionId || prevMeta.sessionId || '',
    sessionName: sessionName || prevMeta.sessionName || '',
    programId: programId || existing.programId,
    programName: programName || prevMeta.programName || '',
    semesterId: semesterId !== undefined ? semesterId : (prevMeta.semesterId || ''),
    semesterName: semesterName !== undefined ? semesterName : (prevMeta.semesterName || ''),
    moduleId: moduleId !== undefined ? moduleId : (prevMeta.moduleId || ''),
    moduleName: moduleName !== undefined ? moduleName : (prevMeta.moduleName || ''),
    youtubeUrl: youtubeUrl !== undefined ? youtubeUrl : (prevMeta.youtubeUrl || ''),
  };

  const updated = await prisma.programMaterial.update({
    where: { id },
    data: {
      ...(title ? { title: title.trim() } : {}),
      description: JSON.stringify(meta),
      fileUrl,
      fileName,
      ...(programId && programId !== existing.programId ? { programId } : {}),
      ...(semesterId !== undefined ? { semesterNumber: semesterId || null } : {}),
    },
  });
  // The previous stored file is no longer referenced once replaced by a new upload or a link.
  if (fileUrl !== existing.fileUrl) await deleteStoredFileByUrl(existing.fileUrl);

  res.json({ success: true, data: updated });
});

export const deleteVideoClass = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const existing = await prisma.programMaterial.findFirst({
    where: {
      id,
      organizationId: req.user.organizationId,
      category: 'video_class',
      isActive: true,
    },
    select: { id: true },
  });

  if (!existing) {
    res.status(404).json({ success: false, message: 'Video class not found' });
    return;
  }

  await prisma.programMaterial.update({
    where: { id },
    data: { isActive: false },
  });

  res.json({ success: true, message: 'Video class deleted successfully' });
});
