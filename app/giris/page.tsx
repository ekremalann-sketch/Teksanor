"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type Mode = "login" | "register";

export default function GirisPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  // login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // register fields
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#kayit") {
      setMode("register");
    }
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setOk("");
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "login"
          ? { email, password }
          : { full_name: fullName, email, password, organization_name: orgName };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error || "İşlem tamamlanamadı.");
        setLoading(false);
        return;
      }
      setOk("Başarılı, yönlendiriliyorsunuz…");
      router.push("/panel");
    } catch {
      setError("Sunucuya ulaşılamadı. Lütfen tekrar deneyin.");
      setLoading(false);
    }
  }

  function fillDemo() {
    setMode("login");
    setEmail("yonetici@teksanor.com");
    setPassword("Teksanor2026!");
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <Link className="doc-back" href="/" style={{ marginTop: 0, marginBottom: 12 }}>
          <ArrowLeft size={16} /> Ana sayfa
        </Link>
        <h1>{mode === "login" ? "Kurumsal giriş" : "Yeni hesap oluştur"}</h1>
        <p className="auth-sub">Teksanor operasyon paneline erişin.</p>

        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">
            Giriş
          </button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")} type="button">
            Kayıt ol
          </button>
        </div>

        {error && <div className="auth-msg error">{error}</div>}
        {ok && <div className="auth-msg ok">{ok}</div>}

        <form onSubmit={submit}>
          {mode === "register" && (
            <>
              <div className="field">
                <label>Ad soyad</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Adınız Soyadınız" />
              </div>
              <div className="field">
                <label>Firma adı</label>
                <input value={orgName} onChange={(e) => setOrgName(e.target.value)} required placeholder="Firmanızın adı" />
              </div>
            </>
          )}
          <div className="field">
            <label>E-posta</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ornek@firma.com" />
          </div>
          <div className="field">
            <label>Parola</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
          </div>
          <button className="btn-block" type="submit" disabled={loading}>
            {loading ? "Lütfen bekleyin…" : mode === "login" ? "Giriş yap" : "Hesap oluştur"}
          </button>
        </form>

        <div className="auth-links">
          <Link href="/hesap-kurtarma">Parolamı unuttum</Link>
          <Link href="/hesap-guvenligi">Hesap güvenliği</Link>
        </div>

        <div className="auth-demo">
          <b>Demo hesabı</b>
          <div>yonetici@teksanor.com · Teksanor2026!</div>
          <button className="btn small ghost" type="button" onClick={fillDemo} style={{ marginTop: 8 }}>
            Demo bilgilerini doldur
          </button>
        </div>
      </div>
    </div>
  );
}
