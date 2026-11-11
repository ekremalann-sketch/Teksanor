ALTER TABLE service_parts ADD COLUMN sale_price_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE service_parts ADD COLUMN critical_level INTEGER NOT NULL DEFAULT 0;
ALTER TABLE service_parts ADD COLUMN barcode TEXT;
