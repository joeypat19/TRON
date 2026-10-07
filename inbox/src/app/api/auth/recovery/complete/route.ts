import { AuthTokenType } from "@prisma/client";
import { NextResponse } from "next/server";
import { AuthValidationError } from "@/lib/auth/errors";
import { completeRecoveryToken } from "@/lib/auth/service";

const recoveryTypes = {
  password: AuthTokenType.PASSWORD_RESET,
  login_code: AuthTokenType.LOGIN_CODE_RESET,
} as const;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const type = typeof body.type === "string" ? recoveryTypes[body.type as keyof typeof recoveryTypes] : undefined;

    if (!type || typeof body.token !== "string") {
      throw new AuthValidationError("That recovery link is invalid.");
    }

    await completeRecoveryToken({
      token: body.token,
      type,
      password: typeof body.password === "string" ? body.password : undefined,
      passwordConfirmation: typeof body.passwordConfirmation === "string" ? body.passwordConfirmation : undefined,
      loginCode: typeof body.loginCode === "string" ? body.loginCode : undefined,
      loginCodeConfirmation: typeof body.loginCodeConfirmation === "string" ? body.loginCodeConfirmation : undefined,
    });

    return NextResponse.json({ ok: true, message: "Your account credentials were updated. You can log in now." });
  } catch (error) {
    if (error instanceof AuthValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to complete account recovery right now." }, { status: 500 });
  }
}
