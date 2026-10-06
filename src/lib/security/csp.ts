/** Hosts the browser may talk to besides our own origin. */
export const WEATHER_HOSTS = [
  "https://api.open-meteo.com",
  "https://geocoding-api.open-meteo.com",
  "https://air-quality-api.open-meteo.com",
];

function supabaseOrigins(supabaseUrl: string): string[] {
  if (!supabaseUrl) return [];
  try {
    const url = new URL(supabaseUrl);
    const ws = url.protocol === "https:" ? "wss:" : "ws:";
    return [url.origin, `${ws}//${url.host}`];
  } catch {
    return [];
  }
}

/**
 * Strict, nonce-based Content Security Policy. Scripts only run when they carry
 * the per-request nonce (Next.js adds it to its own scripts automatically), and
 * the page may only connect to Supabase and the weather API.
 */
export function buildContentSecurityPolicy({
  nonce,
  supabaseUrl,
  isDev,
  https = true,
}: {
  nonce: string;
  supabaseUrl: string;
  isDev: boolean;
  /** Only ask browsers to upgrade requests when the page itself is served over HTTPS. */
  https?: boolean;
}): string {
  const connect = ["'self'", ...supabaseOrigins(supabaseUrl), ...WEATHER_HOSTS];
  if (isDev) connect.push("ws:", "http://127.0.0.1:*", "http://localhost:*");

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    // Inline style attributes are needed by animation libraries and React.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:"],
    "font-src": ["'self'"],
    "connect-src": connect,
    "manifest-src": ["'self'"],
    "worker-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");

  return isDev || !https ? policy : `${policy}; upgrade-insecure-requests`;
}

export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
