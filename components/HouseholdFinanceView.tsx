"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, FileSpreadsheet, RefreshCw, Upload } from "lucide-react";

type SheetData = { headers: string[]; rows: Array<Record<string, unknown>> };
type FinancePayload = { version: 1; period: string; sheets: Record<string, SheetData> };
type SavedWorkbook = { id: string; period: string; source_name: string | null; updated_at: string; payload: FinancePayload };

const requiredSheets = [
  "Kartlar ve KMH", "Ödeme Takvimi", "Ev ve Yaşam Giderleri",
  "Altın Borçları", "Şirket Hareketleri", "Kontrol Edilecekler",
] as const;
const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const amount = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const format = (value: number | null) => value === null ? "Bilgi eksik" : money.format(value);

function find(row: Record<string, unknown>, label: string) {
  return row[label];
}

function sheetRows(sheet: import("exceljs").Worksheet, headerRow: number) {
  const headers: string[] = [];
  sheet.getRow(headerRow).eachCell({ includeEmpty: true }, (cell, column) => { headers[column - 1] = String(cell.text || "").trim(); });
  const rows: Array<Record<string, unknown>> = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    const record: Record<string, unknown> = {};
    let hasValue = false;
    headers.forEach((header, index) => {
      if (!header) return;
      const cell = row.getCell(index + 1);
      const raw = cell.value;
      const value = typeof raw === "object" && raw && "result" in raw ? raw.result : raw;
      const normalized = value instanceof Date ? value.toISOString().slice(0, 10) : value ?? null;
      if (normalized !== null && String(normalized).trim() !== "") hasValue = true;
      record[header] = normalized === "" ? null : normalized;
    });
    if (hasValue) rows.push(record);
  });
  return { headers: headers.filter(Boolean), rows };
}

