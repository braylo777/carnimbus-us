// vectorize-sqlite.js — Cloudflare Vectorize-compatible shim over a SQLite table (zero deps).
// worker.js uses exactly two methods: MATCH_INDEX.upsert([{id,values,metadata}]) and
// MATCH_INDEX.query(vector,{topK,filter:{kind}}). Cosine similarity computed in pure JS.
// Fine at demo scale (≈94 cars / ≤50 profiles).

export function makeVectorize(db /* the node:sqlite DatabaseSync from makeD1()._db */) {
  db.exec(`CREATE TABLE IF NOT EXISTS vectors (
    id TEXT PRIMARY KEY, kind TEXT, vec TEXT, metadata TEXT
  )`);

  const cosine = (a, b) => {
    let dot = 0, na = 0, nb = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
  };

  return {
    async upsert(vectors) {
      const stmt = db.prepare(
        `INSERT INTO vectors (id,kind,vec,metadata) VALUES (?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, vec=excluded.vec, metadata=excluded.metadata`
      );
      for (const v of vectors) {
        const kind = v.metadata?.kind ?? null;
        stmt.run(v.id, kind, JSON.stringify(Array.from(v.values)), JSON.stringify(v.metadata ?? {}));
      }
      return { mutationId: 'local', count: vectors.length };
    },

    async query(vector, opts = {}) {
      const topK = opts.topK ?? 10;
      const kind = opts.filter?.kind ?? null;
      const rows = kind
        ? db.prepare('SELECT id,vec,metadata FROM vectors WHERE kind=?').all(kind)
        : db.prepare('SELECT id,vec,metadata FROM vectors').all();
      const q = Array.from(vector);
      const scored = rows.map((r) => ({
        id: r.id,
        score: cosine(q, JSON.parse(r.vec)),
        metadata: JSON.parse(r.metadata),
      }));
      scored.sort((a, b) => b.score - a.score);
      return { matches: scored.slice(0, topK), count: Math.min(topK, scored.length) };
    },
  };
}
