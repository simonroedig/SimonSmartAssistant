/**
 * Digits in the e-mail sign-in code. Must match Supabase → Authentication →
 * Sign In / Providers → Email → "Email OTP Length" (hosted projects default
 * to 8) and `otp_length` in supabase/config.toml.
 */
export const OTP_LENGTH = 8;
