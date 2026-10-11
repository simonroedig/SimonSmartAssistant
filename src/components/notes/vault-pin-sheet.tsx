"use client";

import { Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/providers/session-provider";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { unlockVault, useSetVaultPin, type VaultResult } from "@/data/vault";
import { OTP_LENGTH } from "@/lib/auth/otp";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const PIN_LENGTH = 4;

/** Four boxes over one numeric field: type (or paste) the digits, it submits on the last one. */
function PinField({
  value,
  onChange,
  onComplete,
  label,
  disabled,
  length = PIN_LENGTH,
  secret = true,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete: (value: string) => void;
  label: string;
  disabled?: boolean;
  length?: number;
  secret?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (disabled) return;
    const id = window.setTimeout(() => input.current?.focus(), 150);
    return () => window.clearTimeout(id);
  }, [disabled, label]);

  return (
    <label className="relative mx-auto flex w-fit gap-2.5">
      <input
        ref={input}
        value={value}
        disabled={disabled}
        aria-label={label}
        inputMode="numeric"
        autoComplete={secret ? "off" : "one-time-code"}
        pattern="[0-9]*"
        maxLength={length}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, length);
          onChange(digits);
          if (digits.length === length) onComplete(digits);
        }}
        className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
      />
      {Array.from({ length }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn(
            "grid place-items-center rounded-2xl text-xl font-semibold tabular transition-colors well",
            length > PIN_LENGTH ? "h-12 w-9" : "size-14",
            // The box the next digit goes into.
            i === Math.min(value.length, length - 1) && "peer-focus:border-(--field-focus)",
            disabled && "opacity-50",
          )}
        >
          {value[i] ? secret ? <span className="size-3 rounded-full bg-fg" /> : value[i] : ""}
        </span>
      ))}
    </label>
  );
}

