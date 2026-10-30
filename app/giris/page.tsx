"use client";

import Link from "next/link";
import {safeWorkspacePath} from "@/lib/workspace-navigation";
import { forgetOrganization, rememberOrganization, storedOrganization } from "@/lib/org-client";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [accountType, setAccountType] = useState<"business" | "personal">("business");
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [challengeToken, setChallengeToken] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const requestedMode = new URLSearchParams(window.location.search).get("mode");
    if (new URLSearchParams(window.location.search).get("reason") === "idle") setNotice("Güvenliğiniz için 30 dakika işlem yapılmadığından oturum kapatıldı. Yeniden giriş yapın.");
    if (requestedMode === "register" || window.location.hash === "#kayit") setMode("register");
    if(requestedMode!=="register"&&window.location.hash!=="#kayit")void fetch("/api/auth/session?organizationId="+encodeURIComponent(storedOrganization()),{cache:"no-store",credentials:"same-origin"}).then(async r=>{
      if(!r.ok)return;const session=await r.json();if(!session.authenticated){forgetOrganization();return;}
      if(session.organizationId)rememberOrganization(session.organizationId);else forgetOrganization();
      const back=safeWorkspacePath(new URLSearchParams(location.search).get("returnTo")||session.homePath);
      location.replace(session.mfaEnrollmentRequired?"/hesap-guvenligi?returnTo="+encodeURIComponent(back):back);
    }).catch(()=>{});
    // Hazırlık kontrolü girişi ENGELLEMEZ: düğme hemen kullanılabilir. Kontrol arka planda en fazla 8 sn bekler;
    // yavaşsa veya hata verirse yalnız kısa bir uyarı gösterilir (önceden "Portal hazırlanıyor…" sonsuza dek bekletebiliyordu).
    fetch("/api/auth/status", { cache: "no-store", signal: AbortSignal.timeout(8000) })
      .then(async (response) => {
        const data = await response.json().catch(() => ({})) as { ready?: boolean; error?: string };
        if (!response.ok || !data.ready) throw new Error(data.error ?? "Portal hazırlanamadı.");
      })
      .catch(() => setNotice((current) => current || "Sunucu yanıtı gecikiyor. Yine de giriş yapmayı deneyebilirsiniz; sorun sürerse birkaç dakika sonra tekrar deneyin."));
  }, []);

  function changeMode(next: "login" | "register") {
    setMode(next); setError(""); setPassword(""); setChallengeToken(""); setVerificationCode("");
    window.history.replaceState(null, "", next === "register" ? "/giris#kayit" : "/giris");
  }

  const [noticeRead,setNoticeRead]=useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      const endpoint = challengeToken ? "/api/auth/mfa/challenge" : mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload = challengeToken
        ? { challengeToken, code: verificationCode }
        : mode === "login"
        ? { username, password }
        : { accountType, companyName, fullName, email, username, password, noticeVersion:noticeRead?"2026-10-10":null };
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(25000) }).catch((reason: unknown) => { throw new Error(reason instanceof DOMException && reason.name === "TimeoutError" ? "Sunucu 25 saniyede yanıt vermedi. Bağlantınızı kontrol edip yeniden deneyin." : "Sunucuya ulaşılamadı. Bağlantınızı kontrol edip yeniden deneyin."); });
      const data = await response.json() as { error?: string; organization?: { id: string }; mfaRequired?: boolean; challengeToken?: string };
      if (!response.ok) throw new Error(data.error ?? (mode === "login" ? "Giriş yapılamadı." : "Kayıt oluşturulamadı."));
      if (data.mfaRequired && data.challengeToken) {
        setChallengeToken(data.challengeToken);
        setPassword("");
        return;
      }
      if (data.organization?.id) rememberOrganization(data.organization.id);
      const sessionResponse=await fetch("/api/auth/session?organizationId="+encodeURIComponent(storedOrganization()),{cache:"no-store"});
      const session=sessionResponse.ok?await sessionResponse.json():{};
      // Önceki kullanıcıdan kalan firma seçimi yeni oturuma taşınmaz: sunucunun çözdüğü firma saklanır.
      if(session.organizationId)rememberOrganization(session.organizationId);else forgetOrganization();
      const back=safeWorkspacePath(new URLSearchParams(location.search).get("returnTo")||session.homePath);
      window.location.replace(session.mfaEnrollmentRequired?"/hesap-guvenligi?returnTo="+encodeURIComponent(back):back);
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
          <img src="/assets/teksanor-logo.webp" alt="Teksanor" width={400} height={160} decoding="async" />
          <span className="login-kicker">Saha servis ve operasyon yönetimi</span>
          <h1>Her firma için<br />yalnızca kendi verisi.</h1>
          <p>Servis talepleri, teknisyen planı, müşteri onayı ve belgeler her firmaya ayrılmış özel çalışma alanında yönetilir.</p>
          <div className="login-trust"><ShieldCheck size={20} /><span><b>Şirket bazlı veri izolasyonu</b>Bir kullanıcı başka şirketin kayıtlarını hiçbir yoldan göremez.</span></div>
          <div className="login-capabilities"><span><CheckCircle2 /> Özel çalışma alanı</span><span><CheckCircle2 /> Rol yönetimi</span><span><CheckCircle2 /> İşlem geçmişi</span></div>
        </div>
      </div>

      <div className="login-form-panel">
        <form className={`login-card ${mode === "register" ? "register-card" : ""}`} onSubmit={submit}>
          <div className="auth-mode-tabs"><button type="button" className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")}>Giriş yap</button><button type="button" className={mode === "register" ? "active" : ""} onClick={() => changeMode("register")}>Kayıt ol</button></div>
          <div className="login-lock">{mode === "login" ? <LockKeyhole size={21} /> : accountType === "business" ? <Building2 size={21} /> : <UserRound size={21} />}</div>
          <span className="form-kicker">TEKSANOR KURUMSAL PORTAL</span>
          <h2>{challengeToken ? "Güvenlik doğrulaması" : mode === "login" ? "Giriş yap" : "Özel çalışma alanınızı oluşturun"}</h2>
          <p>{challengeToken ? "Kimlik doğrulama uygulamanızda görünen 6 haneli kodu girin." : mode === "login" ? "Kullanıcı adınız ve parolanızla devam edin." : "14 günlük deneme alanınız yalnızca size ve yetkilendirdiğiniz kişilere açık olur."}</p>

          {!challengeToken && mode === "register" && <>
            <div className="account-type-grid"><button type="button" className={accountType === "business" ? "active" : ""} onClick={() => setAccountType("business")}><Building2 /><span><b>Firma hesabı</b><small>Şirket ve çalışanlar için</small></span></button><button type="button" className={accountType === "personal" ? "active" : ""} onClick={() => setAccountType("personal")}><UserRound /><span><b>Bireysel hesap</b><small>Kişisel günlük takip için</small></span></button></div>
            {accountType === "business" && <label><span>Firma adı <b aria-hidden="true">*</b></span><input aria-required="true" required value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Firmanızın görünen adı" /></label>}
            <label><span>Ad soyad <b aria-hidden="true">*</b></span><input aria-required="true" required value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" /></label>
            <label><span>E-posta <b aria-hidden="true">*</b></span><input aria-required="true" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
          </>}
          {challengeToken ? (useRecovery
            ? <label><span>Kurtarma kodu <b aria-hidden="true">*</b></span><input aria-required="true" required autoComplete="off" autoCapitalize="characters" maxLength={9} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 9))} placeholder="ABCD-EFGH" /><small className="login-hint">Kurulumda indirdiğiniz kodlardan biri. Her kod bir kez çalışır.</small></label>
            : <label><span>6 haneli doğrulama kodu <b aria-hidden="true">*</b></span><input aria-required="true" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" /></label>) : <>
            <label><span>Kullanıcı adı <b aria-hidden="true">*</b></span><input aria-required="true" required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Kullanıcı adınız" /></label>
            <label><span>Parola <b aria-hidden="true">*</b></span><div className="password-field"><input aria-required="true" required minLength={mode === "register" ? 10 : 6} type={showPassword ? "text" : "password"} autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "register" ? "En az 10 karakter" : "Parolanız"} /><button type="button" aria-label={showPassword ? "Parolayı gizle" : "Parolayı göster"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          </>}
          {mode==="register"&&!challengeToken&&<label><input type="checkbox" required checked={noticeRead} onChange={e=>setNoticeRead(e.target.checked)}/> <span><Link href="/aydinlatma" target="_blank">Aydınlatma metnini</Link> okudum (10.10.2026). Bu kayıt açık rıza yerine geçmez.</span></label>}
          {notice && !error && <div className="form-notice" role="status">{notice}</div>}
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="login-submit" disabled={loading} type="submit">{loading ? "İşlem yapılıyor..." : challengeToken ? "Kodu doğrula" : mode === "login" ? "Giriş yap" : "Ücretsiz denemeyi başlat"}{!loading && <ArrowRight size={18} />}</button>
          {challengeToken && <button type="button" className="auth-secondary-action" onClick={() => { setUseRecovery((value) => !value); setVerificationCode(""); setError(""); }}>{useRecovery ? "Uygulamadaki 6 haneli kodu kullan" : "Telefonum yanımda değil, kurtarma kodu kullan"}</button>}
          {challengeToken && <button type="button" className="auth-secondary-action" onClick={() => { setChallengeToken(""); setVerificationCode(""); setUseRecovery(false); setError(""); }}>Kullanıcı adı ve parolaya dön</button>}
          <p><Link href="/hesap-kurtarma">Parolamı unuttum</Link></p>
          <div className="login-security-note"><LockKeyhole size={14} /> Kayıtlar yalnızca hesabınızın çalışma alanında saklanır.</div>
        </form>
      </div>
    </main>
  );
}
