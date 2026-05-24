import nodemailer from 'nodemailer';

// Reuse the same SMTP env vars used by NextAuth EmailProvider.
export const mailer = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: parseInt(process.env.EMAIL_SERVER_PORT ?? '587'),
  secure: process.env.EMAIL_SERVER_SECURE !== 'false',
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
});
