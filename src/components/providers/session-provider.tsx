"use client";

import { createContext, useContext } from "react";

export type SessionInfo = { userId: string; email: string | null };

const SessionContext = createContext<SessionInfo | null>(null);

export function SessionProvider({ value, children }: { value: SessionInfo; children: React.ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionInfo {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside the signed-in app shell");
  return session;
}
