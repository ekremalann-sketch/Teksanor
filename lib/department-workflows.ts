import type { ModuleId } from "./access";
export const UNITS: { id:string; name:string; module:ModuleId; processes:Record<string,string[]> }[] = [
 {id:"hr",name:"İnsan kaynakları",module:"hr",processes:{"İşe giriş":["Başvuru","Belge kontrolü","Yönetici onayı","İşe uyum","Tamamlandı"],"İzin":["Talep","Plan kontrolü","Yönetici onayı","İzin kaydı","Tamamlandı"],"Vardiya":["Plan","Uygunluk kontrolü","Yönetici onayı","Uygulama","Tamamlandı"],"Eğitim":["İhtiyaç","Plan","Yönetici onayı","Katılım ve sonuç","Tamamlandı"],"İşten ayrılış":["Bildirim","Devir ve kontrol","Yönetici onayı","Erişim kapatma teyidi","Tamamlandı"]}},
 {id:"rd",name:"Ar-Ge ve inovasyon",module:"projects",processes:{"Ar-Ge projesi":["Fikir ve başarı ölçütü","Değerlendirme","Bütçe onayı","Deney ve prototip","Sonuç onayı","Tamamlandı"],"Deney":["Hipotez","Deney planı","Yönetici onayı","Kanıt ve sonuç","Tamamlandı"]}},
 {id:"management",name:"Yönetim ve strateji",module:"projects",processes:{"Yönetim kararı":["Gündem","Etki değerlendirmesi","Yönetici onayı","Uygulama takibi","Tamamlandı"]}},
 {id:"finance",name:"Finans ve hazine",module:"payments",processes:{"Ödeme kontrolü":["Talep","Belge kontrolü","Yönetici onayı","Ödeme teyidi","Mutabakat","Tamamlandı"]}},
 {id:"accounting",name:"Muhasebe koordinasyonu",module:"expenses",processes:{"Dönem dosyası":["Belge toplama","Eksik kontrolü","Yönetici onayı","Muhasebeye teslim","Tamamlandı"]}},
 {id:"engineering",name:"Proje ve mühendislik",module:"projects",processes:{"Mühendislik işi":["Kapsam","Teknik plan","Yönetici onayı","Uygulama","Teslim onayı","Tamamlandı"]}},
 {id:"operations",name:"Operasyon ve saha",module:"work-orders",processes:{"Saha işi":["Talep","Görevlendirme","Yönetici onayı","Saha raporu","Teslim onayı","Tamamlandı"]}},
 {id:"procurement",name:"Satın alma ve tedarik",module:"procurement",processes:{"Tedarik":["İhtiyaç","Teklif karşılaştırma","Bütçe onayı","Sipariş teyidi","Teslim kontrolü","Tamamlandı"]}},
 {id:"sales",name:"Satış ve iş geliştirme",module:"crm",processes:{"Satış fırsatı":["İhtiyaç","Teklif","Yönetici onayı","Müşteri kararı","Tamamlandı"]}},
 {id:"support",name:"Müşteri deneyimi ve destek",module:"crm",processes:{"Destek talebi":["Talep","İnceleme","Çözüm","Müşteri teyidi","Tamamlandı"]}},
 {id:"it",name:"Bilgi teknolojileri",module:"assets",processes:{"Erişim veya cihaz":["Talep","Risk kontrolü","Yönetici onayı","Uygulama ve teyit","Tamamlandı"]}},
 {id:"legal",name:"Hukuk ve uyum",module:"risks",processes:{"Sözleşme kontrolü":["Kayıt","İnceleme","Yönetici onayı","Yükümlülük takibi","Tamamlandı"]}},
 {id:"quality",name:"Kalite ve risk",module:"risks",processes:{"Düzeltici faaliyet":["Uygunsuzluk","Önlem planı","Yönetici onayı","Kanıt kontrolü","Tamamlandı"]}},
];
export const WORKFLOW_PREFIX = "UNIT-WORKFLOW:";
export type UnitRecord = {unit:string;process:string;stage:number;note:string;approver:string;history:{at:string;actor:string;action:string;note:string}[]};
export function readUnitRecord(description:unknown):UnitRecord|null {try {if(typeof description!=="string"||!description.startsWith(WORKFLOW_PREFIX))return null;return JSON.parse(description.slice(WORKFLOW_PREFIX.length));}catch{return null;}}
export function advanceUnitRecord(record:UnitRecord,action:string,actor:string,manager:boolean,note:string):UnitRecord {
 const unit=UNITS.find(u=>u.id===record.unit);const stages=unit?.processes[record.process];if(!stages||record.stage>=stages.length-1)throw new Error("Tamamlanmış süreç değiştirilemez.");
 const approval=stages[record.stage].includes("onayı");
 if(approval){if(action!=="approve"&&action!=="reject")throw new Error("Bu aşamada onay kararı gerekir.");if(!manager||actor!==record.approver)throw new Error("Karar yalnız atanmış firma yöneticisi tarafından verilebilir.");}
 else if(action!=="advance")throw new Error("Geçersiz süreç işlemi.");
 if(!note.trim())throw new Error("İşlem açıklaması veya sonuç kanıtı yazın.");
 return {...record,stage:action==="reject"?0:record.stage+1,note,history:[...record.history,{at:new Date().toISOString(),actor,action,note}]};
}
