// CarNimbus — static site (Assets) + waitlist API (D1)
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/waitlist" && request.method === "POST") {
      let email, lang;
      try { ({ email, lang } = await request.json()); }
      catch { return json({ ok: false, error: "bad_request" }, 400); }

      email = String(email || "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return json({ ok: false, error: "invalid_email" }, 422);
      }

      try {
        const r = await env.DB
          .prepare("INSERT INTO waitlist (email, lang, created_at, user_agent) VALUES (?,?,?,?) ON CONFLICT(email) DO NOTHING")
          .bind(email, String(lang || "en").slice(0, 5), new Date().toISOString(), request.headers.get("user-agent") || "")
          .run();
        return json({ ok: true, already: r.meta.changes === 0 });
      } catch (e) {
        return json({ ok: false, error: "server_error" }, 500);
      }
    }

    // everything else → static assets
    return env.ASSETS.fetch(request);
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}
