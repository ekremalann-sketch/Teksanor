-- TG2: herkese açık durum sayfası için günlük çalışma kaydı (yalnız ekleme). Kişisel veri yok.
CREATE TABLE IF NOT EXISTS status_daily(day TEXT PRIMARY KEY,ok_count INTEGER NOT NULL DEFAULT 0,fail_count INTEGER NOT NULL DEFAULT 0,last_failure TEXT,last_at INTEGER NOT NULL);
