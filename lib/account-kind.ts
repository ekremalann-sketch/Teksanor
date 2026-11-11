// T1: Teksanor firma ürünüdür. Kişisel (hane bütçesi) hesabı yalnız ayrı bayrakla açılabilir.
export function accountKindFor(requested: unknown, householdEnabled: string | undefined): "business" | "personal" {
  return requested === "personal" && householdEnabled === "true" ? "personal" : "business";
}
