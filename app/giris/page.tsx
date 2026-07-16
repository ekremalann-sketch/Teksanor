"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [statusReady, setStatusReady] = useState(false);
  const [accountType, setAccountType] = useState<"business" | "personal">("business");
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") === "register") setMode("register");
    fetch("/api/auth/status")
      .then(async (response) => {
        const data = await response.json() as { ready?: boolean; error?: string };
        if (!response.ok || !data.ready) throw new Error(data.error ?? "Portal hazırlanamadı.");
        setStatusReady(true);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Giriş sistemi şu anda hazır değil."));
  }, []);

  function changeMode(next: "login" | "register") {
    setMode(next); setError(""); setPassword("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload = mode === "login"
        ? { username, password }
        : { accountType, companyName, fullName, email, username, password };
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as { error?: string; organization?: { id: string } };
      if (!response.ok) throw new Error(data.error ?? (mode === "login" ? "Giriş yapılamadı." : "Kayıt oluşturulamadı."));
      if (data.organization?.id) localStorage.setItem("teksanor_organization", data.organization.id);
      window.location.href = "/panel";
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "İşlem tamamlanamadı.");
    } finally { setLoading(false); }
  }

  return (
    <main className="login-page">
      <div className="login-brand-panel">
        <div className="login-grid" />
        <Link href="/" className="back-home"><ArrowLeft size={17} /> Ana sayfaya dön</Link>
        <div className="login-brand-copy">
          <img src="/assets/teksanor-logo.png" alt="Teksanor" />
          <span className="login-kicker">Güvenli finans ve operasyon merkezi</span>
          <h1>Her firma için<br />yalnızca kendi verisi.</h1>
          <p>Şirketler ve bireysel kullanıcılar birbirinden tamamen ayrılmış özel çalışma alanlarında nakit, borç, gider ve belgelerini yönetir.</p>
          <div className="login-trust"><ShieldCheck size={20} /><span><b>Şirket bazlı veri izolasyonu</b>Bir kullanıcı başka şirketin kayıtlarını göremez veya API üzerinden çağıramaz.</span></div>
          <div className="login-capabilities"><span><CheckCircle2 /> Özel çalışma alanı</span><span><CheckCircle2 /> Rol yönetimi</span><span><CheckCircle2 /> İşlem geçmişi</span></div>
        </div>
      </div>

      <div className="login-form-panel">
        <form className={`login-card ${mode === "register" ? "register-card" : ""}`} onSubmit={submit}>
          <div className="auth-mode-tabs"><button type="button" className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")}>Giriş yap</button><button type="button" className={mode === "register" ? "active" : ""} onClick={() => changeMode("register")}>Kayıt ol</button></div>
          <div className="login-lock">{mode === "login" ? <LockKeyhole size={21} /> : accountType === "business" ? <Building2 size={21} /> : <UserRound size={21} />}</div>
          <span className="form-kicker">TEKSANOR KURUMSAL PORTAL</span>
          <h2>{mode === "login" ? "Portala giriş" : "Özel çalışma alanınızı oluşturun"}</h2>
          <p>{mode === "login" ? "Kullanıcı adınız ve parolanızla devam edin." : "14 günlük deneme alanınız yalnızca size ve yetkilendirdiğiniz kişilere açık olur."}</p>

          {mode === "register" && <>
            <div className="account-type-grid"><button type="button" className={accountType === "business" ? "active" : ""} onClick={() => setAccountType("business")}><Building2 /><span><b>Firma hesabı</b><small>Şirket ve çalışanlar için</small></span></button><button type="button" className={accountType === "personal" ? "active" : ""} onClick={() => setAccountType("personal")}><UserRound /><span><b>Bireysel hesap</b><small>Kişisel günlük takip için</small></span></button></div>
            {accountType === "business" && <label><span>Firma adı</span><input required value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Firmanızın görünen adı" /></label>}
            <label><span>Ad soyad</span><input required value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" /></label>
            <label><span>E-posta</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
          </>}
          <label><span>Kullanıcı adı</span><input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Kullanıcı adınız" /></label>
          <label><span>Parola</span><div className="password-field"><input required minLength={mode === "register" ? 10 : 6} type={showPassword ? "text" : "password"} autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "register" ? "En az 10 karakter" : "Parolanız"} /><button type="button" aria-label={showPassword ? "Parolayı gizle" : "Parolayı göster"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="login-submit" disabled={loading || !statusReady} type="submit">{loading ? "İşlem yapılıyor..." : !statusReady ? "Portal hazırlanıyor..." : mode === "login" ? "Giriş yap" : "Ücretsiz denemeyi başlat"}{!loading && statusReady && <ArrowRight size={18} />}</button>
          <div className="login-security-note"><LockKeyhole size={14} /> Kayıtlar yalnızca hesabınızın çalışma alanında saklanır.</div>
        </form>
      </div>
    </main>
  );
}
