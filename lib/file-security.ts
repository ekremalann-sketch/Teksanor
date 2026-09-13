// Yüklenen dosyanın türü ile içeriğinin (magic bytes) tutarlılığını denetler.

type Inspection = { scanMode: string };

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, i) => bytes[i] === byte);
}

export function inspectUpload(fileName: string, contentType: string, buffer: ArrayBuffer): Inspection {
  const bytes = new Uint8Array(buffer);
  if (bytes.length === 0) throw new Error("Boş dosya yüklenemez.");

  const ext = (fileName.split(".").pop() || "").toLowerCase();

  const checks: Record<string, () => boolean> = {
    "image/png": () => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]),
    "image/jpeg": () => startsWith(bytes, [0xff, 0xd8, 0xff]),
    "image/webp": () => startsWith(bytes, [0x52, 0x49, 0x46, 0x46]),
    "application/pdf": () => startsWith(bytes, [0x25, 0x50, 0x44, 0x46]),
    "text/csv": () => true,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": () => startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]),
  };

  const check = checks[contentType];
  if (!check) throw new Error("Bu dosya türüne izin verilmiyor.");
  if (!check()) throw new Error("Dosya içeriği belirtilen türle uyuşmuyor.");

  // Uzantı-tip tutarlılığı (temel).
  const extMap: Record<string, string[]> = {
    png: ["image/png"], jpg: ["image/jpeg"], jpeg: ["image/jpeg"], webp: ["image/webp"],
    pdf: ["application/pdf"], csv: ["text/csv"],
    xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  };
  if (extMap[ext] && !extMap[ext].includes(contentType)) {
    throw new Error("Dosya uzantısı ile türü uyuşmuyor.");
  }

  return { scanMode: "signature+content" };
}
