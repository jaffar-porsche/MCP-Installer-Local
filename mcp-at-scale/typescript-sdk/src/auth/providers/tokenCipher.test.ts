import { AesGcmTokenCipher } from "./tokenCipher.js";

describe("AesGcmTokenCipher", () => {
  let cipher: AesGcmTokenCipher;
  beforeEach(() => {
    const key =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    cipher = new AesGcmTokenCipher(key);
  });

  it("should seal and open a token correctly", () => {
    const token = "this-is-a-test-token";
    const sealed = cipher.seal(token);
    const opened = cipher.open(sealed);
    expect(opened).toBe(token);
  });

  it("should throw an error for invalid key length", () => {
    expect(() => new AesGcmTokenCipher("shortkey")).toThrow(
      "Key must be a 64-character hexadecimal string (32 bytes)",
    );
  });

  it("should produce different sealed tokens for the same input", () => {
    const token = "same-token";
    const sealed1 = cipher.seal(token);
    const sealed2 = cipher.seal(token);
    expect(sealed1).not.toBe(sealed2);
  });

  it("should throw an error on invalid tokens", () => {
    expect(() => cipher.open("invalid-token")).toThrow();
  });
});
