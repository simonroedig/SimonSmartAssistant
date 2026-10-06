"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fingerprint, KeyRound, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { fetchAuthCapabilities } from "@/lib/auth/capabilities";
import { formatNumericDate } from "@/lib/date";
import { createClient } from "@/lib/supabase/client";

/** Register and manage passkeys (Face ID, fingerprint, security key) for quick sign-in. */
export function Passkeys() {
  const queryClient = useQueryClient();
  const hydrated = useHydrated();
  const supported = hydrated && "PublicKeyCredential" in window;
  const [busy, setBusy] = useState(false);

  const capabilities = useQuery({
    queryKey: ["auth-capabilities"],
    queryFn: () => fetchAuthCapabilities(),
    staleTime: 60 * 60_000,
    meta: { persist: false },
  });

  const enabled = capabilities.data?.passkeys === true;

  const passkeys = useQuery({
    queryKey: ["passkeys"],
    queryFn: async () => {
      const { data, error } = await createClient().auth.passkey.list();
      if (error) throw error;
      return data;
    },
    enabled,
    meta: { persist: false },
  });

  if (capabilities.isLoading) return <div className="skeleton h-16" />;

  if (!enabled) {
    return (
      <p className="text-sm text-muted">
        Passkeys are not enabled for this project yet. Turn them on in Supabase under Authentication → Passkeys (see the
        setup guide) to sign in with Face ID or your fingerprint.
      </p>
    );
  }

  const add = async () => {
    setBusy(true);
    const { error } = await createClient().auth.registerPasskey();
    setBusy(false);
    if (error) {
      if (!/abort|cancel|not allowed/i.test(error.message))
        toast.error("Couldn't add the passkey", { description: error.message });
      return;
    }
    toast.success("Passkey added – use it next time you sign in");
    void queryClient.invalidateQueries({ queryKey: ["passkeys"] });
  };

  const remove = async (id: string) => {
    const { error } = await createClient().auth.passkey.delete({ passkeyId: id });
    if (error) {
      toast.error("Couldn't remove the passkey", { description: error.message });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["passkeys"] });
  };

  return (
    <div className="flex flex-col gap-3">
      {passkeys.data && passkeys.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {passkeys.data.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-surface-sunken px-4 py-3">
              <KeyRound className="size-5 text-accent" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.friendly_name || "Passkey"}</div>
                <div className="text-xs text-muted">
                  Added {formatNumericDate(new Date(p.created_at))}
                  {p.last_used_at ? ` · last used ${formatNumericDate(new Date(p.last_used_at))}` : ""}
                </div>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="Remove passkey" onClick={() => void remove(p.id)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="secondary" onClick={() => void add()} disabled={!supported || busy} className="self-start">
        {busy ? <Loader2 className="animate-spin" /> : <Fingerprint />}
        Add a passkey for this device
      </Button>
      {!supported && <p className="text-sm text-muted">This browser doesn&apos;t support passkeys.</p>}
    </div>
  );
}
