// ============================================================
// AES-GCM Encryption for SuperBrain API Key Storage
// Uses Web Crypto API with PBKDF2 key derivation
// ============================================================

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits — NIST recommended for GCM
const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 16;

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

/**
 * Derive a 256-bit AES-GCM key from a user-provided password + random salt.
 * Returns both the CryptoKey and the salt (to store alongside ciphertext).
 */
export async function deriveKey(
  password: string,
  salt?: Uint8Array,
): Promise<{ cryptoKey: CryptoKey; salt: Uint8Array }> {
  const actualSalt: Uint8Array = salt ?? new Uint8Array(
    (crypto as any).getRandomValues(new Uint8Array(SALT_LENGTH)) as Uint8Array,
  );

  const baseKey = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(password) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  const cryptoKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: actualSalt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );

  return { cryptoKey, salt: actualSalt };
}

/**
 * AES-GCM 加密，每次调用生成新 IV。
 *
 * 返回格式：base64(iv) + "." + base64(ciphertext)
 * IV 长度固定 12 字节，解密时可精准切割。
 */
export async function encryptApiKey(
  plaintext: string,
  cryptoKey: CryptoKey,
): Promise<string> {
  const iv = new Uint8Array(
    (crypto as any).getRandomValues(new Uint8Array(IV_LENGTH)) as Uint8Array,
  );
  const encoded = ENCODER.encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: iv as BufferSource },
    cryptoKey,
    encoded as BufferSource,
  );

  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
}

/**
 * AES-GCM 解密。
 * 输入格式必须与 encryptApiKey 输出一致：base64(iv).base64(ciphertext)
 */
export async function decryptApiKey(
  encrypted: string,
  cryptoKey: CryptoKey,
): Promise<string> {
  const dotIndex = encrypted.indexOf('.');
  if (dotIndex === -1) {
    throw new Error('Invalid ciphertext format: missing IV separator');
  }

  const ivB64 = encrypted.slice(0, dotIndex);
  const ctB64 = encrypted.slice(dotIndex + 1);

  const iv = base64ToBytes(ivB64);
  const ciphertext = base64ToBytes(ctB64);

  const plainBuf = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: iv as BufferSource },
    cryptoKey,
    ciphertext as BufferSource,
  );

  return DECODER.decode(plainBuf);
}

/**
 * Shortcut: encrypt text with a password (derive key + encrypt in one call).
 * Returns: salt.base64 + "." + iv.base64 + "." + ciphertext.base64
 */
export async function encryptWithPassword(
  plaintext: string,
  password: string,
): Promise<string> {
  const { cryptoKey, salt } = await deriveKey(password);
  const encrypted = await encryptApiKey(plaintext, cryptoKey);
  return `${bytesToBase64(salt)}.${encrypted}`;
}

/**
 * Shortcut: decrypt with password (derive key from stored salt + decrypt).
 */
export async function decryptWithPassword(
  encrypted: string,
  password: string,
): Promise<string> {
  // Format: salt.iv.ciphertext
  const firstDot = encrypted.indexOf('.');
  if (firstDot === -1) {
    throw new Error('Invalid ciphertext format: missing salt');
  }

  const saltB64 = encrypted.slice(0, firstDot);
  const rest = encrypted.slice(firstDot + 1);

  const salt = base64ToBytes(saltB64);
  const { cryptoKey } = await deriveKey(password, salt);
  return decryptApiKey(rest, cryptoKey);
}

// ---- Base64 helpers (no padding, URL-safe) ----

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---- Memory cleanup ----

export function wipeBytes(bytes: Uint8Array | null): void {
  if (!bytes) return;
  bytes.fill(0);
}
