import prisma from './src/lib/prisma.js';

async function inspectDB() {
  try {
    const orgs = await prisma.organization.findMany();
    console.log(`--- ORGANIZATIONS (${orgs.length}) ---`);
    orgs.forEach(o => console.log(`ID: ${o.id}, Name: ${o.name}, Slug: ${o.slug}`));

    const unis = await prisma.university.findMany();
    console.log(`\n--- UNIVERSITIES (${unis.length}) ---`);
    unis.forEach(u => console.log(`ID: ${u.id}, Name: ${u.name}, Code: ${u.code}, OrgID: ${u.organizationId}`));

    const centers = await prisma.studyCenter.findMany();
    console.log(`\n--- STUDY CENTERS (${centers.length}) ---`);
    centers.forEach(c => console.log(`ID: ${c.id}, Name: ${c.name}, Code: ${c.code}, OrgID: ${c.organizationId}`));

    const studentCount = await prisma.student.count();
    const enrollmentCount = await prisma.enrollment.count();
    const invoiceCount = await prisma.invoice.count();
    const userCount = await prisma.user.count();
    const deptCount = await prisma.department.count();

    console.log(`\n--- COUNTS ---`);
    console.log(`Users: ${userCount}, Depts: ${deptCount}, Students: ${studentCount}, Enrollments: ${enrollmentCount}, Invoices: ${invoiceCount}`);
  } catch (err) {
    console.error('Error inspecting DB:', err);
  } finally {
    await prisma.$disconnect();
  }
}

inspectDB();
