import nodemailer from "nodemailer";
import { MailtrapTransport } from "mailtrap";

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
  if (!Bun.env.EMAIL_PASS) {
    throw new Error("EMAIL_PASS is required to send verification emails");
  }

  const transporter = createEmailTransporter();

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

function createEmailTransporter() {
  if (Bun.env.EMAIL_HOST) {
    const port = Number(Bun.env.EMAIL_PORT || 587);

    return nodemailer.createTransport({
      host: Bun.env.EMAIL_HOST,
      port,
      secure: Bun.env.EMAIL_SECURE === "true" || port === 465,
      auth: {
        user: Bun.env.EMAIL_USER || "api",
        pass: Bun.env.EMAIL_PASS,
      },
    });
  }

  return nodemailer.createTransport(
    MailtrapTransport({
      token: Bun.env.EMAIL_PASS,
    }),
  );
}
