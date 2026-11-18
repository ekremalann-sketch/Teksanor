-- Çözüm Mimarı T6: müşteriye saat aralığı ve "Yola çıktım / Vardım" bilgisi (yalnız ekleme).
ALTER TABLE service_jobs ADD COLUMN time_window TEXT;
ALTER TABLE service_jobs ADD COLUMN on_way_at TEXT;
ALTER TABLE service_jobs ADD COLUMN arrived_at TEXT;