function useCountdown(until: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [until]);
  return until ? Math.max(0, Math.ceil((new Date(until).getTime() - now) / 1000)) : 0;
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} min`;
}

export type VaultPinMode = "unlock" | "setup" | "change" | "reset";

type Step = "current" | "pin" | "new" | "repeat" | "email" | "code";

const FIRST_STEP: Record<VaultPinMode, Step> = { unlock: "pin", setup: "new", change: "current", reset: "email" };

const TITLES: Record<VaultPinMode, { title: string; description: string }> = {
  unlock: { title: "Vault", description: "Enter your PIN to see the notes in the vault." },
  setup: { title: "Choose a vault PIN", description: "Four digits – you'll need them to open the vault." },
  change: { title: "Change the vault PIN", description: "First the current PIN, then the new one." },
  reset: {
    title: "Forgot your PIN?",
    description: "Confirm it's you with a code from your e-mail, then pick a new PIN.",
  },
};

const PROMPTS: Record<Exclude<Step, "email">, string> = {
  pin: "PIN",
  current: "Current PIN",
  new: "New PIN",
  repeat: "Repeat the new PIN",
  code: "Code from the e-mail",
};

/**
 * Opens the vault, sets or changes its PIN, or – forgotten – resets it after
 * signing in again with a code from the e-mail. `onDone` follows success (in
 * "unlock", and with `unlockAfter` also after a new PIN, the vault is open).
 */
export function VaultPinSheet({
  open,
  mode,
  unlockAfter = false,
  onClose,
  onDone,
}: {
  open: boolean;
  mode: VaultPinMode;
  unlockAfter?: boolean;
  onClose: () => void;
  onDone?: () => void;
}) {
  // A fresh form each time it opens (or switches to "forgot"); kept while it animates out.
  const [shown, setShown] = useState({ mode, count: 0, open });
  if (open !== shown.open) setShown({ mode, count: open ? shown.count + 1 : shown.count, open });
  return (
    <VaultPinForm
      key={shown.count}
      open={open}
      mode={shown.mode}
      unlockAfter={unlockAfter}
      onClose={onClose}
      onDone={onDone}
      onForgot={() => setShown({ mode: "reset", count: shown.count + 1, open })}
    />
  );
}

function VaultPinForm({
  open,
  mode,
  unlockAfter,
  onClose,
  onDone,
  onForgot,
}: {
  open: boolean;
  mode: VaultPinMode;
  unlockAfter: boolean;
  onClose: () => void;
  onDone?: () => void;
  onForgot: () => void;
}) {
  const { email } = useSession();
  const setPin = useSetVaultPin();
  const [step, setStep] = useState<Step>(FIRST_STEP[mode]);
  const [value, setValue] = useState("");
  const [current, setCurrent] = useState("");
  const [fresh, setFresh] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wait = useCountdown(lockedUntil);
  const locked = wait > 0;

  const go = (next: Step) => {
    setStep(next);
    setValue("");
  };

  const refused = (result: Extract<VaultResult, { ok: false }>, back: Step) => {
    if (result.locked_until) setLockedUntil(result.locked_until);
    setError(
      result.reason === "locked" || result.locked_until
        ? "Too many wrong tries."
        : result.reason === "sign_in_again"
          ? "Please confirm with a code from your e-mail first."
          : "Wrong PIN.",
    );
    go(back);
  };

  const finish = async (pin: string) => {
    if (unlockAfter) await unlockVault(pin);
    onDone?.();
    onClose();
  };

  const submit = async (digits: string) => {
    setError(null);
    setBusy(true);
    try {
      if (step === "pin") {
        const result = await unlockVault(digits);
        if (result.ok) {
          onDone?.();
          onClose();
        } else refused(result, "pin");
      } else if (step === "current") {
        setCurrent(digits);
        go("new");
      } else if (step === "new") {
        setFresh(digits);
        go("repeat");
      } else if (step === "repeat") {
        if (digits !== fresh) {
          setError("The two PINs don't match – try again.");
          go("new");
          return;
        }
        const result = await setPin(fresh, mode === "change" ? current : undefined);
        if (!result.ok) {
          refused(result, mode === "change" ? "current" : "new");
          return;
        }
        toast.success(mode === "setup" ? "Vault PIN set" : "Vault PIN changed");
        await finish(fresh);
      } else if (step === "code") {
        const { error: verifyError } = await createClient().auth.verifyOtp({
          email: email ?? "",
          token: digits,
          type: "email",
        });
        if (verifyError) {
          setError("That code didn't work – check it or send a new one.");
          go("code");
          return;
        }
        go("new");
      }
    } catch {
      setError("Something went wrong – check the connection and try again.");
      setValue("");
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async () => {
    if (!email) return;
    setBusy(true);
    setError(null);
    const { error: sendError } = await createClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (sendError) {
      setError("Couldn't send the code – try again in a minute.");
      return;
    }
    go("code");
  };

  const { title, description } = TITLES[mode];

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          {mode === "unlock" && (
            <Button variant="ghost" size="sm" onClick={onForgot}>
              Forgot PIN?
            </Button>
          )}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-slate-500/12 text-slate-500 dark:bg-slate-400/14 dark:text-slate-300">
          <Lock className="size-5" />
        </span>
        {step === "email" ? (
          <>
            <p className="max-w-xs text-sm text-muted">
              We&apos;ll send a sign-in code to <span className="font-medium text-fg">{email}</span>.
            </p>
            <Button variant="primary" disabled={busy || !email} onClick={() => void sendCode()}>
              Send code
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">{PROMPTS[step]}</p>
            <PinField
              value={value}
              onChange={setValue}
              onComplete={(digits) => void submit(digits)}
              label={PROMPTS[step]}
              disabled={busy || locked}
              length={step === "code" ? OTP_LENGTH : PIN_LENGTH}
              secret={step !== "code"}
            />
          </>
        )}
        <p role="status" className={cn("min-h-5 text-sm", error ? "text-danger" : "text-muted")}>
          {locked ? `Too many wrong tries – try again in ${formatWait(wait)}.` : error}
        </p>
      </div>
    </Sheet>
  );
}
