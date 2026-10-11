"use client";

import { Lock } from "lucide-react";
import { useState } from "react";
import { Row, Section } from "@/components/settings/section";
import { Button } from "@/components/ui/button";
import { useVaultStatus } from "@/data/vault";
import { VaultPinSheet, type VaultPinMode } from "./vault-pin-sheet";

/** Settings: the PIN of the notes vault – set it, change it, or reset it with an e-mail code. */
export function VaultSection() {
  const status = useVaultStatus();
  const [mode, setMode] = useState<VaultPinMode | null>(null);
  const hasPin = status.data?.hasPin === true;

  return (
    <Section
      icon={<Lock />}
      title="Notes vault"
      description="Notes in the vault only open with your 4-digit PIN – on every device."
    >
      <Row label="PIN" hint={status.data ? (hasPin ? "Set" : "Not set yet") : "…"}>
        <Button
          variant="secondary"
          size="sm"
          disabled={!status.data}
          onClick={() => setMode(hasPin ? "change" : "setup")}
        >
          {hasPin ? "Change PIN" : "Set PIN"}
        </Button>
      </Row>
      {hasPin && (
        <Row label="Forgot your PIN?" hint="Confirm with a code from your e-mail, then choose a new one.">
          <Button variant="ghost" size="sm" onClick={() => setMode("reset")}>
            Reset PIN
          </Button>
        </Row>
      )}
      <VaultPinSheet open={mode !== null} mode={mode ?? "setup"} onClose={() => setMode(null)} />
    </Section>
  );
}
