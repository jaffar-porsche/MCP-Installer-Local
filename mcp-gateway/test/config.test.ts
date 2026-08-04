import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("uses defaults when optional values are missing", () => {
    const config = loadConfig({
      SESSION_SECRET: "x".repeat(32),
    } as NodeJS.ProcessEnv);

    expect(config.port).toBe(8080);
    expect(config.auth.enabled).toBe(false);
    expect(config.services).toHaveLength(0);
  });

  it("rejects incomplete OIDC configuration", () => {
    expect(() =>
      loadConfig({
        SESSION_SECRET: "x".repeat(32),
        OIDC_ISSUER_URL: "https://example.com",
      } as NodeJS.ProcessEnv),
    ).toThrow(/must be set together/i);
  });
});