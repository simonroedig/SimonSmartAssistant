/**
 * Optional app-level allowlist (env `ALLOWED_EMAILS`, comma separated).
 *
 * The database already rejects every sign-up that is not allowlisted (auth hook)
 * and isolates rows per user (RLS). This is an extra, independent gate in the
 * web app itself. When the variable is not set, every signed-in user passes.
 */
export function parseAllowlist(raw: string | undefined | null): string[] | null {
  if (!raw) return null;
  const emails = raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
  return emails.length > 0 ? emails : null;
}

export function isEmailAllowed(
  email: string | undefined | null,
  raw: string | undefined | null = process.env.ALLOWED_EMAILS,
): boolean {
  const allowlist = parseAllowlist(raw);
  if (!allowlist) return true;
  if (!email) return false;
  return allowlist.includes(email.trim().toLowerCase());
}
