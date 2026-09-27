// Müşteri imzası: tarayıcıdan gelen çizgiler sunucuda doğrulanır ve yalnızca
// "M x y L x y …" biçiminde tamsayı koordinatlı bir SVG yolu olarak saklanır.
// Serbest metin, veri URL'si veya SVG işaretlemesi kabul edilmez; bu nedenle
// saklanan değer sayfaya basıldığında betik veya dış kaynak içeremez.
// Dosya depolama (R2) gerekmez; tipik imza 1–6 KB tutar.

export const SIGNATURE_WIDTH = 600;
export const SIGNATURE_HEIGHT = 200;
const MAX_STROKES = 60;
const MAX_POINTS = 3000;
const MAX_LENGTH = 24000;
const PATH_PATTERN = /^(M\d{1,3} \d{1,3}( L\d{1,3} \d{1,3})*)( M\d{1,3} \d{1,3}( L\d{1,3} \d{1,3})*)*$/;

export class SignatureError extends Error {}

/** strokes: [[x1,y1,x2,y2,…], …] (600×200 tuvali). Boş dizi → null (imza yok). */
export function signaturePath(strokes: unknown): string | null {
  if (strokes === undefined || strokes === null) return null;
  if (!Array.isArray(strokes)) throw new SignatureError("İmza verisi okunamadı.");
  if (strokes.length === 0) return null;
  if (strokes.length > MAX_STROKES) throw new SignatureError("İmza çok karmaşık; temizleyip yeniden deneyin.");
  let points = 0;
  const parts: string[] = [];
  for (const stroke of strokes) {
    if (!Array.isArray(stroke) || stroke.length < 2 || stroke.length % 2 !== 0) throw new SignatureError("İmza verisi okunamadı.");
    const coords: string[] = [];
    for (let i = 0; i < stroke.length; i += 2) {
      const x = stroke[i], y = stroke[i + 1];
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x > SIGNATURE_WIDTH || y > SIGNATURE_HEIGHT) {
        throw new SignatureError("İmza verisi okunamadı.");
      }
      coords.push(`${i === 0 ? "M" : "L"}${x} ${y}`);
      points++;
    }
    // Tek noktalı dokunuşu görünür kısa bir çizgiye çevir.
    if (coords.length === 1) coords.push(`L${Math.min(SIGNATURE_WIDTH, stroke[0] + 1)} ${stroke[1]}`);
    parts.push(coords.join(" "));
  }
  if (points > MAX_POINTS) throw new SignatureError("İmza çok karmaşık; temizleyip yeniden deneyin.");
  if (points < 4) throw new SignatureError("İmza çok kısa; lütfen imzanızı çizin.");
  const path = parts.join(" ");
  if (path.length > MAX_LENGTH) throw new SignatureError("İmza çok karmaşık; temizleyip yeniden deneyin.");
  return path;
}

/** Veri tabanından okunan yolun yine güvenli biçimde olduğunu doğrular (savunma katmanı). */
export function isSafeSignaturePath(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_LENGTH && PATH_PATTERN.test(value);
}
