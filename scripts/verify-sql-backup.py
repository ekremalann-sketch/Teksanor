"""Restore a supplied SQL export only into a new temporary local SQLite database."""
import sqlite3,sys,tempfile,pathlib
if len(sys.argv)!=2: raise SystemExit('Usage: python scripts/verify-sql-backup.py database.sql')
source=pathlib.Path(sys.argv[1])
with tempfile.TemporaryDirectory(prefix='teksanor-restore-') as directory:
 db=sqlite3.connect(str(pathlib.Path(directory)/'restore.sqlite'))
 # D1 gibi yabancı anahtar denetimi açık: sıra hatası olan yedek burada da başarısız olur.
 db.execute('PRAGMA foreign_keys=ON')
 # Tek işlem: D1'in defer_foreign_keys davranışı gibi denetim işlem sonunda yapılır.
 db.executescript('BEGIN;\n'+source.read_text()+'\nCOMMIT;')
 result=db.execute('PRAGMA integrity_check').fetchone()[0]
 foreign=db.execute('PRAGMA foreign_key_check').fetchall()
 if result!='ok' or foreign: raise SystemExit('Restore integrity verification failed.')
 required={'users','sessions','organizations','payment_records'}
 tables={row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
 if not required.issubset(tables): raise SystemExit('Restore missing required application tables.')
 print('Local restore integrity passed. Production and R2 were not changed.')
