"use client";

import { useEffect } from "react";

/** Last-resort error screen (replaces the root layout). Keeps the wall display alive. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Wall displays: try again automatically after a minute.
    const id = window.setTimeout(() => window.location.reload(), 60_000);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#060913",
          color: "#eef1fb",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontWeight: 600 }}>Something went wrong</h1>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 16,
              padding: "12px 20px",
              borderRadius: 16,
              border: 0,
              background: "#8d7dff",
              color: "#0b0c1a",
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
