// ai-backend.js — the hyper-local NIMBUS inference backend. Satisfies the seam worker.js already has:
// embed()/llm() (worker.js:323-331) POST to env.AI_BACKEND_URL + "/embed" | "/chat" before ever touching
// Cloudflare AI. This stands up exactly those two endpoints, backed by a local Ollama daemon.
// Zero deps. Cutover to the $52K GLM-5.2 rig later = point AI_BACKEND_URL at it; no code change here.
//
// Usage:  node ai-backend.js            # 127.0.0.1:8788, models from env or defaults below
//   NIMBUS_EMBED_MODEL=bge-m3  NIMBUS_CHAT_MODEL=llama3.2:3b  node ai-backend.js
import http from 'node:http';

const PORT = +(process.env.NIMBUS_AI_PORT || 8788);
const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const EMBED_MODEL = process.env.NIMBUS_EMBED_MODEL || 'nomic-embed-text';   // 768-dim; matches bge-base dims
const CHAT_MODEL = process.env.NIMBUS_CHAT_MODEL || 'llama3.2:3b';          // local stand-in for GLM-5.2

const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
async function body(req) { const c = []; for await (const x of req) c.push(x); return c.length ? JSON.parse(Buffer.concat(c)) : {}; }

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://x`);
    if (url.pathname === '/health') return json(res, 200, { ok: true, embed: EMBED_MODEL, chat: CHAT_MODEL, ollama: OLLAMA });

    if (url.pathname === '/embed' && req.method === 'POST') {
      const { text } = await body(req);
      const r = await fetch(`${OLLAMA}/api/embeddings`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: EMBED_MODEL, prompt: Array.isArray(text) ? text.join(' ') : String(text || '') }),
      });
      if (!r.ok) return json(res, 502, { error: 'ollama_embed_failed', status: r.status });
      const d = await r.json();
      // worker's embed() reads r.data[0] (Cloudflare shape). Mirror it.
      return json(res, 200, { data: [d.embedding] });
    }

    if (url.pathname === '/chat' && req.method === 'POST') {
      const { messages } = await body(req);
      const r = await fetch(`${OLLAMA}/api/chat`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: CHAT_MODEL, messages: messages || [], stream: false }),
      });
      if (!r.ok) return json(res, 502, { error: 'ollama_chat_failed', status: r.status });
      const d = await r.json();
      // worker's llm()/chatLLM() read r.response (Cloudflare shape). Mirror it.
      return json(res, 200, { response: d.message?.content ?? '' });
    }

    json(res, 404, { error: 'not_found' });
  } catch (e) {
    json(res, 500, { error: String(e?.message || e) });
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`🧠 NIMBUS local inference on http://127.0.0.1:${PORT}  (embed=${EMBED_MODEL}, chat=${CHAT_MODEL} via Ollama)`);
  console.log(`   GLM-5.2 rig cutover later: set AI_BACKEND_URL to the rig — no code change.`);
});
