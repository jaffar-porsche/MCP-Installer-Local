import crypto from "crypto";

export interface TokenCipher {
  seal(token: string): string;
  open(encrypted: string): string;
}

export class AesGcmTokenCipher implements TokenCipher {
  private readonly key: Buffer;

  constructor(hexKey: string) {
    if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
      throw new Error(
        "Key must be a 64-character hexadecimal string (32 bytes)",
      );
    }
    this.key = Buffer.from(hexKey, "hex");
  }

  seal(token: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.key, iv);

    const ciphertext = Buffer.concat([
      cipher.update(token, "utf-8"),
      cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    return Buffer.concat([iv, ciphertext, tag]).toString("base64url");
  }

  open(encrypted: string): string {
    const buf = Buffer.from(encrypted, "base64url");

    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(buf.length - 16);
    const ciphertext = buf.subarray(12, buf.length - 16);

    const decipher = crypto.createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf-8");
  }
}
