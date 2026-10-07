import { NextResponse } from "next/server";
import { AuthenticationRequiredError } from "@/lib/auth/errors";

export function authApiErrorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  return null;
}
