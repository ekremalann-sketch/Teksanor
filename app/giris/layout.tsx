import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta("Portala giriş", "Teksanor yönetim portalına giriş ve yeni çalışma alanı oluşturma.", "/giris");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
