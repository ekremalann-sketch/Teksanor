import { pageMeta } from "@/lib/seo";

// Müşteri onay bağlantısı kişiye özeldir: arama motoruna ve bağlantı önizlemesine kapalı.
export const metadata = { ...pageMeta("Servis onayı", "Teksanor servis teklif veya tamamlanma onayı.", "/servis/onay", { index: false }), openGraph: undefined, twitter: undefined, referrer: "no-referrer" as const };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
