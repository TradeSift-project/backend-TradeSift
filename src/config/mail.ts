// config/mail.ts
import nodemailer from 'nodemailer';
import { env } from './env.js';
import logger from './logger.js';

// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: env.GMAIL_USER,
//     pass: env.GMAIL_APP_PASSWORD,
//   },
// });

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: env.GMAIL_USER,
    pass: env.GMAIL_APP_PASSWORD,
  },
  family: 4, // force IPv4 — avoids ENETUNREACH on Render
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 10_000,
});


export const sendMail = async (to: string, subject: string, html: string): Promise<void> => {
  await transporter.sendMail({
    from: env.GMAIL_USER,
    to,
    subject,
    html,
  });
};
