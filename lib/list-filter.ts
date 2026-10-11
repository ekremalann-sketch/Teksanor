const fields: Record<string, string[]> = {
  tasks: ["title", "department", "assignee_name"],
  "work-orders": ["order_number", "title", "customer_name", "location"],
  "field-visits": ["visit_number", "visitor_name", "location", "customer_name"],
  procurement: ["request_number", "title", "supplier_name", "department"],
  crm: ["name", "company_name", "sector"], hr: ["full_name", "title", "department"],
  risks: ["title", "department", "owner_name"],
  assets: ["asset_code", "name", "category", "location"],
  maintenance: ["asset_code", "asset_name", "title", "assigned_to"],
};
// The visible table and its export must apply the same predicates.
export function filterList<T extends object>(rows: T[], screen: string, search = "", status = "all"): T[] {
  const term = search.toLocaleLowerCase("tr-TR").trim();
  const keys = fields[screen];
  return rows.filter(row => {
    const record = row as Record<string, unknown>;
    return (screen !== "tasks" || status === "all" || (status==="overdue"?!!record.due_date&&String(record.due_date).slice(0,10)<new Date().toISOString().slice(0,10)&&!["done","cancelled"].includes(String(record.status)):record.status === status)) && (screen!=="risks"||status!=="critical"||(record.impact==="critical"&&["identified","mitigating"].includes(String(record.status)))) && (!keys || !term || keys.map(k => record[k] ?? "").join(" ").toLocaleLowerCase("tr-TR").includes(term));
  });
}

export function listScope(screen: string, search: string, status: string, period: string, labels: Record<string, string>) {
  return [fields[screen] && search.trim() ? `Arama: "${search.trim()}"` : "", screen === "tasks" && status !== "all" ? `Durum: ${labels[status] ?? status}` : "", screen === "payments" && period !== "all" ? `Dönem: ${period}` : ""].filter(Boolean).join(" · ");
}
