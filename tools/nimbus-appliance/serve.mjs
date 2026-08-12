// NIMBUS appliance — bridges the CarNimbus Worker to Ollama running on THIS machine.
// The Worker calls exactly three things (see worker.js llm()/embed()/aiHealth):
//   POST /chat  {messages}  -> {text}
//   POST /embed {text}      -> {vector}   (768-dim, nomic-embed-text)
//   GET  /                  -> {ok:true}  (heartbeat)
import http from "node:http";

const OLLAMA = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const CHAT_MODEL = process.env.NIMBUS_MODEL || "llama3.1:8b";
const EMBED_MODEL = "nomic-embed-text";
const PORT = +(process.env.PORT || 8787);

const readBody = (req) => new Promise((res, rej) => {
  let b = ""; req.on("data", c => { b += c; if (b.length > 1e6) req.destroy(); });
  req.on("end", () => { try { res(b ? JSON.parse(b) : {}); } catch { res({}); } });
  req.on("error", rej);
});
const send = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };

http.createServer(async (req, res) => {
  try {
    if (req.method === "GET") return send(res, 200, { ok: true, model: CHAT_MODEL });
    const body = await readBody(req);
    if (req.url === "/chat") {
      const r = await fetch(OLLAMA + "/api/chat", { method: "POST",
        body: JSON.stringify({ model: CHAT_MODEL, messages: body.messages || [], stream: false }) });
      if (!r.ok) return send(res, 502, { error: "ollama " + r.status });
      const d = await r.json();
      return send(res, 200, { text: (d.message && d.message.content) || "" });
    }
    if (req.url === "/embed") {
      const r = await fetch(OLLAMA + "/api/embeddings", { method: "POST",
        body: JSON.stringify({ model: EMBED_MODEL, prompt: String(body.text || "") }) });
      if (!r.ok) return send(res, 502, { error: "ollama " + r.status });
      const d = await r.json();
      return send(res, 200, { vector: d.embedding || [] });
    }
    send(res, 404, { error: "not found" });
  } catch (e) { send(res, 500, { error: String(e && e.message || e) }); }
}).listen(PORT, () => console.log("NIMBUS appliance on http://127.0.0.1:" + PORT + "  (chat: " + CHAT_MODEL + ")"));
