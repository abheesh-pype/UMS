import prisma from '../lib/prisma.js';

type SessionProgram = {
  id: string;
  academicSessionId: string | null;
};

export const filterProgramsWithActiveSessions = async <T extends SessionProgram>(
  organizationId: string,
  programs: T[]
): Promise<T[]> => {
  if (programs.length === 0) return programs;

  const sessions = await prisma.admissionSession.findMany({
    where: {
      organizationId,
      status: 'active',
    },
    select: { id: true },
  });
  const activeSessionIds = new Set(sessions.map(session => session.id));

  return programs.filter(program =>
    program.academicSessionId !== null && activeSessionIds.has(program.academicSessionId)
  );
};
