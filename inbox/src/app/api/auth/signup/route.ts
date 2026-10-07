import { NextResponse } from "next/server";
import { AuthValidationError } from "@/lib/auth/errors";
import { createTronAccount } from "@/lib/auth/service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const account = await createTronAccount({
      email: typeof body.email === "string" ? body.email : "",
      password: typeof body.password === "string" ? body.password : "",
      passwordConfirmation: typeof body.passwordConfirmation === "string" ? body.passwordConfirmation : "",
      loginCode: typeof body.loginCode === "string" ? body.loginCode : "",
      loginCodeConfirmation: typeof body.loginCodeConfirmation === "string" ? body.loginCodeConfirmation : "",
    });

    return NextResponse.json({ ok: true, account });
  } catch (error) {
    if (error instanceof AuthValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to create the account right now." }, { status: 500 });
  }
}
