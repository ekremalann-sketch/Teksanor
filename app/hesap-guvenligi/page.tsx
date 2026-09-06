"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";

export default function AccountSecurityPage() {
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [otpAuthUri, setOtpAuthUri] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/auth/mfa/setup", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action:"start",password}) });
      const data = await response.json() as { secret?: string; otpAuthUri?: string; error?: string };
      if (!response.ok || !data.secret || !data.otpAuthUri) throw new Error(data.error || "Kurulum başlatılamadı.");
      setSecret(data.secret); setOtpAuthUri(data.otpAuthUri);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kurulum başlatılamadı.");
    } finally { setLoading(false); }
  }

  async function verify() {
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/auth/mfa/setup", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Kod doğrulanamadı.");
      setMessage("İki aşamalı doğrulama etkinleştirildi. Yönetim paneline aktarılıyorsunuz.");
      setSecret(""); setOtpAuthUri(""); setCode("");
      window.setTimeout(() => { window.location.href = "/panel"; }, 650);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kod doğrulanamadı.");
    } finally { setLoading(false); }
  }

  return <main className="account-security-page">
    <section className="account-security-card">
      <Link href="/panel"><ArrowLeft size={18} /> Panele dön</Link>
      <div className="security-title"><ShieldCheck size={30} /><span><small>HESAP GÜVENLİĞİ</small><h1>İki aşamalı doğrulama</h1></span></div>
      <p>Bu özellik isteğe bağlıdır. Etkinleştirdiğinizde giriş sırasında parolanıza ek olarak telefonunuzdaki doğrulama uygulamasının ürettiği tek kullanımlık kod istenir.</p>
      {!secret && <label><span>Mevcut parolanız</span><input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} /></label>}
      {!secret && !message && <button className="panel-primary" onClick={start} disabled={loading}><KeyRound size={18} /> {loading ? "Hazırlanıyor..." : "İki aşamalı doğrulamayı kur"}</button>}
      {secret && <div className="mfa-setup">
        <ol><li>Telefonunuzda Microsoft Authenticator, Google Authenticator veya uyumlu bir uygulama açın.</li><li>Yeni hesap ekleyip aşağıdaki kurulum anahtarını girin.</li><li>Uygulamada oluşan 6 haneli kodu doğrulayın.</li></ol>
        <label><span>Kurulum anahtarı</span><div><code>{secret}</code><button type="button" onClick={() => void navigator.clipboard.writeText(secret)} aria-label="Anahtarı kopyala"><Copy size={17} /></button></div></label>
        <button className="mfa-rotate-button" type="button" onClick={start} disabled={loading}><RefreshCw size={16} /> Yeni güvenli anahtar üret</button>
        <a className="mfa-app-link" href={otpAuthUri}>Telefondaki doğrulama uygulamasında aç</a>
        <label><span>6 haneli kod</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label>
        <button className="panel-primary" onClick={verify} disabled={loading || code.length !== 6}>{loading ? "Doğrulanıyor..." : "Etkinleştir"}</button>
      </div>}
      {message && <div className="security-success"><CheckCircle2 /> {message}</div>}
      {error && <div className="form-error">{error}</div>}
      <p><Link href="/hesap-kurtarma?mode=verify">E-posta adresini doğrula</Link></p>
      <div className="security-boundary"><b>İsteğe bağlı güvenlik</b><span>Şimdi kurmak istemiyorsanız panele dönebilirsiniz. Kuruluma başlarsanız anahtarı parola gibi koruyun; Teksanor bu anahtarı veya anlık doğrulama kodunuzu sizden istemez.</span></div>
    </section>
  </main>;
}
