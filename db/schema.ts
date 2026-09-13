// Şema SQL'i build sırasında raw metin olarak gömülür (workerd/D1 uyumlu).
import schemaSql from "./migrations/0001_init.sql?raw";

export const SCHEMA_SQL: string = schemaSql;

// Şema içindeki her CREATE/`;` ifadesini ayrı ayrı çalıştırmak için böler.
export function schemaStatements(): string[] {
  const withoutComments = SCHEMA_SQL
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  return withoutComments
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}
