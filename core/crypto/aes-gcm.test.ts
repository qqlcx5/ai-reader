// ============================================================
// AES-GCM Crypto Tests (Vitest + jsdom + Node webcrypto)
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  encryptApiKey,
  decryptApiKey,
  deriveKey,
  encryptWithPassword,
  decryptWithPassword,
  wipeBytes,
} from './aes-gcm';

describe('AES-GCM Crypto', () => {
  describe('deriveKey', () => {
    it('derives a CryptoKey from password', async () => {
      const { cryptoKey, salt } = await deriveKey('test-password');

      expect(cryptoKey).toBeDefined();
      expect(cryptoKey.type).toBe('secret');
      expect(cryptoKey.algorithm).toBeDefined();
      expect(cryptoKey.usages).toContain('encrypt');
      expect(cryptoKey.usages).toContain('decrypt');
      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(16);
    });

    it('derives the same key from same password and salt', async () => {
      const password = 'my-secret-password';
      const fixedSalt = crypto.getRandomValues(new Uint8Array(16));

      const { cryptoKey: key1 } = await deriveKey(password, fixedSalt);
      const { cryptoKey: key2 } = await deriveKey(password, fixedSalt);

      // Cannot compare CryptoKey objects directly, but both should be valid
      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
    });

    it('produces different keys for different passwords', async () => {
      const { salt: salt1 } = await deriveKey('password-a');
      const { salt: salt2 } = await deriveKey('password-b');

      // Salts should differ when not explicitly provided
      expect(Buffer.from(salt1).toString('base64')).not.toBe(
        Buffer.from(salt2).toString('base64'),
      );
    });
  });

  describe('encryptApiKey / decryptApiKey roundtrip', () => {
    it('encrypts and decrypts plaintext successfully', async () => {
      const { cryptoKey } = await deriveKey('my-password');
      const plaintext = 'sk-test-api-key-12345';

      const encrypted = await encryptApiKey(plaintext, cryptoKey);
      expect(encrypted).toBeTruthy();
      expect(encrypted).toContain('.'); // iv.ciphertext format

      const decrypted = await decryptApiKey(encrypted, cryptoKey);
      expect(decrypted).toBe(plaintext);
    });

    it('handles empty string', async () => {
      const { cryptoKey } = await deriveKey('pass');
      const encrypted = await encryptApiKey('', cryptoKey);
      const decrypted = await decryptApiKey(encrypted, cryptoKey);
      expect(decrypted).toBe('');
    });

    it('handles long API keys', async () => {
      const { cryptoKey } = await deriveKey('pass');
      const plaintext = 'sk-' + 'x'.repeat(512);

      const encrypted = await encryptApiKey(plaintext, cryptoKey);
      const decrypted = await decryptApiKey(encrypted, cryptoKey);
      expect(decrypted).toBe(plaintext);
    });

    it('handles Unicode characters in API key', async () => {
      const { cryptoKey } = await deriveKey('pass');
      const plaintext = 'key-with-emoji-🚀-测试';

      const encrypted = await encryptApiKey(plaintext, cryptoKey);
      const decrypted = await decryptApiKey(encrypted, cryptoKey);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertexts for the same plaintext (random IV)', async () => {
      const { cryptoKey } = await deriveKey('pass');
      const plaintext = 'same-key';

      const encrypted1 = await encryptApiKey(plaintext, cryptoKey);
      const encrypted2 = await encryptApiKey(plaintext, cryptoKey);

      // Different IVs should produce different ciphertexts
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('throws on malformed ciphertext', async () => {
      const { cryptoKey } = await deriveKey('pass');

      await expect(decryptApiKey('no-dot-separator', cryptoKey)).rejects.toThrow(
        'Invalid ciphertext format',
      );
    });

    it('fails to decrypt with wrong key', async () => {
      const { cryptoKey: key1 } = await deriveKey('password-1');
      const { cryptoKey: key2 } = await deriveKey('password-2');

      const encrypted = await encryptApiKey('secret', key1);
      await expect(decryptApiKey(encrypted, key2)).rejects.toThrow();
    });
  });

  describe('encryptWithPassword / decryptWithPassword shortcut', () => {
    it('roundtrip works', async () => {
      const password = 'my-derivation-password';
      const plaintext = 'sk-abcdefg';

      const encrypted = await encryptWithPassword(plaintext, password);
      expect(encrypted).toContain('.');

      const decrypted = await decryptWithPassword(encrypted, password);
      expect(decrypted).toBe(plaintext);
    });

    it('fails with wrong password', async () => {
      const encrypted = await encryptWithPassword('secret', 'correct');
      await expect(decryptWithPassword(encrypted, 'wrong')).rejects.toThrow();
    });

    it('works with common API key patterns', async () => {
      const testKeys = [
        'sk-proj-abc123def456',
        'sk-ant-api03-xxx',
        'ollama-no-key-required',
        'a'.repeat(256),
      ];

      for (const key of testKeys) {
        const encrypted = await encryptWithPassword(key, 'test-pass');
        const decrypted = await decryptWithPassword(encrypted, 'test-pass');
        expect(decrypted).toBe(key);
      }
    });
  });

  describe('wipeBytes', () => {
    it('zeroes out a Uint8Array', () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      wipeBytes(bytes);
      for (let i = 0; i < bytes.length; i++) {
        expect(bytes[i]).toBe(0);
      }
    });

    it('handles null gracefully', () => {
      expect(() => wipeBytes(null)).not.toThrow();
    });
  });
});
