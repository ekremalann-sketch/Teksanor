// Müşteri takip bağlantısı: üyeliksiz, yalnız tahmin edilemez kodla açılır. Kodun yalnız özeti saklanır;
// yeni bağlantı üretmek eskisini geçersiz kılar. Müşteriye iç maliyet ve personel adı gösterilmez.
export const serviceTrackingSchema=`CREATE TABLE IF NOT EXISTS service_tracking (
 job_id TEXT PRIMARY KEY REFERENCES service_jobs(id), organization_id TEXT NOT NULL,
 code_hash TEXT NOT NULL UNIQUE, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;
export const CUSTOMER_STAGE_LABELS:Record<string,string>={
 requested:"Talebiniz alındı",quoted:"Teklifiniz hazır, onayınız bekleniyor",quote_approved:"Teklif onaylandı, iş planlanıyor",
 in_progress:"Teknisyen çalışıyor",completed:"İş tamamlandı, onayınız bekleniyor",accepted:"İş teslim edildi",
 collected:"İş kapandı, ödeme tamamlandı",cancelled:"İş iptal edildi",
};
/** 32 karakterlik URL güvenli rastgele kod (192 bit). */
export function newTrackingCode(){const b=crypto.getRandomValues(new Uint8Array(24));return btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_");}
export const validTrackingCode=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9_-]{32}$/.test(v);
/** Değişkenli mesaj şablonu: {müşteri} {iş} {durum} {link} {kalan} */
export function fillTemplate(template:string,values:Record<string,string>){return template.replace(/\{(müşteri|iş|durum|link|kalan)\}/g,(_,k:string)=>values[k]??"");}
export const DEFAULT_TRACKING_TEMPLATE="Merhaba {müşteri}, {iş} servis kaydınızın durumu: {durum}. Güncel durumu buradan takip edebilirsiniz: {link}";
