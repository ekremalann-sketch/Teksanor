import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./public-navigation.css";
import "./home.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { PUBLIC_PAGES, SITE_URL, pageMeta, structuredData } from "@/lib/seo";

const home = PUBLIC_PAGES[0];

export const metadata: Metadata = {
  ...pageMeta(home.title, home.description, "/"),
  metadataBase: new URL(SITE_URL),
  title: { default: `Teksanor | ${home.title}`, template: "%s | Teksanor" },
  applicationName: "Teksanor",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icon-192.png" },
};

export const viewport: Viewport = { themeColor: "#071729" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>
        {children}
        <ServiceWorkerRegister />
        {/* Arama motorları için kuruluş/yazılım tanımı; çalıştırılabilir betik değildir. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()).replace(/</g, "\\u003c") }} />
      </body>
    </html>
  );
}
