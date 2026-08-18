// config/mail.ts
import nodemailer from 'nodemailer';
import { env } from './env.js';
import logger from './logger.js';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: env.GMAIL_USER,
    pass: env.GMAIL_APP_PASSWORD,
  },
  family: 4,
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 10_000,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any);

export const sendMail = async (to: string, subject: string, html: string): Promise<void> => {
  try {
    await transporter.sendMail({
      from: env.GMAIL_USER,
      to,
      subject,
      html,
    });
  } catch (err) {
    logger.error({ err, to, subject }, 'Failed to send mail');
    throw err;
  }
};


// // config/mail.ts
// import nodemailer from 'nodemailer';
// import { env } from './env.js';
// import type SMTPTransport from 'nodemailer/lib/smtp-transport';
// import logger from './logger.js';

// // const transporter = nodemailer.createTransport({
// //   service: 'gmail',
// //   auth: {
// //     user: env.GMAIL_USER,
// //     pass: env.GMAIL_APP_PASSWORD,
// //   },
// // });

// const transportOptions: SMTPTransport.Options = {
//   host: 'smtp.gmail.com',
//   port: 465,
//   secure: true,
//   auth: {
//     user: env.GMAIL_USER,
//     pass: env.GMAIL_APP_PASSWORD,
//   },
//   family: 4,
//   connectionTimeout: 10_000,
//   greetingTimeout: 10_000,
//   socketTimeout: 10_000,
// };

// const transporter = nodemailer.createTransport(transportOptions);

// export const sendMail = async (to: string, subject: string, html: string): Promise<void> => {
//   try {
//     await transporter.sendMail({
//       from: env.GMAIL_USER,
//       to,
//       subject,
//       html,
//     });
//   } catch (err) {
//     logger.error({ err, to, subject }, 'Failed to send mail');
//     throw err;
//   }
// };

// // export const sendMail = async (to: string, subject: string, html: string): Promise<void> => {
// //   await transporter.sendMail({
// //     from: env.GMAIL_USER,
// //     to,
// //     subject,
// //     html,
// //   });
// // };
