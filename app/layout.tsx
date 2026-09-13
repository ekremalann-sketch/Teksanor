import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teksanor · Teknik Servis, Bakım ve Mühendislik Operasyon Platformu",
  description:
    "Teksanor; iş emirleri, saha ziyaretleri, ekipman ve periyodik bakım, finans ve belge yönetimini tek çalışma alanında birleştiren kurumsal operasyon platformudur.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
