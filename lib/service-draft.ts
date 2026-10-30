// Scoped, expiring local notes. Never upload automatically or restore onto a changed report.
export const draftPrefix = "teksanor-draft:";
export function draftKey(user: string, organization: string, job: string) {
  return draftPrefix + [user, organization, job].map(encodeURIComponent).join(":");
}
export function readDraft(storage: Storage, key: string, version: number, now = Date.now()): string | null {
  try {
    const raw = storage.getItem(key); if (!raw) return null;
    let data;
    try { data = JSON.parse(raw); } catch { storage.setItem(key+":previous",raw); return null; }
    if (data.version !== version) { storage.setItem(key+":previous",raw); return null; }
    if (!Number.isFinite(data.at) || now - data.at > 86400000 || data.at > now || typeof data.note !== "string" || data.note.length > 6000) {
      storage.removeItem(key); return null;
    }
    return data.note;
  } catch { return null; }
}
export function previousDraft(storage: Storage, key: string): string {
  try { const raw=storage.getItem(key+":previous"); if(!raw)return "";try {const parsed=JSON.parse(raw);return String(parsed.note??parsed.text??"").slice(0,6000);}catch{return raw.slice(0,6000);} }catch{return "";}
}
export function writeDraft(storage: Storage, key: string, note: string, version: number, now = Date.now()) {
  storage.setItem(key, JSON.stringify({note:note.slice(0,6000),version,at:now}));
}
export function clearDrafts(storage: Storage) {
  for (let i=storage.length-1;i>=0;i--) { const key=storage.key(i); if(key?.startsWith(draftPrefix)) storage.removeItem(key); }
}
