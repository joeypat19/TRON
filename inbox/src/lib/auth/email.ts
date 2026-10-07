import "server-only";

import { AuthEmailNotConfiguredError } from "@/lib/auth/errors";

type AuthEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendAuthEmail(message: AuthEmail) {
  const apiKey = process.env.AUTH_EMAIL_API_KEY?.trim();
  const from = process.env.AUTH_EMAIL_FROM?.trim();
  const apiUrl = process.env.AUTH_EMAIL_API_URL?.trim() || "https://api.resend.com/emails";

  if (!apiKey || !from) {
    throw new AuthEmailNotConfiguredError();
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });

  if (!response.ok) {
    throw new Error("The email provider rejected the account recovery message.");
  }
}
