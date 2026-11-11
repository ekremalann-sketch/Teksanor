import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta("Stok", "Servis parça stoku ve kritik seviye uyarıları.", "/servis/stok", { index: false });
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
