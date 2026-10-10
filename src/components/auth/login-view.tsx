"use client";

import { ArrowLeft, Fingerprint, Loader2, Mail, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { clearPersistedCache } from "@/components/providers/query-provider";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { AuthCapabilities } from "@/lib/auth/capabilities";
import { OTP_LENGTH } from "@/lib/auth/otp";
import { useHydrated, useStoredValue } from "@/hooks/use-hydrated";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const ERRORS: Record<string, string> = {
  not_allowed: "This account is not allowed to use this dashboard.",
  callback: "Sign-in could not be completed. Please try again.",
  provider: "The sign-in provider reported an error. Please try again.",
};

function friendlyError(message: string | undefined, status?: number): string {
  const m = (message ?? "").toLowerCase();
  if (status === 429 || m.includes("rate limit")) {
    return "Too many codes requested. Please wait a few minutes (the free e-mail service allows only a few per hour).";
  }
  if (m.includes("signups not allowed") || m.includes("sign-ups are disabled") || m.includes("private")) {
    return "This e-mail address is not registered for this dashboard.";
  }
  if (m.includes("expired") || m.includes("invalid")) return "That code is wrong or has expired.";
  if (typeof navigator !== "undefined" && !navigator.onLine) return "You're offline.";
  return message || "Something went wrong. Please try again.";
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  );
}

export function LoginView({
  capabilities,
  next,
  error,
}: {
  capabilities: AuthCapabilities;
  next: string;
  error?: string;
}) {
  const [step, setStep] = useState<"start" | "code">("start");
  const rememberedEmail = useStoredValue("ssa:last-email");
  const [typedEmail, setEmail] = useState<string | null>(null);
  const email = typedEmail ?? rememberedEmail;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<null | "email" | "code" | "passkey" | "google">(null);
  const [message, setMessage] = useState<string | null>(error ? (ERRORS[error] ?? null) : null);
  const [cooldown, setCooldown] = useState(0);
  const hydrated = useHydrated();
  const webauthn = hydrated && "PublicKeyCredential" in window;
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const done = () => {
    clearPersistedCache();
    window.location.replace(next);
  };

  const sendCode = async () => {
    const address = email.trim().toLowerCase();
    if (!address.includes("@")) {
      setMessage("Please enter your e-mail address.");
      return;
    }
    setBusy("email");
    setMessage(null);
    const { error: otpError } = await createClient().auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: false },
    });
    setBusy(null);
    if (otpError) {
      setMessage(friendlyError(otpError.message, otpError.status));
      return;
    }
    try {
      localStorage.setItem("ssa:last-email", address);
    } catch {
      // ignore
    }
    setStep("code");
    setCooldown(60);
    setCode("");
    window.setTimeout(() => codeRef.current?.focus(), 150);
  };

  const verify = async (token: string) => {
    if (token.length < OTP_LENGTH) return;
    setBusy("code");
    setMessage(null);
    const { error: verifyError } = await createClient().auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: "email",
    });
    if (verifyError) {
      setBusy(null);
      setMessage(friendlyError(verifyError.message, verifyError.status));
      setCode("");
      codeRef.current?.focus();
      return;
    }
    done();
  };

  const passkey = async () => {
    setBusy("passkey");
    setMessage(null);
    const { error: passkeyError } = await createClient().auth.signInWithPasskey();
    if (passkeyError) {
      setBusy(null);
      const cancelled = /abort|cancel|not allowed/i.test(passkeyError.message);
      setMessage(cancelled ? null : friendlyError(passkeyError.message));
      return;
    }
    done();
  };

  const google = async () => {
    setBusy("google");
    setMessage(null);
    const { error: oauthError } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (oauthError) {
      setBusy(null);
      setMessage(friendlyError(oauthError.message));
    }
  };

  const showPasskey = capabilities.passkeys && webauthn;

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        className="w-full max-w-[26rem] rounded-(--radius-card) p-7 glass md:p-9"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="mb-6 size-14 rounded-2xl shadow-[0_12px_40px_-12px_var(--accent)]" />
        <h1 className="ui-title text-2xl font-semibold tracking-tight">Smart Assistant</h1>
        <p className="mt-1 text-muted">Sign in to your private dashboard.</p>

        <AnimatePresence mode="wait" initial={false}>
          {step === "start" ? (
            <motion.div
              key="start"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
              className="mt-7 flex flex-col gap-3"
            >
              {showPasskey && (
                <Button variant="primary" size="lg" onClick={passkey} disabled={busy !== null}>
                  {busy === "passkey" ? <Loader2 className="animate-spin" /> : <Fingerprint />}
                  Sign in with passkey
                </Button>
              )}
              {capabilities.google && (
                <Button variant="secondary" size="lg" onClick={google} disabled={busy !== null}>
                  {busy === "google" ? <Loader2 className="animate-spin" /> : <GoogleIcon />}
                  Continue with Google
                </Button>
              )}
              {(showPasskey || capabilities.google) && (
                <div className="my-2 flex items-center gap-3 text-xs font-medium text-faint">
                  <span className="h-px flex-1 bg-line" /> or use a code by e-mail{" "}
                  <span className="h-px flex-1 bg-line" />
                </div>
              )}
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendCode();
                }}
              >
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email webauthn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    enterKeyHint="send"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  variant={showPasskey || capabilities.google ? "secondary" : "primary"}
                  disabled={busy !== null}
                >
                  {busy === "email" ? <Loader2 className="animate-spin" /> : <Mail />}
                  Send me a code
                </Button>
              </form>
            </motion.div>
          ) : (
            <motion.form
              key="code"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.18 }}
              className="mt-7 flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void verify(code);
              }}
            >
              <p className="text-sm text-muted">
                We sent a code to <span className="font-semibold text-fg">{email.trim()}</span>. It&apos;s valid for a
                limited time.
              </p>
              <div>
                <Label htmlFor="code">Code</Label>
                <Input
                  ref={codeRef}
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={OTP_LENGTH + 4}
                  value={code}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH);
                    setCode(digits);
                    if (digits.length === OTP_LENGTH) void verify(digits);
                  }}
                  placeholder={"•".repeat(OTP_LENGTH)}
                  className="h-16 text-center text-3xl font-semibold tracking-[0.5em] tabular"
                />
              </div>
              <Button type="submit" size="lg" variant="primary" disabled={busy !== null || code.length < OTP_LENGTH}>
                {busy === "code" ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                Sign in
              </Button>
              <div className="flex items-center justify-between pt-1">
                <Button variant="ghost" size="sm" onClick={() => setStep("start")}>
                  <ArrowLeft /> Change e-mail
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={cooldown > 0 || busy !== null}
                  onClick={() => void sendCode()}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {message && (
            <motion.p
              role="alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={cn("mt-4 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger")}
            >
              {message}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}
