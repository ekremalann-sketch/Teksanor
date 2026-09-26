import type { Metadata } from "next";
import "./globals.css";
import "./home.css";

export const metadata: Metadata = {
  title: "Teksanor | Mühendislik, Veri ve Yapay Zekâ",
  description: "Teksanor; mühendislik yaklaşımını veri analitiği, süreç otomasyonu ve yapay zekâ destekli çözümlerle bir araya getirir.",
  robots: { index: true, follow: true },
  icons: { icon: "/assets/teksanor-brand.png", apple: "/assets/teksanor-brand.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
