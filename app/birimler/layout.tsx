import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta("Birimler", "Her iş biriminin süreçleri, onayları ve gecikmeleri tek ekranda.", "/birimler", { index: false });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
