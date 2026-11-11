import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta("Gün sonu kasa", "Servis tahsilatları, giderler ve net kasa.", "/servis/kasa", { index: false });
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
