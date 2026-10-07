import { AuthTokenType } from "@prisma/client";
import { NextResponse } from "next/server";
import { appPath } from "@/lib/app-path";
import { AuthEmailNotConfiguredError, AuthValidationError } from "@/lib/auth/errors";
import { sendAuthEmail } from "@/lib/auth/email";
import { createRecoveryToken, getAuthUserByEmail } from "@/lib/auth/service";
import { getAppUrl } from "@/lib/env";

const recoveryTypes = {
  password: AuthTokenType.PASSWORD_RESET,
  login_code: AuthTokenType.LOGIN_CODE_RESET,
} as const;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const type = typeof body.type === "string" ? recoveryTypes[body.type as keyof typeof recoveryTypes] : undefined;
    const email = typeof body.email === "string" ? body.email : "";

    if (!type || !email) {
      throw new AuthValidationError("Choose a recovery option and enter your email.");
    }

    const user = await getAuthUserByEmail(email);

    if (user) {
      const token = await createRecoveryToken(user.id, type);
      const link = new URL(appPath(`/auth/recover?token=${encodeURIComponent(token)}&type=${body.type}`), getAppUrl()).toString();
      await sendAuthEmail({
        to: user.email,
        subject: body.type === "password" ? "Reset your TRON password" : "Reset your TRON login code",
        text: `Use this secure TRON recovery link within 30 minutes: ${link}`,
        html: `<p>Use this secure TRON recovery link within 30 minutes:</p><p><a href="${link}">${link}</a></p>`,
      });
    }

    return NextResponse.json({ ok: true, message: "If an account exists, recovery instructions have been sent." });
  } catch (error) {
    if (error instanceof AuthValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AuthEmailNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: "Unable to start account recovery right now." }, { status: 500 });
  }
}
