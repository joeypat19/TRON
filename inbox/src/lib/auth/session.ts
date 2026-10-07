import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { AuthenticationRequiredError } from "@/lib/auth/errors";
import { createOpaqueToken, hashOpaqueToken } from "@/lib/auth/crypto";

export const AUTH_SESSION_COOKIE = "tron_session";
export const AUTH_CHALLENGE_COOKIE = "tron_login_challenge";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const CHALLENGE_TTL_MS = 1000 * 60 * 10;

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string | null;
  emailVerifiedAt: Date | null;
};

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export const getAuthenticatedUser = cache(async (): Promise<AuthenticatedUser | null> => {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(AUTH_SESSION_COOKIE)?.value;

  if (!rawToken) {
    return null;
  }

  const session = await db.authSession.findUnique({
    where: { tokenHash: hashOpaqueToken(rawToken) },
    include: { user: true },
  });

  if (!session || session.expiresAt <= new Date() || session.user.status !== "ACTIVE") {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    displayName: session.user.displayName,
    emailVerifiedAt: session.user.emailVerifiedAt,
  };
});

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new AuthenticationRequiredError();
  }

  return user;
}

export async function createSession(userId: string) {
  const rawToken = createOpaqueToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.authSession.create({
    data: {
      userId,
      tokenHash: hashOpaqueToken(rawToken),
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(AUTH_SESSION_COOKIE, rawToken, cookieOptions(Math.floor(SESSION_TTL_MS / 1000)));
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(AUTH_SESSION_COOKIE)?.value;

  if (rawToken) {
    await db.authSession.deleteMany({ where: { tokenHash: hashOpaqueToken(rawToken) } });
  }

  cookieStore.set(AUTH_SESSION_COOKIE, "", cookieOptions(0));
  cookieStore.set(AUTH_CHALLENGE_COOKIE, "", cookieOptions(0));
}

export async function createLoginChallenge(userId: string) {
  const rawToken = createOpaqueToken();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

  await db.authLoginChallenge.deleteMany({ where: { userId } });
  await db.authLoginChallenge.create({
    data: {
      userId,
      tokenHash: hashOpaqueToken(rawToken),
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(AUTH_CHALLENGE_COOKIE, rawToken, cookieOptions(Math.floor(CHALLENGE_TTL_MS / 1000)));
}

export async function clearLoginChallenge() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(AUTH_CHALLENGE_COOKIE)?.value;

  if (rawToken) {
    await db.authLoginChallenge.deleteMany({ where: { tokenHash: hashOpaqueToken(rawToken) } });
  }

  cookieStore.set(AUTH_CHALLENGE_COOKIE, "", cookieOptions(0));
}
