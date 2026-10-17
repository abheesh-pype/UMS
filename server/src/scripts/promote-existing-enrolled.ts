// @ts-nocheck
import { prisma, connectPostgres } from '../config/postgres.js';
import bcrypt from 'bcryptjs';
import { activateStudentPortalAccount, getStudentPortalPassword } from '../utils/studentPortalAccess.js';

const run = async () => {
  await connectPostgres();
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: {
        status: 'enrolled',
        studentId: null
      }
    });

    console.log(`Found ${enrollments.length} enrolled applications missing student records.`);

    for (const enrollment of enrollments) {
      console.log(`Promoting ${enrollment.studentName} (${enrollment.studentEmail})...`);

      // 1. Create or find User
      let user = await prisma.user.findUnique({ where: { email: enrollment.studentEmail } });
      if (!user) {
        const hashedPassword = await bcrypt.hash('unprovisioned-student-account', 12);
        const userId = `STD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        user = await prisma.user.create({
          data: {
            userId,
            email: enrollment.studentEmail,
            password: hashedPassword,
            name: enrollment.studentName,
            role: 'student',
            organizationId: enrollment.organizationId,
            status: 'inactive'
          }
        });
      }

      const dobPassword = getStudentPortalPassword(enrollment.dob);

      // 2. Generate unique enrollment number
      const enrollmentNo = enrollment.enrollmentNumber || `ENR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // 3. Create Student
      const student = await prisma.student.create({
        data: {
          name: enrollment.studentName,
          email: enrollment.studentEmail,
          enrollmentNo,
          phone: enrollment.studentPhone,
          address: enrollment.studentAddress,
          dob: dobPassword || enrollment.dob,
          status: 'pending',
          organization: { connect: { id: enrollment.organizationId } },
          center: { connect: { id: enrollment.studyCenterId } },
          user: { connect: { id: user.id } },
          program: { connect: { id: enrollment.programId } }
        }
      });

      if (dobPassword) {
        const passwordHash = await bcrypt.hash(dobPassword, 12);
        await prisma.$transaction(async (tx) => {
          const activatedStudent = await tx.student.update({
            where: { id: student.id },
            data: { status: 'active', dob: dobPassword },
          });
          await activateStudentPortalAccount(tx, {
            email: activatedStudent.email,
            name: activatedStudent.name,
            organizationId: activatedStudent.organizationId,
          }, passwordHash);
        });
      } else {
        console.warn(`Student portal access remains disabled for ${enrollment.studentEmail}: valid date of birth is missing.`);
      }

      // 4. Link enrollment
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: {
          studentId: student.id,
          enrollmentNumber: student.enrollmentNo
        }
      });

      console.log(`✅ Promoted successfully: Student ID ${student.id}, Enrollment No ${student.enrollmentNo}`);
    }

    console.log('All missing student records successfully created!');
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
};

run();
