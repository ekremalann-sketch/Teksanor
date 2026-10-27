// Gizlilik kuralı: dış yapay zekâya kullanıcının yazdığı serbest metin, kişi adı veya geçmiş sohbet GÖNDERİLMEZ.
// Soru sunucuda bir konu başlığına çevrilir; dışarı yalnız bu başlık ve yetkili sayısal özet gider.
const TOPICS: [RegExp, string][] = [
  [/(borç|ödeme|tahsil|nakit|finans|gider|kasa|banka|fatura)/i, "Finans ve ödemeler"],
  [/(bakım|ekipman|varlık|cihaz|makine|arıza)/i, "Bakım ve ekipman"],
  [/(servis|iş emri|saha|teknisyen|ziyaret|müşteri onay)/i, "Servis ve saha işleri"],
  [/(görev|proje|termin|gecik)/i, "Görevler ve projeler"],
  [/(personel|çalışan|izin|\bik\b|insan kaynak)/i, "Çalışanlar"],
];
export function topicOf(message: string) {
  // Soru birden çok konuya değiyorsa hepsi (en fazla üç) birlikte iletilir; yine yalnız başlıklar gider.
  const topics = TOPICS.filter(([pattern]) => pattern.test(message)).map(([, label]) => label).slice(0, 3);
  return topics.length ? topics.join(", ") : "Genel operasyon özeti";
}

// Gizlilik kuralı: saha notu (serbest metin) hiçbir zaman dış yapay zekâ servisine gönderilmez.
// Not sunucuda düzenli bir servis raporu taslağına çevrilir; içerik değiştirilmez, yeni bilgi eklenmez.
export function draftFromNote(note:string){
 const lines=note.split(/\r?\n|(?<=[.;!?])\s+/).map(s=>s.replace(/^[-•*\d.)\s]+/,"").trim()).filter(Boolean);
 const cap=(s:string)=>s.charAt(0).toLocaleUpperCase("tr-TR")+s.slice(1);
 return ["Servis raporu taslağı","",...lines.map(l=>`• ${cap(l)}${/[.!?]$/.test(l)?"":"."}`),"","Not: Bu taslak saha notundan hazırlanmıştır; kaydetmeden önce kontrol edin."].join("\n");
}
