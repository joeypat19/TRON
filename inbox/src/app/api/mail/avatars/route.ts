import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveMailAvatars } from "@/lib/mail/avatars";

const bodySchema = z.object({
  emails: z.array(z.string().trim().email()).max(100),
});

export async function POST(request: Request) {
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
