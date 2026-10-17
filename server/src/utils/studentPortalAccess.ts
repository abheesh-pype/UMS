import { Prisma } from '@prisma/client';

export const getStudentPortalPassword = (dob: unknown): string | null => {
  if (typeof dob !== 'string') return null;
  const match = dob.trim().match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);
  if (!match) return null;
  const [year, month, day] = match[1].split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  return match[1];
};

export const activateStudentPortalAccount = async (
  tx: Prisma.TransactionClient,
  student: { email: string; name: string; organizationId: string },
  passwordHash: string,
) => {
  const existingUser = await tx.user.findUnique({
    where: { email: student.email },
    select: { id: true, email: true, organizationId: true, role: true },
  });

  if (existingUser && (
    existingUser.organizationId !== student.organizationId
    || existingUser.role !== 'student'
  )) {
    const error = new Error('The student email is already linked to another account');
    Object.assign(error, { statusCode: 409 });
    throw error;
  }

  const userIdOwner = await tx.user.findUnique({
    where: { userId: student.email },
    select: { id: true },
  });
  if (userIdOwner && userIdOwner.id !== existingUser?.id) {
    const error = new Error('The student email is already in use as another account ID');
    Object.assign(error, { statusCode: 409 });
    throw error;
  }

  if (existingUser) {
    return tx.user.update({
      where: { id: existingUser.id },
      data: {
        userId: student.email,
        password: passwordHash,
        name: student.name,
        status: 'active',
      },
    });
  }

  return tx.user.create({
    data: {
      userId: student.email,
      email: student.email,
      password: passwordHash,
      name: student.name,
      role: 'student',
      organizationId: student.organizationId,
      status: 'active',
    },
  });
};
