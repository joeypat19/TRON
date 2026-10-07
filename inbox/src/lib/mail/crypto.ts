import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_IV_BYTES = 12;
const DEV_FALLBACK_SECRET = "troninbox-local-mailbox-encryption-key";

function getEncryptionKey() {
  const configured = process.env.MAILBOX_ENCRYPTION_KEY?.trim();

  if (configured) {
    return createHash("sha256").update(configured).digest();
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("MAILBOX_ENCRYPTION_KEY must be configured in production.");
  }

  return createHash("sha256").update(DEV_FALLBACK_SECRET).digest();
}

export function encryptSecret(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const iv = randomBytes(ENCRYPTION_IV_BYTES);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const [ivPart, authTagPart, encryptedPart] = value.split(".");

  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new Error("Encrypted mailbox secret is malformed.");
  }

  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivPart, "base64url"),
  );

  decipher.setAuthTag(Buffer.from(authTagPart, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
