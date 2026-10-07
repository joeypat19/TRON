import "server-only";

import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { LOGIN_CODE_LENGTHS } from "@/lib/auth/constants";

const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 32 * 1024 * 1024;

function deriveKey(secret: string, salt: Buffer, length: number, options: { N: number; r: number; p: number; maxmem: number }) {
  return new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(secret, salt, length, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey as Buffer);
    });
  });
}

export function normalizeEmail(value: string) {
  return value.trim().normalize("NFKC").toLowerCase();
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidLoginCode(value: string, expectedLength?: number) {
  return LOGIN_CODE_LENGTHS.includes(value.length as (typeof LOGIN_CODE_LENGTHS)[number])
    && /^\d+$/.test(value)
    && (expectedLength === undefined || value.length === expectedLength);
}

export function isValidPassword(value: string) {
  return value.length >= 8 && value.length <= 128;
}

export function createOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashSecret(secret: string) {
  const salt = randomBytes(16);
  const derivedKey = await deriveKey(secret, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: SCRYPT_MAX_MEMORY,
  });

  return [
    "scrypt",
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

export async function verifySecret(secret: string, encoded: string) {
  const [algorithm, cost, blockSize, parallelization, saltValue, keyValue] = encoded.split("$");

  if (algorithm !== "scrypt" || !cost || !blockSize || !parallelization || !saltValue || !keyValue) {
    return false;
  }

  const salt = Buffer.from(saltValue, "base64url");
  const expected = Buffer.from(keyValue, "base64url");
  const actual = await deriveKey(secret, salt, expected.length, {
    N: Number(cost),
    r: Number(blockSize),
    p: Number(parallelization),
    maxmem: SCRYPT_MAX_MEMORY,
  });

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
