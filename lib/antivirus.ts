// Basit içerik tarama (yerel geliştirme). Gerçek dağıtımda harici bir
// tarama servisi (ör. ClamAV) ile değiştirilmelidir.

const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

export async function scanMalware(buffer: ArrayBuffer, _contentType: string): Promise<string> {
  const bytes = new Uint8Array(buffer);
  // EICAR test imzası kontrolü (ilk 512 bayt yeterli).
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 512));
  if (head.includes(EICAR)) {
    throw new Error("Dosyada zararlı yazılım imzası tespit edildi.");
  }
  // Yürütülebilir başlıkları reddet (PE 'MZ', ELF 0x7F 'ELF').
  if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) {
    throw new Error("Yürütülebilir dosyalara izin verilmez.");
  }
  if (bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) {
    throw new Error("Yürütülebilir dosyalara izin verilmez.");
  }
  return "clean";
}
