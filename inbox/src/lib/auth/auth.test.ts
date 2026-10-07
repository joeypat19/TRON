import { describe, expect, it } from "vitest";
import { LOGIN_CODE_LENGTHS } from "@/lib/auth/constants";
import {
  hashOpaqueToken,
  hashSecret,
  isValidEmail,
  isValidLoginCode,
  normalizeEmail,
  verifySecret,
} from "@/lib/auth/crypto";

describe("TRON auth primitives", () => {
  it("normalizes email addresses before lookup", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
  });

  it("accepts only the supported personal code lengths", () => {
    expect(LOGIN_CODE_LENGTHS).toEqual([4, 6, 8, 10]);
    expect(isValidLoginCode("1234")).toBe(true);
    expect(isValidLoginCode("12345")).toBe(false);
    expect(isValidLoginCode("123456", 6)).toBe(true);
    expect(isValidLoginCode("123456", 4)).toBe(false);
    expect(isValidLoginCode("12ab", 4)).toBe(false);
  });

  it("hashes secrets and opaque session tokens without storing the original value", async () => {
    const passwordHash = await hashSecret("correct horse battery staple");

    expect(passwordHash).not.toContain("correct horse battery staple");
    expect(await verifySecret("correct horse battery staple", passwordHash)).toBe(true);
    expect(await verifySecret("wrong password", passwordHash)).toBe(false);
    expect(hashOpaqueToken("token-a")).not.toBe(hashOpaqueToken("token-b"));
  });
});
