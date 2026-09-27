// Saha kontrol listesi (servis formu) şablonları ve cevap doğrulaması.
// Şablon işe eklendiğinde maddeleri kopyalanır: şablon sonradan değişse de
// o işin geçmiş formu değişmez (denetlenebilirlik).

export type ChecklistItemType = "check" | "text" | "number" | "choice";
export type ChecklistItem = { id: string; label: string; type: ChecklistItemType; required: boolean; options?: string[]; unit?: string };
export type ChecklistAnswers = Record<string, boolean | string | number | null>;

export class ChecklistError extends Error {}

const MAX_ITEMS = 40;
const TYPES: ChecklistItemType[] = ["check", "text", "number", "choice"];
const clean = (v: unknown, max: number) => String(v ?? "").normalize("NFC").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);

export function parseTemplateItems(input: unknown): ChecklistItem[] {
  if (!Array.isArray(input) || input.length === 0) throw new ChecklistError("Şablonda en az bir madde olmalı.");
  if (input.length > MAX_ITEMS) throw new ChecklistError(`Bir şablonda en fazla ${MAX_ITEMS} madde olabilir.`);
  const seen = new Set<string>();
  return input.map((raw, index) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const label = clean(item.label, 200);
    if (label.length < 2) throw new ChecklistError(`${index + 1}. madde için açıklama yazın.`);
    const type = TYPES.includes(item.type as ChecklistItemType) ? item.type as ChecklistItemType : "check";
    let id = clean(item.id, 40).replace(/[^a-z0-9_-]/gi, "") || `m${index + 1}`;
    while (seen.has(id)) id = `${id}_${index + 1}`;
    seen.add(id);
    const result: ChecklistItem = { id, label, type, required: item.required !== false };
    if (type === "choice") {
      const options = Array.isArray(item.options) ? [...new Set(item.options.map((o) => clean(o, 60)).filter(Boolean))].slice(0, 10) : [];
      if (options.length < 2) throw new ChecklistError(`"${label}" için en az iki seçenek girin.`);
      result.options = options;
    }
    if (type === "number") { const unit = clean(item.unit, 16); if (unit) result.unit = unit; }
    return result;
  });
}

/** Cevapları şablona göre temizler; tanımsız madde ve yanlış türdeki değer reddedilir. */
export function parseAnswers(items: ChecklistItem[], input: unknown): ChecklistAnswers {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new ChecklistError("Form cevapları okunamadı.");
  const raw = input as Record<string, unknown>;
  const out: ChecklistAnswers = {};
  for (const key of Object.keys(raw)) if (!items.some((i) => i.id === key)) throw new ChecklistError("Formda olmayan bir madde gönderildi.");
  for (const item of items) {
    const value = raw[item.id];
    if (value === undefined || value === null || value === "") { out[item.id] = null; continue; }
    if (item.type === "check") {
      if (typeof value !== "boolean") throw new ChecklistError(`"${item.label}" evet/hayır olmalı.`);
      out[item.id] = value;
    } else if (item.type === "number") {
      const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
      if (!Number.isFinite(n) || Math.abs(n) > 1e9) throw new ChecklistError(`"${item.label}" geçerli bir sayı olmalı.`);
      out[item.id] = n;
    } else if (item.type === "choice") {
      if (typeof value !== "string" || !item.options?.includes(value)) throw new ChecklistError(`"${item.label}" için listedeki seçeneklerden birini seçin.`);
      out[item.id] = value;
    } else {
      out[item.id] = clean(value, 500) || null;
    }
  }
  return out;
}

/** Zorunlu maddeler: onay kutusu işaretli (true), diğerleri dolu olmalı. */
export function missingRequired(items: ChecklistItem[], answers: ChecklistAnswers) {
  return items.filter((item) => item.required && (item.type === "check" ? answers[item.id] !== true : answers[item.id] === null || answers[item.id] === undefined)).map((item) => item.label);
}

/** Yeni firmalara önerilen başlangıç şablonları (sektörde yaygın). */
export const STARTER_TEMPLATES: { name: string; items: Omit<ChecklistItem, "id">[] }[] = [
  { name: "Klima periyodik bakım", items: [
    { label: "Filtreler temizlendi / değiştirildi", type: "check", required: true },
    { label: "Drenaj hattı kontrol edildi", type: "check", required: true },
    { label: "Soğutucu gaz basıncı", type: "number", required: true, unit: "bar" },
    { label: "Üfleme sıcaklığı", type: "number", required: false, unit: "°C" },
    { label: "Cihaz genel durumu", type: "choice", required: true, options: ["İyi", "Bakım gerekli", "Arızalı"] },
    { label: "Müşteriye not", type: "text", required: false },
  ] },
  { name: "Jeneratör yük testi", items: [
    { label: "Yağ ve soğutma suyu seviyesi kontrol edildi", type: "check", required: true },
    { label: "Akü voltajı", type: "number", required: true, unit: "V" },
    { label: "Yük altında çalışma süresi", type: "number", required: true, unit: "dk" },
    { label: "Otomatik devreye girme testi", type: "choice", required: true, options: ["Başarılı", "Başarısız"] },
    { label: "İş güvenliği: alan güvenliğe alındı", type: "check", required: true },
  ] },
  { name: "Genel iş güvenliği (İSG)", items: [
    { label: "Kişisel koruyucu donanım kullanıldı", type: "check", required: true },
    { label: "Enerji kesildi / kilitleme-etiketleme yapıldı", type: "check", required: true },
    { label: "Çalışma alanı temiz teslim edildi", type: "check", required: true },
  ] },
];
