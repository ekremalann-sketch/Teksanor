// Gün sonu kasa: tahsilat hareketleri (service_payments) ve servis giderleri tarih aralığında özetlenir.
export const serviceExpenseSchema=`CREATE TABLE IF NOT EXISTS service_expenses (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, spent_on TEXT NOT NULL, description TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents > 0), method TEXT NOT NULL CHECK(method IN ('nakit','havale','kart','diger')),
 request_id TEXT NOT NULL, actor_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(organization_id, request_id)
)`;
export type CashRange={from:string;to:string};
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const valid=(d:string)=>DAY.test(d)&&new Date(d+"T00:00:00Z").toISOString().slice(0,10)===d;
/** gün | hafta | ay | özel aralık (en fazla 366 gün). Bitiş dahildir. */
export function cashRange(period:string|null,from:string|null,to:string|null,today:string):CashRange|null{
 const shift=(d:string,days:number)=>new Date(Date.parse(d+"T00:00:00Z")+days*86400000).toISOString().slice(0,10);
 if(period==="gun"||!period)return {from:today,to:today};
 if(period==="hafta")return {from:shift(today,-6),to:today};
 if(period==="ay")return {from:today.slice(0,8)+"01",to:today};
 if(period==="ozel"&&from&&to&&valid(from)&&valid(to)&&from<=to&&Date.parse(to)-Date.parse(from)<=366*86400000)return {from,to};
 return null;
}
export const csvCell=(v:unknown)=>{const s=String(v??"");const safe=/^[=+\-@\t\r]/.test(s)?"'"+s:s;return /[";\n]/.test(safe)?`"${safe.replace(/"/g,'""')}"`:safe;};
export const METHOD_LABELS:Record<string,string>={nakit:"Nakit",kart:"Kart",havale:"Havale/EFT",diger:"Diğer"};
