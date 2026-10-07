import { NextResponse } from "next/server";
import { AuthValidationError } from "@/lib/auth/errors";
import { beginPasswordLogin, completeCodeLogin } from "@/lib/auth/service";
import { AUTH_CHALLENGE_COOKIE, createLoginChallenge } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (typeof body.code === "string") {
      const rawChallengeToken = request.headers.get("cookie")
        ?.split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${AUTH_CHALLENGE_COOKIE}=`))
        ?.slice(AUTH_CHALLENGE_COOKIE.length + 1);

      if (!rawChallengeToken) {
        return NextResponse.json({ error: "Your login challenge expired. Start again." }, { status: 401 });
      }

      const account = await completeCodeLogin(rawChallengeToken, body.code);
      return NextResponse.json({ ok: true, account });
    }

    const account = await beginPasswordLogin(
      typeof body.email === "string" ? body.email : "",
      typeof body.password === "string" ? body.password : "",
    );
    await createLoginChallenge(account.id);

    return NextResponse.json({ ok: true, requiresCode: true, loginCodeLength: account.loginCodeLength });
  } catch (error) {
    if (error instanceof AuthValidationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ error: "Unable to log in right now." }, { status: 500 });
  }
}