export default function HouseholdFinanceView({ organizationId, canEdit }: { organizationId: string; canEdit: boolean }) {
  const [workbooks, setWorkbooks] = useState<SavedWorkbook[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const response = await fetch("/api/household-finance", { cache: "no-store", headers: { "X-Organization-Id": organizationId } });
    if (!response.ok) throw new Error((await response.json()).error || "Aile finans verileri alınamadı.");
    const data = await response.json() as { workbooks: SavedWorkbook[] };
    setWorkbooks(data.workbooks);
    setSelectedPeriod((current) => current || data.workbooks[0]?.period || "");
  }

  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Veriler alınamadı.")); }, [organizationId]);

  async function importWorkbook(file: File) {
    setBusy(true); setError(""); setMessage("");
    try {
      if (!file.name.toLocaleLowerCase("tr-TR").endsWith(".xlsx")) throw new Error("Bu bölüm yalnızca hazırlanan .xlsx çalışma kitabını kabul eder.");
      if (file.size > 5 * 1024 * 1024) throw new Error("Dosya 5 MB güvenli aktarım sınırını aşıyor.");
      // @ts-expect-error ExcelJS does not publish declarations for this browser bundle.
      const ExcelModule = await import("exceljs/dist/exceljs.min.js") as any;
      const WorkbookCtor = ExcelModule.Workbook ?? ExcelModule.default?.Workbook;
      const workbook = new WorkbookCtor();
      await workbook.xlsx.load(await file.arrayBuffer());
      const missing = requiredSheets.filter((name) => !workbook.getWorksheet(name));
      if (missing.length) throw new Error(`Eksik sekmeler: ${missing.join(", ")}`);
      const overview = workbook.getWorksheet("Genel Bakış");
      const period = String(overview?.getCell("B2").text || "").trim();
      if (!period) throw new Error("Genel Bakış B2 hücresinde dönem bulunamadı.");
      const sheets = Object.fromEntries(requiredSheets.map((name) => [name, sheetRows(workbook.getWorksheet(name), 5)]));
      const payload: FinancePayload = { version: 1, period, sheets };
      const response = await fetch("/api/household-finance", {
        method: "POST", headers: { "Content-Type": "application/json", "X-Organization-Id": organizationId },
        body: JSON.stringify({ payload, sourceName: file.name }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Çalışma kitabı aktarılamadı.");
      await load(); setSelectedPeriod(period); setMessage(`${period} dönemi Alan Group çalışma alanına güvenli biçimde aktarıldı.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Çalışma kitabı aktarılamadı.");
    } finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  const current = workbooks.find((item) => item.period === selectedPeriod) || workbooks[0];
  const cards = current?.payload.sheets["Kartlar ve KMH"]?.rows ?? [];
  const expenses = current?.payload.sheets["Ev ve Yaşam Giderleri"]?.rows ?? [];
  const gold = current?.payload.sheets["Altın Borçları"]?.rows ?? [];
  const company = current?.payload.sheets["Şirket Hareketleri"]?.rows ?? [];
  const summary = useMemo(() => ({
    cardDebt: cards.reduce((sum, row) => sum + (amount(find(row, "Toplam kart borcu")) ?? 0), 0),
    kmhDebt: cards.reduce((sum, row) => sum + (amount(find(row, "KMH borcu + faiz")) ?? 0), 0),
    monthly: cards.reduce((sum, row) => sum + (amount(find(row, "Aylık ödeme")) ?? 0), 0),
    minimum: cards.reduce((sum, row) => sum + (amount(find(row, "Asgari ödeme")) ?? 0), 0),
    expenses: expenses.reduce((sum, row) => sum + (amount(find(row, "Toplam")) ?? 0), 0),
    incomplete: cards.filter((row) => String(find(row, "Eksik bilgi kontrolü") || "").includes("Bilgi eksik")).length,
  }), [cards, expenses]);

  return <section className="household-finance">
    <div className="finance-workbook-head"><div><FileSpreadsheet size={26} /><span><h2>Kişisel ve aile finansı</h2><p>Kart, KMH, gider, altın ve şirket hareketleri dönem bazında ayrı tutulur.</p></span></div><div className="household-actions">
      {!!workbooks.length && <select value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value)}>{workbooks.map((item) => <option key={item.id}>{item.period}</option>)}</select>}
      {canEdit && <><input ref={inputRef} hidden type="file" accept=".xlsx" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importWorkbook(file); }} /><button className="panel-primary" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? <RefreshCw className="spin" size={17} /> : <Upload size={17} />} Çalışma kitabını aktar</button></>}
    </div></div>
    {error && <div className="alert error"><AlertTriangle size={18} />{error}</div>}{message && <div className="alert success">{message}</div>}
    {!current ? <div className="household-empty"><FileSpreadsheet size={40} /><h3>Henüz aile finans dönemi aktarılmadı</h3><p>Hazırlanan Teksanor finans çalışma kitabını seçerek tüm sekmeleri tek kayıt olarak ekleyin. Boşlar sıfıra çevrilmez.</p></div> : <>
      <div className="workbook-summary"><article><span>Kart borcu</span><b>{format(summary.cardDebt)}</b></article><article><span>KMH borcu + faiz</span><b>{format(summary.kmhDebt)}</b></article><article><span>Aylık ödeme</span><b>{format(summary.monthly)}</b></article><article><span>Asgari ödeme</span><b>{format(summary.minimum)}</b></article><article><span>Ev ve yaşam giderleri</span><b>{format(summary.expenses)}</b></article><article><span>Eksik hesap</span><b>{summary.incomplete}</b></article></div>
      <div className="household-warning"><AlertTriangle size={18} /><span>Kart ve KMH kapsamı doğrulanmadan tek “toplam borç” üretilmez. Asgari ödeme, taksit ve ayrı faiz aylık plana otomatik eklenmez.</span></div>
      <FinanceTable title="Kartlar ve KMH" rows={cards} columns={["Dönem","Kişi","Banka / Hesap","Kart limiti","Toplam kart borcu","Aylık ödeme","KMH borcu + faiz","Asgari ödeme","Kaynak ödeme / ekstre tarihi","Kaynak notu"]} />
      <div className="household-grid"><CountCard title="Altın borçları" count={gold.length} note="TL karşılığı girilmeden değerleme yapılmaz." /><CountCard title="Şirket hareketleri" count={company.length} note="İşlem yönü doğrulanmadan net alacak hesaplanmaz." /></div>
      <small className="household-updated">Son aktarım: {new Date(current.updated_at).toLocaleString("tr-TR")}{current.source_name ? ` · ${current.source_name}` : ""}</small>
    </>}
  </section>;
}

function FinanceTable({ title, rows, columns }: { title: string; rows: Array<Record<string, unknown>>; columns: string[] }) {
  return <section className="finance-sheet-card"><div className="sheet-caption"><div><FileSpreadsheet size={19} /><span><b>{title}</b><small>Kaynak hücrelerin boşluk bilgisi korunur.</small></span></div><em>{rows.length} kayıt</em></div><div className="finance-sheet-scroll"><table className="finance-sheet"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => { const value = row[column]; const empty = value === null || value === undefined || value === ""; return <td key={column} className={empty ? "missing-value" : ""}>{empty ? "Bilgi eksik" : typeof value === "number" ? money.format(value) : String(value)}</td>; })}</tr>)}</tbody></table></div></section>;
}

function CountCard({ title, count, note }: { title: string; count: number; note: string }) {
  return <article className="household-count-card"><span>{title}</span><b>{count} kayıt</b><small>{note}</small></article>;
}
