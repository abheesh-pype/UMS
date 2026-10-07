import nodemailer from 'nodemailer';

// In a real application, you'd use SendGrid, AWS SES, or an SMTP server here.
// For development, we'll use a mocked Ethereal transporter which logs URLs to view the emails.
let transporter: nodemailer.Transporter | null = null;

async function getTransporter() {
  if (transporter) return transporter;

  // We can use ethereal email for testing
  const testAccount = await nodemailer.createTestAccount();
  
  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  return transporter;
}

export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    const mailer = await getTransporter();
    const info = await mailer.sendMail({
      from: '"UMS System" <noreply@pype-erp.com>',
      to,
      subject,
      html,
    });

    console.log(`[Mailer] Email sent to ${to}. Subject: "${subject}"`);
    console.log(`[Mailer] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    return true;
  } catch (error) {
    console.error('[Mailer] Failed to send email:', error);
    return false;
  }
};
