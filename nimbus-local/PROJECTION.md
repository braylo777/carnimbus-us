# PROJECTION.md — sovereignty runbook: carnimbus.us / NIMBUS to the public internet, no Cloudflare

`serve.js` already projects the site from the flash to your LAN. To reach the **public internet on
hardware you own** (digital sovereignty), you add three things Cloudflare used to provide: a reachable
address, a name pointed at it, and TLS. None require Cloudflare or GitHub.

## The three pieces

### 1. A publicly reachable address (the owned box)
Run `serve.js` on a machine that the internet can reach on ports 80/443. Options, most→least sovereign:
- **Owned server + business/static IP** — port-forward 80/443 on your router to the box. Fully sovereign.
- **Owned box behind a residential IP** — same, plus dynamic-DNS (see §2) if the ISP IP rotates.
- **A VPS you rent** — sovereign-ish (you control the OS/keys, not the metal). Fastest to public.
> The CNMB flash is the *source of truth + admin key*; the "box" is whatever executes `serve.js`. Keep
> the drive plugged into that box (or copy `site/` + `nimbus.sqlite` to it and keep the key on the drive).

### 2. DNS you control → point the name at the box
carnimbus.us's DNS is **currently on Cloudflare**. Going fully off-Cloudflare means moving the zone to a
registrar/nameserver you control (Namecheap, Porkbun, self-hosted, etc.) — a one-time external step, your
call. Once you control the zone:
- `A   ai.carnimbus.us   → <box public IP>`   (NIMBUS)
- optionally `A   carnimbus.us   → <box public IP>` and `A www` to project the whole apex from the flash.
- residential/rotating IP → run a tiny dynamic-DNS updater (a cron `curl` to the registrar API).

### 3. TLS (HTTPS) without Cloudflare — Let's Encrypt / ACME
- **Easiest:** put **Caddy** in front of `serve.js` (`reverse_proxy localhost:8787`) — Caddy auto-obtains
  + renews Let's Encrypt certs. One binary, no npm. *(Only external tool in this path; optional.)*
- **Pure-Node:** obtain a cert via any ACME client (or `certbot` once), then
  `node serve.js --tls /etc/letsencrypt/live/ai.carnimbus.us/fullchain.pem  .../privkey.pem`.
- Renewals: cron the ACME renew + `serve.js` restart (or let Caddy handle it).

## Bring-up order
1. Provision the box; copy/keep `nimbus-local/` + `site/` there; plug in the CNMB drive; `bash seed-db.sh`.
2. `ollama serve` + `node ai-backend.js` (or point `AI_BACKEND_URL` at the GLM-5.2 rig).
3. `node serve.js --tls <fullchain> <privkey> --port 443` (or Caddy in front on 8787).
4. Move the DNS zone off Cloudflare; add the A records; wait for propagation.
5. Verify: `curl -I https://ai.carnimbus.us` → 200 + your headers; `node nimbus-key.js login https://ai.carnimbus.us`.

## NIMBUS AI cutover (the $52K GLM-5.2 rig)
The worker already routes every AI call through `AI_BACKEND_URL` (`embed()`/`llm()`), so when the rig is
ready: stand up its `/embed` + `/chat` (same shapes as `ai-backend.js`), then set
`AI_BACKEND_URL=https://<rig>` — **one env var, zero code change.** Until then, `ai-backend.js` + Ollama
is the local stand-in.

## Honest dependency notes
- Moving the DNS zone off Cloudflare is an **external action only you can take** (registrar login); this
  repo can't do it. Everything on the *serving* side is owned/sovereign once that's done.
- A rented VPS is not "owned metal" — if strict sovereignty matters, host on your own hardware with a
  static IP. The software is identical either way.
- Caddy (if used for TLS) is a third-party binary, not npm, and touches nothing in the app. Pure-Node
  `--tls` avoids even that if you obtain certs another way.
