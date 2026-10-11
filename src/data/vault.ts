"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { openVault } from "@/lib/vault";
import { queryKeys, useAppQuery } from "./core";

/** What the database says about the vault: a PIN set? locked after wrong tries until when? */
export type VaultStatus = { hasPin: boolean; lockedUntil: string | null };

/** The answer of `vault_unlock` / `vault_set_pin`. */
export type VaultResult =
  | { ok: true; token?: string; expires_at?: string }
  | { ok: false; reason: "no_pin" | "locked" | "wrong" | "invalid" | "sign_in_again"; locked_until?: string | null };

export function useVaultStatus() {
  return useAppQuery({
    queryKey: queryKeys.vaultStatus,
    queryFn: async (): Promise<VaultStatus> => {
      const { data, error } = await createClient().rpc("vault_status");
      if (error) throw error;
      const status = data as { has_pin: boolean; locked_until: string | null };
      return { hasPin: status.has_pin, lockedUntil: status.locked_until };
    },
    staleTime: 60_000,
  });
}

/** Unlocks with the PIN; on success the vault is open (see lib/vault). */
export async function unlockVault(pin: string): Promise<VaultResult> {
  const { data, error } = await createClient().rpc("vault_unlock", { pin });
  if (error) throw error;
  const result = data as VaultResult;
  if (result.ok && result.token && result.expires_at) openVault(result.token, result.expires_at);
  return result;
}

export function useSetVaultPin() {
  const queryClient = useQueryClient();
  return async (newPin: string, currentPin?: string): Promise<VaultResult> => {
    const { data, error } = await createClient().rpc("vault_set_pin", {
      new_pin: newPin,
      ...(currentPin ? { current_pin: currentPin } : {}),
    });
    if (error) throw error;
    void queryClient.invalidateQueries({ queryKey: queryKeys.vaultStatus });
    return data as VaultResult;
  };
}
