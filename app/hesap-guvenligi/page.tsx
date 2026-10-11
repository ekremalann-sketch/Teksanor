"use client";

import { safeWorkspacePath } from "@/lib/workspace-navigation";
import { signOut } from "@/lib/org-client";
import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, Download, KeyRound, LogOut, RefreshCw, ShieldCheck } from "lucide-react";

type Status = {
  enabled: boolean;
  passwordOnly: boolean;
  mode?: "off" | "optional" | "required";
  passwordConfirmed: boolean;
  required: boolean;
  keyConfigured: boolean;
  deferred: boolean;
  deferredUntil: string | null;
  canDefer: boolean;
  recoveryLeft: number;
};

function returnTarget() {
  if (typeof window === "undefined") return "/panel";
  return safeWorkspacePath(new URLSearchParams(window.location.search).get("returnTo"));
}

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value.replace(" ", "T") + (value.endsWith("Z") ? "" : "Z"));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
}

export default function AccountSecurityPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [secret, setSecret] = useState("");
  const [otpAuthUri, setOtpAuthUri] = useState("");
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/auth/mfa/setup", { cache: "no-store" });
    if (response.status === 401) { location.replace("/giris?returnTo=" + encodeURIComponent(returnTarget())); return null; }
    if (!response.ok) throw new Error("Güvenlik durumu alınamadı. Sayfayı yenileyin.");
    const next = await response.json() as Status;
    setStatus(next);
    return next;
  }, []);

  const start = useCallback(async (withPassword = "") => {
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/auth/mfa/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", password: withPassword }) });
      const data = await response.json() as { secret?: string; otpAuthUri?: string; error?: string };
      if (!response.ok || !data.secret || !data.otpAuthUri) throw new Error(data.error || "Kurulum başlatılamadı.");
      setSecret(data.secret); setOtpAuthUri(data.otpAuthUri); setCode(""); setQr("");
      try { setQr(await QRCode.toDataURL(data.otpAuthUri, { width: 240, margin: 2 })); } catch { /* Manuel anahtar yine kullanılabilir. */ }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kurulum başlatılamadı.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    void load().then((next) => {
      // Parola bu oturumda az önce doğrulandıysa anahtarı hemen hazırla (tek tık eksilir).
      if (active && next && !next.passwordOnly && !next.enabled && next.passwordConfirmed && next.keyConfigured) void start();
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Güvenlik durumu alınamadı."); });
    return () => { active = false; };
  }, [load, start]);

  async function verify() {
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/auth/mfa/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await response.json() as { error?: string; recoveryCodes?: string[] };
      if (!response.ok) throw new Error(data.error || "Kod doğrulanamadı.");
      setSecret(""); setOtpAuthUri(""); setCode(""); setQr("");
      setRecoveryCodes(data.recoveryCodes ?? []);
      setMessage("İki aşamalı doğrulama etkinleştirildi.");
      setStatus((current) => current ? { ...current, enabled: true, deferred: false, recoveryLeft: data.recoveryCodes?.length ?? 0 } : current);
      if (!data.recoveryCodes?.length) window.setTimeout(() => location.replace(returnTarget()), 650);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kod doğrulanamadı.");
    } finally { setLoading(false); }
  }

  async function defer() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/auth/mfa/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "defer" }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Erteleme kaydedilemedi.");
      location.replace(returnTarget());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erteleme kaydedilemedi.");
      setLoading(false);
    }
  }

  async function regenerate() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/auth/mfa/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recovery-codes", password }) });
      const data = await response.json() as { error?: string; recoveryCodes?: string[] };
      if (!response.ok || !data.recoveryCodes) throw new Error(data.error || "Yeni kodlar üretilemedi.");
      setRecoveryCodes(data.recoveryCodes); setPassword("");
      setStatus((current) => current ? { ...current, recoveryLeft: data.recoveryCodes!.length } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Yeni kodlar üretilemedi.");
    } finally { setLoading(false); }
  }

  const [disableCode, setDisableCode] = useState("");
  async function disable() {
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/auth/mfa/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "disable", password, code: disableCode }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Kapatılamadı.");
      setPassword(""); setDisableCode("");
      setMessage("İki aşamalı doğrulama kapatıldı. Diğer cihazlardaki oturumlar sonlandırıldı.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kapatılamadı.");
    } finally { setLoading(false); }
  }

  async function logout() {
    await signOut("/giris?returnTo=" + encodeURIComponent(returnTarget()));
  }

  function downloadCodes() {
    const text = ["Teksanor kurtarma kodları", "Her kod bir kez kullanılabilir. Telefonunuza erişemediğinizde 6 haneli kod yerine yazın.", "", ...recoveryCodes].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "teksanor-kurtarma-kodlari.txt"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Panel bu hesap için açılabiliyor mu? Açılamıyorsa "Panele dön" göstermiyoruz: aksi hâlde aynı sayfaya geri döner (döngü).
  const panelOpen = !!status && (status.enabled || !status.required);
  const showSetup = !!status && !status.enabled && status.keyConfigured;
  const target = returnTarget();

  if (status?.passwordOnly) return <main className="account-security-page"><section className="account-security-card"><div className="security-title"><ShieldCheck size={30}/><h1>Hesap güvenliği</h1></div><p>Bu sunucuda iki aşamalı doğrulama yönetici tarafından geçici olarak kapatıldı; girişte yalnız kullanıcı adı ve parola istenir. Güçlü ve başka yerde kullanmadığınız bir parola seçin. Giriş denemeleri sınırlıdır ve 30 dakika işlem yapılmazsa oturum kapanır.</p><a className="panel-primary" href={target}>Panele dön</a><button className="outline-button" onClick={() => void logout()}>Çıkış yap ve yeniden giriş yap</button></section></main>;

  return <main className="account-security-page">
    <section className="account-security-card">
      {panelOpen && !recoveryCodes.length && <a className="security-back" href={target}><ArrowLeft size={18} /> Panele dön</a>}
      <div className="security-title"><ShieldCheck size={30} /><span><small>HESAP GÜVENLİĞİ</small><h1>İki aşamalı doğrulama</h1></span></div>

      {!status && !error && <p className="security-muted">Hesap güvenliği kontrol ediliyor…</p>}

      {status && !status.keyConfigured && !status.enabled && <div className="security-note">Sunucuda MFA anahtarı henüz tanımlı değil; kurulum şimdilik yapılamaz. Yönetici erişimi için sunucu ayarının düzeltilmesi gerekir. Yöneticiniz anahtarı tanımladığında bu ekrandan kurabilirsiniz.</div>}

      {status && status.deferred && !status.enabled && <div className="security-note">Kurulumu ertelediniz. <b>{formatDate(status.deferredUntil)}</b> tarihine kadar panel açık; sonrasında giriş için kurulum gerekir.</div>}

      {showSetup && !secret && !recoveryCodes.length && <>
        <p>{status!.required ? "Bu sunucuda firma sahibi ve yöneticiler için iki aşamalı doğrulama gereklidir." : "İsteğe bağlı ek koruma; özellikle firma sahibi ve yöneticiler için önerilir."} Kurulum bir kez yapılır, yaklaşık 1 dakika sürer. Sonrasında girişte parolanıza ek olarak telefonunuzdaki doğrulama uygulamasının kodu istenir.</p>
        {!status!.passwordConfirmed && <label className="security-field"><span>Teksanor parolanız <b aria-hidden="true">*</b></span>
          <input required aria-required="true" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && password) void start(password); }} />
          <button type="button" className="link-button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Parolayı gizle" : "Parolayı göster"}</button>
          <small>ChatGPT veya e-posta parolanızı değil, Teksanor girişinde kullandığınız parolayı yazın.</small></label>}
        <div className="security-actions">
          <button className="panel-primary" onClick={() => void start(password)} disabled={loading || (!password && !status!.passwordConfirmed)}><KeyRound size={18} /> {loading ? "Hazırlanıyor..." : "İki aşamalı doğrulamayı kur"}</button>
          {status!.canDefer && <button type="button" className="outline-button" onClick={() => void defer()} disabled={loading}>Şimdi değil, 14 gün sonra hatırlat</button>}
        </div>
      </>}

      {secret && <div className="mfa-setup">
        <ol><li>Telefonunuzda Microsoft Authenticator, Google Authenticator veya uyumlu bir uygulama açın.</li><li>Yeni hesap ekleyip QR kodu tarayın (veya anahtarı elle girin).</li><li>Uygulamadaki 6 haneli kodu aşağıya yazın.</li></ol>
        <div className="mfa-qr">{qr ? <img src={qr} width={240} height={240} alt="Doğrulama uygulamasına eklenecek hesap QR kodu" /> : <span>QR hazırlanıyor…</span>}</div>
        <details className="mfa-manual"><summary>QR okutamıyorum</summary>
          <div className="mfa-secret"><code>{secret}</code><button type="button" onClick={() => void navigator.clipboard.writeText(secret)} aria-label="Anahtarı kopyala"><Copy size={17} /></button></div>
          <a className="mfa-app-link" href={otpAuthUri}>Bu telefondaki doğrulama uygulamasında aç</a>
        </details>
        <label className="security-field"><span>6 haneli kod <b aria-hidden="true">*</b></span><input required aria-required="true" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(event) => { if (event.key === "Enter" && code.length === 6) void verify(); }} /></label>
        <div className="security-actions">
          <button className="panel-primary" onClick={() => void verify()} disabled={loading || code.length !== 6}>{loading ? "Doğrulanıyor..." : "Etkinleştir"}</button>
          <button className="outline-button" type="button" onClick={() => void start()} disabled={loading}><RefreshCw size={16} /> Yeni anahtar üret</button>
        </div>
      </div>}

      {recoveryCodes.length > 0 && <div className="recovery-box">
        <h2>Kurtarma kodlarınız</h2>
        <p>Telefonunuzu kaybederseniz 6 haneli kod yerine bunlardan birini yazarsınız. Her kod bir kez çalışır. <b>Bu kodlar bir daha gösterilmez</b>; indirin veya güvenli bir yere kopyalayın.</p>
        <ol className="recovery-list">{recoveryCodes.map((item) => <li key={item}><code>{item}</code></li>)}</ol>
        <div className="security-actions">
          <button type="button" className="outline-button" onClick={downloadCodes}><Download size={16} /> İndir (.txt)</button>
          <button type="button" className="outline-button" onClick={() => void navigator.clipboard.writeText(recoveryCodes.join("\n"))}><Copy size={16} /> Kopyala</button>
          <button type="button" className="panel-primary" onClick={() => location.replace(target)}>Kaydettim, panele geç</button>
        </div>
      </div>}

      {status?.enabled && !recoveryCodes.length && <>
        <div className="security-success"><CheckCircle2 /> İki aşamalı doğrulama etkin. Kalan kurtarma kodu: <b>{status.recoveryLeft}</b></div>
        <details className="mfa-manual"><summary>Yeni kurtarma kodları üret</summary>
          <p className="security-muted">Eski kodların tamamı geçersiz olur.</p>
          <label className="security-field"><span>Teksanor parolanız <b aria-hidden="true">*</b></span><input required aria-required="true" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button type="button" className="panel-primary" onClick={() => void regenerate()} disabled={loading || !password}>{loading ? "Üretiliyor..." : "Yeni kodları üret"}</button>
        </details>
        {!status.required && <details className="mfa-manual"><summary>İki aşamalı doğrulamayı kapat</summary>
          <p className="security-muted">Önerilmez. Kapatınca girişte yalnız parola istenir ve tüm açık oturumlarınız kapanır.</p>
          <label className="security-field"><span>Teksanor parolanız <b aria-hidden="true">*</b></span><input required aria-required="true" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <label className="security-field"><span>6 haneli kod veya kurtarma kodu <b aria-hidden="true">*</b></span><input required aria-required="true" autoComplete="one-time-code" maxLength={9} value={disableCode} onChange={(event) => setDisableCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 9))} /></label>
          <button type="button" className="outline-button" onClick={() => void disable()} disabled={loading || !password || disableCode.length < 6}>{loading ? "Kapatılıyor..." : "Kapat"}</button>
        </details>}
      </>}

      {message && !recoveryCodes.length && <div className="security-success"><CheckCircle2 /> {message}</div>}
      {error && <div className="form-error" role="alert">{error}</div>}

      {status && !panelOpen && <button type="button" className="link-button security-logout" onClick={() => void logout()}><LogOut size={15} /> Çıkış yap</button>}

      <p className="security-muted">Kodlar e-posta veya SMS ile gelmez. Telefonun tarih ve saati otomatik olmalıdır. Teksanor sizden anahtarı veya anlık kodu asla istemez.</p>
    </section>
  </main>;
}
