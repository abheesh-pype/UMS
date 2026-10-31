import prisma from '../lib/prisma.js';

type SessionProgram = {
  id: string;
  academicSessionId: string | null;
};

// Admission sessions a student can apply to for a program: the program's active session and
// every upcoming session after it (closed sessions excluded), limited to sessions open to
// that program and its university. With no active session, sessions starting after today.
export const getAdmissionSessionsWhere = async (
  organizationId: string,
  program: { id: string; universityId: string | null },
) => {
  const programScope = [
    { OR: [{ programId: program.id }, { programId: null }] },
    { OR: [{ universityId: program.universityId }, { universityId: null }] },
  ];
  const activeSession = await prisma.admissionSession.findFirst({
    where: { organizationId, status: 'active', AND: programScope },
    orderBy: { startDate: 'asc' },
    select: { startDate: true },
  });
  const upcomingFrom = activeSession?.startDate ?? new Date();

  return {
    organizationId,
    AND: [
      ...programScope,
      { OR: [{ status: 'active' }, { startDate: { gt: upcomingFrom }, status: { not: 'closed' } }] },
    ],
  };
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
