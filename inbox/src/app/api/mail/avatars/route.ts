import { NextResponse } from "next/server";
import { z } from "zod";
import { authApiErrorResponse } from "@/lib/auth/api";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { resolveMailAvatars } from "@/lib/mail/avatars";

const bodySchema = z.object({
  emails: z.array(z.string().trim().email()).max(100),
});

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
  } catch (error) {
    return authApiErrorResponse(error) ?? NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }
  const rawBody = await request.text();
  const parsed = bodySchema.safeParse(rawBody ? JSON.parse(rawBody) : {});

  if (!parsed.success) {
    return NextResponse.json(
      {
        avatars: {},
      },
      { status: 400 },
    );
  }

  const avatars = await resolveMailAvatars(parsed.data.emails);
  return NextResponse.json({ avatars });
}
