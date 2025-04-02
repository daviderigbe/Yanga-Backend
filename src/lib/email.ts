import nodemailer from "nodemailer";
import { MailtrapTransport } from "mailtrap";

// Configure Mailtrap transport
const transporter = nodemailer.createTransport(
  MailtrapTransport({
    token: Bun.env.EMAIL_PASS || "08b5d9f3ee2ec0adfdcfaa288c48ad0c",
  }),
);

interface EmailOptions {
  to: string | string[];
  subject: string;
  body: string;
  html?: string;
  category?: string;
}

export async function sendEmail({
  to,
  subject,
  body,
  html,
  category,
}: EmailOptions): Promise<void> {
  const sender = {
    address: Bun.env.EMAIL_FROM || "hello@demomailtrap.co",
    name: Bun.env.EMAIL_FROM_NAME || "AFRAB",
  };

  await transporter.sendMail({
    from: sender,
    to: Array.isArray(to) ? to : [to],
    subject,
    text: body,
    html: html || body.replace(/\n/g, "<br>"),
    category: category || "Default",
  });
}
