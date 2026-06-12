import nodemailer from "nodemailer";

import { ApiError } from "@/lib/api/errors";

export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

export async function sendAccountMail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  if (!mailConfigured()) {
    throw new ApiError(503, "mail_not_configured", "Account email delivery is not configured.");
  }
  const port = Number(process.env.SMTP_PORT ?? "587");
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" }
      : undefined,
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
}
