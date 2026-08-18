import { cookies } from "next/headers";
import type { Metadata, Viewport } from "next";

import "./globals.css";

import { cn } from "@/lib/utils";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { ActiveThemeProvider } from "@/components/active-theme";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { PWAInstallPrompt } from "@/components/pwa/install-prompt";
import { VersionUpdateBanner } from "@/components/pwa/version-update-banner";
import { ThemeColorSync } from "@/components/pwa/theme-color-sync";
import { AppTitleBar } from "@/components/pwa/app-titlebar";
import { CommandMenuProvider } from "@/components/providers/command-menu-provider";
import { QueryProvider } from "./providers";

import { Poppins } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Vida Buddies",
  description:
    "A fully responsive analytics dashboard featuring dynamic charts, interactive tables, a collapsible sidebar, and a light/dark mode theme switcher. Built with modern web technologies, it ensures seamless performance across devices, offering an intuitive user interface for data visualization and exploration.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vida Buddies",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

/**
 * `viewport-fit: cover` is what makes `env(safe-area-inset-*)` report real
 * values. Without it the installed mobile app renders its header underneath
 * the status bar and notch, because `appleWebApp.statusBarStyle` is
 * translucent and the web view therefore owns the full screen.
 *
 * Zoom is deliberately left unrestricted — an ERP gets read on a phone in a
 * warehouse, and pinch-to-zoom is not ours to take away.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const activeThemeValue = cookieStore.get("active_theme")?.value;
  const isScaled = activeThemeValue?.endsWith("-scaled");

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          The browser paints the installed window's OS buttons on this colour.
          Seeded to the dark title bar (matching `defaultTheme="dark"`) for a
          clean first paint; <ThemeColorSync /> keeps it honest after that.
        */}
        <meta name="theme-color" content="#1c1917" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Audiowide&family=Dancing+Script:wght@400..700&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Lobster&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Quicksand:wght@300..700&display=swap" rel="stylesheet" />
      </head>
      <body
        suppressHydrationWarning
        className={cn(
          "bg-background overscroll-none antialiased h-screen overflow-hidden",
          poppins.variable,
          "font-poppins",
          activeThemeValue ? `theme-${activeThemeValue}` : "",
          isScaled ? "theme-scaled" : ""
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
          enableColorScheme
        >
          <ActiveThemeProvider initialTheme={activeThemeValue}>
            <QueryProvider>
            {/*
              The title bar lives at the root, not in the protected shell.
              `start_url` is "/", which redirects an unauthenticated launch to
              /login — so a shell-only title bar would leave the very first
              window a user sees with no drag surface at all.
            */}
            <CommandMenuProvider>
              <AppTitleBar />
              <div data-app-shell="" className="min-h-0 flex-1">
                {children}
              </div>
            </CommandMenuProvider>
            <Toaster position="bottom-right" richColors duration={1500} />
            <ThemeColorSync />
            <ServiceWorkerRegistration />
            <PWAInstallPrompt />
            <VersionUpdateBanner />
            </QueryProvider>
          </ActiveThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
