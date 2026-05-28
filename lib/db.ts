import Database from 'better-sqlite3';
import path from 'path';
import { SEED_CATS } from './seed-data';

// On Railway: set DB_PATH=/data/cats.db (persistent volume) for persistence.
// Falls back to /tmp/cats.db which is always writable on Railway/Linux containers.
const DB_PATH = process.env.DB_PATH || '/tmp/cats.db';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cats (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      image        TEXT NOT NULL,
      name         TEXT NOT NULL,
      neighborhood TEXT NOT NULL,
      quote        TEXT NOT NULL,
      uploaded_by  TEXT DEFAULT NULL,
      approved     INTEGER DEFAULT 1,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    -- Track which pool entries are already in use so nothing repeats.
    CREATE TABLE IF NOT EXISTS used_names (
      name TEXT PRIMARY KEY
    );
    CREATE TABLE IF NOT EXISTS used_quotes (
      quote TEXT PRIMARY KEY
    );
  `);

  // Auto-seed on first boot if table is empty
  const count = (db.prepare('SELECT COUNT(*) as c FROM cats').get() as { c: number }).c;
  if (count === 0) {
    const insert = db.prepare('INSERT INTO cats (image, name, neighborhood, quote) VALUES (?, ?, ?, ?)');
    const markName  = db.prepare('INSERT OR IGNORE INTO used_names  (name)  VALUES (?)');
    const markQuote = db.prepare('INSERT OR IGNORE INTO used_quotes (quote) VALUES (?)');
    db.transaction(() => {
      for (const cat of SEED_CATS) {
        insert.run(cat.image, cat.name, cat.neighborhood, cat.quote);
        markName.run(cat.name);
        markQuote.run(cat.quote);
      }
    })();
    console.log(`[db] Auto-seeded ${SEED_CATS.length} cats.`);
  }
}

/** Mark a name and quote as consumed. Call inside the same transaction as INSERT INTO cats. */
export function markUsed(db: Database.Database, name: string, quote: string) {
  db.prepare('INSERT OR IGNORE INTO used_names  (name)  VALUES (?)').run(name);
  db.prepare('INSERT OR IGNORE INTO used_quotes (quote) VALUES (?)').run(quote);
}

/** Return the set of already-used names and quotes. */
export function getUsed(db: Database.Database): { names: Set<string>; quotes: Set<string> } {
  const names  = new Set((db.prepare('SELECT name  FROM used_names').all()  as { name:  string }[]).map(r => r.name));
  const quotes = new Set((db.prepare('SELECT quote FROM used_quotes').all() as { quote: string }[]).map(r => r.quote));
  return { names, quotes };
}

export type Cat = {
  id: number;
  image: string;
  name: string;
  neighborhood: string;
  quote: string;
  uploaded_by: string | null;
  approved: number;
  created_at: string;
};
