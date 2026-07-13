// d1-sqlite.js — D1-compatible adapter over node:sqlite (zero deps).
// Mirrors the exact surface worker.js uses: env.DB.prepare(sql).bind(...).all()/.first()/.run()/.raw(),
// plus batch()/exec(). D1 "?" placeholders map 1:1 to node:sqlite positional params.
import { DatabaseSync } from 'node:sqlite';

export function makeD1(path) {
  const db = new DatabaseSync(path);

  const statement = (sql) => {
    let params = [];
    const api = {
      bind: (...a) => { params = a; return api; },
      all: async () => {
        const rows = db.prepare(sql).all(...params);
        return { results: rows, success: true, meta: { rows_read: rows.length } };
      },
      first: async (col) => {
        const row = db.prepare(sql).get(...params) ?? null;
        if (row && col != null) return row[col];
        return row;
      },
      run: async () => {
        const r = db.prepare(sql).run(...params);
        return { success: true, meta: { changes: r.changes, last_row_id: r.lastInsertRowid } };
      },
      raw: async () => db.prepare(sql).all(...params).map((r) => Object.values(r)),
    };
    return api;
  };

  return {
    prepare: (sql) => statement(sql),
    batch: async (stmts) => Promise.all(stmts.map((s) => s.all())),
    exec: (sql) => { db.exec(sql); return { count: 0, duration: 0 }; },
    _db: db,
  };
}
