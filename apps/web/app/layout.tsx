import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";
import { Providers } from "@/components/providers";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { JsonLd } from "@/components/json-ld";
import { PWAProvider } from "@/components/pwa-provider";
import { OfflineIndicator } from "@/components/offline-indicator";
import { InstallPrompt } from "@/components/install-prompt";
import { UpdatePrompt } from "@/components/update-prompt";
import { makeMetadata, SITE_URL } from "@/lib/metadata";

export const metadata: Metadata = {
  ...makeMetadata(),
  manifest: `${SITE_URL}/manifest.json`,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Ascendly',
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Ascendly",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  sameAs: [
    "https://twitter.com/ascendly",
    "https://linkedin.com/company/ascendly",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var theme = localStorage.getItem("ascendly-theme");
                if (!theme) {
                  theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
                }
                if (theme === "dark") {
                  document.documentElement.classList.add("dark");
                }
              } catch(e) {}
            })();
          `
        }} />
        <JsonLd data={organizationSchema} />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#d97706" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#f59e0b" media="(prefers-color-scheme: dark)" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png" />
      </head>
      <body className="antialiased min-h-screen flex flex-col bg-neutral-0 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-primary-700 focus:px-4 focus:py-2 focus:text-white"
          tabIndex={0}
        >
          Skip to main content
        </a>
        <Providers>
          <ThemeProvider>
            <ToastProvider>
              <PWAProvider>
                <Navbar />
                <main id="main-content" className="flex-1" role="main">
                  {children}
                </main>
                <Footer />
                <OfflineIndicator />
                <InstallPrompt />
                <UpdatePrompt />
              </PWAProvider>
            </ToastProvider>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
