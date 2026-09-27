import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta("Hesap kurtarma", "Doğrulanmış e-posta ile parola yenileme.", "/hesap-kurtarma", { index: false });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
