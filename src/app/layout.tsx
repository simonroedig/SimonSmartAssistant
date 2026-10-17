import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Providers } from "@/components/providers/providers";
import { deviceInitScript } from "@/lib/device";
// Fonts of the other designs (self-hosted; a browser only downloads the one in use).
import "@fontsource-variable/manrope";
import "@fontsource-variable/nunito";
import "@fontsource-variable/shantell-sans";
import "@fontsource-variable/space-grotesk";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Smart Assistant", template: "%s · Smart Assistant" },
  description: "Simon's personal dashboard: day planner, weather, shopping list and backlog.",
  applicationName: "Smart Assistant",
  appleWebApp: { capable: true, title: "Assistant", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false, email: false, address: false },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#060913",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Per-request CSP nonce set by the proxy; needed for our inline boot script.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: deviceInitScript }} />
      </head>
      <body className="min-h-dvh">
        <div className="ambient" aria-hidden="true">
          <span />
          {/* Aurora Sky's sun and moon (unused by the other designs). */}
          <i />
        </div>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
