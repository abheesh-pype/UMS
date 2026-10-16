import prisma from '../lib/prisma.js';

export const connectPostgres = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL Connected: Local UMS DB (via Prisma 7 + Driver Adapter)');
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error);
  }
};

export { prisma };
export default prisma;
