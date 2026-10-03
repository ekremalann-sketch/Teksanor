/** Calendar dates only: normalize Turkish input without accepting JS date rollover. */
export function optionalCalendarDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error("Tarih GG.AA.YYYY veya YYYY-AA-GG olmalıdır.");
  const text = value.trim();
  if (!text) return null;
  const tr = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text);
  const iso = tr ? `${tr[3]}-${tr[2]}-${tr[1]}` : text;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error("Tarih GG.AA.YYYY veya YYYY-AA-GG olmalıdır.");
  const date = new Date(iso + "T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) throw new Error("Geçerli bir takvim tarihi girin.");
  return iso;
}
