import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

// Public configuration (email, URLs, banner text) stays readable. Secrets and
// authentication material are encrypted before being persisted.
export function isSensitiveCredential(name: string): boolean {
  return /(?:SECRET|TOKEN|API_KEY|CLIENT_SECRET|PASSWORD|PRIVATE_KEY|ACCESS_KEY|SIGNING_KEY|CREDENTIAL)/i.test(name);
}

function encryptionKey(): Buffer {
  const raw = process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("INTEGRATION_CREDENTIALS_ENCRYPTION_KEY no está configurada en el servidor");
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) key = Buffer.from(raw, "hex");
  else {
    try { key = Buffer.from(raw, "base64"); }
    catch { throw new Error("INTEGRATION_CREDENTIALS_ENCRYPTION_KEY no tiene un formato válido"); }
  }
  if (key.length !== 32) throw new Error("INTEGRATION_CREDENTIALS_ENCRYPTION_KEY debe contener 32 bytes (64 hex o base64)");
  return key;
}

export function protectCredential(name: string, value: string): string {
  if (!isSensitiveCredential(name) || value.startsWith(PREFIX)) return value;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

// Plaintext values are accepted only for backwards-compatible reads during
// migration. New writes of sensitive values always require the encryption key.
export function revealCredential(name: string, storedValue: unknown): string {
  if (typeof storedValue !== "string") return "";
  if (!storedValue.startsWith(PREFIX)) return storedValue;
  const packed = Buffer.from(storedValue.slice(PREFIX.length), "base64");
  if (packed.length < IV_BYTES + TAG_BYTES + 1) throw new Error("Credencial cifrada inválida");
  const iv = packed.subarray(0, IV_BYTES);
  const tag = packed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = packed.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
