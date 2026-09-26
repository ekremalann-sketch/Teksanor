import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta("Servis masası", "Teknik servis iş akışı: talep, teklif, müşteri onayı, saha kaydı ve tahsilat.", "/servis", { index: false });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
