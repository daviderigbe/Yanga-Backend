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
    name: Bun.env.EMAIL_FROM_NAME || "YANGA",
  };

  try {
    await withTimeout(
      transporter.sendMail({
        from: sender,
        to: Array.isArray(to) ? to : [to],
        subject,
        text: body,
        html: html || body.replace(/\n/g, "<br>"),
        category: category || "Default",
      }),
      Number(Bun.env.EMAIL_TIMEOUT_MS || 10000),
    );
  } finally {
    if ("close" in transporter && typeof transporter.close === "function") {
      transporter.close();
    }
  }
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
      connectionTimeout: Number(Bun.env.EMAIL_TIMEOUT_MS || 10000),
      greetingTimeout: Number(Bun.env.EMAIL_TIMEOUT_MS || 10000),
      socketTimeout: Number(Bun.env.EMAIL_TIMEOUT_MS || 10000),
    });
  }

  return nodemailer.createTransport(
    MailtrapTransport({
      token: Bun.env.EMAIL_PASS,
    }),
  );
}

function withTimeout(promise: Promise<unknown>, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Email provider timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(() => {
        clearTimeout(timeout);
        resolve();
      })
      .catch((err) => {
        clearTimeout(timeout);
        reject(err);
      });
  });
}
