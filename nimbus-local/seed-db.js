// seed-db.js — apply migrations/*.sql (in filename order) into nimbus-local/nimbus.sqlite.
// Zero deps (node:sqlite). Each migration is exec'd in its own try; failures are reported, not fatal,
// so a POC DB still comes up even if a later migration uses a construct node:sqlite doesn't accept.
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const migDir = join(repo, 'migrations');
const dbPath = join(here, 'nimbus.sqlite');

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

const files = readdirSync(migDir)
  .filter((f) => f.endsWith('.sql') && !f.startsWith('._'))
  .sort();

let ok = 0, fail = 0;
for (const f of files) {
  const sql = readFileSync(join(migDir, f), 'utf8');
  try { db.exec(sql); ok++; }
  catch (e) { fail++; console.error(`  ✗ ${f}: ${e.message.split('\n')[0]}`); }
}

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((r) => r.name);
console.log(`\nseed-db: ${ok} migrations applied, ${fail} skipped. ${tables.length} tables → ${dbPath}`);
console.log('tables:', tables.join(', '));
db.close();
