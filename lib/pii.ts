export function maskPII(text:string) {
 return text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,"[EPOSTA_MASKELI]")
 .replace(/\b[1-9]\d{10}\b/g,"[KIMLIK_MASKELI]")
 .replace(/(?:\+?90[ .-]?)?0?5\d{2}[ .-]?\d{3}[ .-]?\d{2}[ .-]?\d{2}/g,"[TELEFON_MASKELI]")
 .replace(/\bTR[ ]?\d{2}(?:[ ]?\d){22}\b/gi,"[IBAN_MASKELI]");
}
