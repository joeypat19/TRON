import { NextResponse } from "next/server";
import { authApiErrorResponse } from "@/lib/auth/api";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { normalizeMailboxEmail } from "@/lib/mail/participants";
import { resolveMailAvatars } from "@/lib/mail/avatars";

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
  } catch (error) {
    return authApiErrorResponse(error) ?? NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }
  const url = new URL(request.url);
  const email = normalizeMailboxEmail(url.searchParams.get("email"));

  if (!email) {
    return NextResponse.json(
      {
        email: "",
        photoUrl: null,
        displayName: null,
        source: "fallback",
      },
      { status: 400 },
    );
  }

  const avatars = await resolveMailAvatars([email]);
  const avatar = avatars[email] ?? { photoUrl: null, displayName: null, source: "fallback" as const };

  return NextResponse.json({
    email,
    ...avatar,
  });
}
