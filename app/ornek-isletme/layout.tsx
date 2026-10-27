import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta("Örnek işletme", "Platform yöneticisi için örnek firma oluşturma.", "/ornek-isletme", { index: false });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
