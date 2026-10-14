// @ts-nocheck
import prisma from '../lib/prisma.js';

import bcrypt from 'bcryptjs';

async function main() {
  const users = [
    { email: 'athithyan@gmail.com', test: 'athithyan' },
    { email: 'jishnu@gmail.com', test: 'jishnu' },
    { email: 'ram@gmail.com', test: 'ram' },
  ];
  for (const u of users) {
    const record = await prisma.user.findUnique({ where: { email: u.email } });
    if (record) {
      const match = await bcrypt.compare(u.test, record.password);
      console.log(`${u.email} -> ${u.test}: ${match}`);
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
