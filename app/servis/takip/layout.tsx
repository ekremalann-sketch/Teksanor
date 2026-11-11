import { pageMeta } from "@/lib/seo";

// Müşteri takip bağlantısı kişiye özeldir: arama motoruna ve bağlantı önizlemesine kapalı.
export const metadata = { ...pageMeta("Servis takibi", "Teksanor servis kaydı takip sayfası.", "/servis/takip", { index: false }), openGraph: undefined, twitter: undefined, referrer: "no-referrer" as const };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
