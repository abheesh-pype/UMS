// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const useSSL = process.env.DATABASE_URL && 
               !process.env.DATABASE_URL.includes('localhost') && 
               !process.env.DATABASE_URL.includes('127.0.0.1') &&
               !process.env.DATABASE_URL.includes('::1');

// Neon suspends idle compute: allow time for it to wake, and drop idle
// connections before Neon closes them so the pool never hands out a dead one.
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? {
    rejectUnauthorized: false
  } : undefined,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  keepAlive: true,
});

// A connection dropped by the server while idle must not crash the process.
pool.on('error', (err) => {
  console.error('Postgres pool error:', err.message);
});

const adapter = new PrismaPg(pool as any);

const prismaClientSingleton = () => {
  return new PrismaClient({
    adapter: adapter as any,
    log: ['error', 'warn'],
    // Each query is a round trip to the remote database, so the 5s default is too tight.
    transactionOptions: { maxWait: 10000, timeout: 20000 },
  });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
