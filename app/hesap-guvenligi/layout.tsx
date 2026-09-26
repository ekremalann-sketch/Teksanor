import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta("Hesap güvenliği", "İki aşamalı doğrulama ve e-posta doğrulama ayarları.", "/hesap-guvenligi", { index: false });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
