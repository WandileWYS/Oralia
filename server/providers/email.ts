import nodemailer from 'nodemailer';
import { required } from '../config.ts';
import { ServiceError } from '../errors.ts';

export function mailTransport() {
  return nodemailer.createTransport({
    host: required('SMTP_HOST'), port: Number(required('SMTP_PORT')), secure: false, requireTLS: true,
    auth: { user: required('SMTP_USER'), pass: required('SMTP_PASSWORD').replace(/\s/g, '') },
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
  });
}
export async function sendEmail(to: string, subject: string, text: string) {
  const transport = mailTransport();
  try {
    const result = await transport.sendMail({ from: { name: 'Oralia', address: required('SMTP_USER') }, to, subject, text });
    if (!result.accepted.length) throw new Error('Not accepted.');
  } catch {
    throw new ServiceError('SMTP_UNAVAILABLE', 503, 'Email could not be sent. Please try again later.', true);
  } finally { transport.close(); }
}
