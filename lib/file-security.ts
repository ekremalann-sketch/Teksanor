const signatures: Array<{ mime: string; test: (bytes: Uint8Array) => boolean }> = [
  { mime: "application/pdf", test: (b) => String.fromCharCode(...b.slice(0, 5)) === "%PDF-" },
  { mime: "image/png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/webp", test: (b) => String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP" },
  { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", test: (b) => b[0] === 0x50 && b[1] === 0x4b },
];

const dangerousText = /<script\b|javascript:|powershell|cmd\.exe|wscript|eval\s*\(|document\.cookie/i;

export function inspectUpload(fileName: string, declaredMime: string, buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  if (!bytes.length) throw new Error("Boş dosya yüklenemez.");
  if (/\.(exe|dll|bat|cmd|ps1|js|mjs|vbs|scr|com|jar|html?|svg)$/i.test(fileName)) {
    throw new Error("Çalıştırılabilir veya aktif içerikli dosyalara izin verilmez.");
  }
  const extensions:Record<string,RegExp>={"application/pdf":/\.pdf$/i,"image/png":/\.png$/i,"image/jpeg":/\.jpe?g$/i,"image/webp":/\.webp$/i,"text/csv":/\.csv$/i,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":/\.xlsx$/i};
  if(!extensions[declaredMime]?.test(fileName))throw new Error("Dosya uzantısı bildirilen tür ile eşleşmiyor.");
  const signature = signatures.find((item) => item.mime === declaredMime);
  if (signature && !signature.test(bytes)) throw new Error("Dosyanın içeriği uzantısı veya türüyle eşleşmiyor.");
  if (declaredMime === "text/csv") {
    const sample = new TextDecoder().decode(bytes.slice(0, 64_000));
    if (dangerousText.test(sample)) throw new Error("Dosyada güvenli olmayan aktif içerik bulundu.");
  }
  return { safe: true, scanMode: "signature-and-content-policy" } as const;
}
