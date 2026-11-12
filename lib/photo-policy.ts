// T9: Saha fotoğrafı için ücretsiz güvenli yol. Tarama hizmeti (karar-sözleşme) bağlı değilken yalnız şu kabul edilir:
// telefonda tarayıcının canvas ile YENİDEN KODLADIĞI WebP (EXIF/konum ve gömülü içerik silinir), en çok 3 MB ve 4096 px.
// Sunucu dosyanın gerçekten tek parça RIFF/WEBP olduğunu ve boyutların sınır içinde olduğunu bayt düzeyinde doğrular.
export const PHOTO_MAX_BYTES = 3 * 1024 * 1024;
export const PHOTO_MAX_SIDE = 4096;

function u32le(b: Uint8Array, o: number) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
function u24le(b: Uint8Array, o: number) { return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16); }

/** WebP başlığından genişlik/yükseklik; geçersizse null. */
export function webpSize(buffer: ArrayBuffer): { width: number; height: number } | null {
  const b = new Uint8Array(buffer);
  if (b.length < 30) return null;
  const ascii = (o: number, n: number) => String.fromCharCode(...b.slice(o, o + n));
  if (ascii(0, 4) !== "RIFF" || ascii(8, 4) !== "WEBP") return null;
  if (u32le(b, 4) + 8 !== b.length) return null; // RIFF boyutu dosyayla birebir; sonda ek veri yok
  const chunk = ascii(12, 4);
  if (chunk === "VP8 ") {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (b[20] !== 0x2f) return null;
    const bits = u32le(b, 21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  return null;
}

export function acceptPhoto(type: string, size: number, buffer: ArrayBuffer): { ok: true } | { ok: false; error: string } {
  if (type !== "image/webp") return { ok: false, error: "Saha fotoğrafı telefonda küçültülüp WebP olarak gönderilmeli." };
  if (size > PHOTO_MAX_BYTES) return { ok: false, error: "Fotoğraf 3 MB'tan büyük olamaz." };
  const dim = webpSize(buffer);
  if (!dim || !dim.width || !dim.height) return { ok: false, error: "Fotoğraf geçerli bir WebP değil." };
  if (dim.width > PHOTO_MAX_SIDE || dim.height > PHOTO_MAX_SIDE) return { ok: false, error: "Fotoğraf boyutu çok büyük." };
  return { ok: true };
}
