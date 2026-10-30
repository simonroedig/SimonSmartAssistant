import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, createNonce } from "./csp";

describe("content security policy", () => {
  it("only allows nonce'd scripts and known hosts", () => {
    const csp = buildContentSecurityPolicy({ nonce: "abc", supabaseUrl: "https://xyz.supabase.co", isDev: false });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain(
      "connect-src 'self' https://xyz.supabase.co wss://xyz.supabase.co https://api.open-meteo.com",
    );
    // My Media looks titles up (no keys) and shows their posters – nothing else.
    expect(csp).toMatch(/connect-src [^;]* https:\/\/api\.tvmaze\.com https:\/\/en\.wikipedia\.org(;|$)/);
    expect(csp).toContain("img-src 'self' blob: data: https://static.tvmaze.com https://upload.wikimedia.org;");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toMatch(/upgrade-insecure-requests$/);
  });

  it("relaxes only what local development needs", () => {
    const csp = buildContentSecurityPolicy({ nonce: "abc", supabaseUrl: "http://127.0.0.1:54321", isDev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws://127.0.0.1:54321");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("creates unpredictable nonces", () => {
    expect(createNonce()).not.toBe(createNonce());
    expect(createNonce()).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});
