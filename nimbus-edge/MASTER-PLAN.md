# nimbus-edge — MASTER PLAN (production cutover, sequenced honestly)

Origin: 2026-07-14 Jono/CNMB infra call 2 (`08-exec/08E-decis/01aa68-mtng-v9/`). Goal, in the founder's words:
own the whole stack in C and eventually run carnimbus off Cloudflare/GitHub, "from the flash drive." This plan
takes that seriously **and** states what has to be true before customer traffic moves — because carnimbus.com is a
live business (~34k visits/week, real PII), not a hobby endpoint.

## Where we are — Phase A (DONE this session): localhost sandbox
Eight daemons built, compile warns-clean, each smoke-tested on loopback:
`static, balancer, dns, monitor, statsd, shorty, configd, tunnel`. `static` serves the **real** `../site`;
`balancer` fronts it with failover. This proves the stack end-to-end off Cloudflare. Zero production risk — nothing
here touches the live Worker, its D1 data, or any public DNS.

## Phase B — parallel run (next)
1. **Pick a real always-on host.** *Honest note:* a 24/7 residential laptop is the weakest possible link — home
   power, ISP NAT, a dynamic IP, no redundancy. The real version of "own the stack" is a controlled always-on box
   (a cheap VPS gives a static IP, better uptime, and a clean firewall). Same independence from Cloudflare/GitHub,
   without betting uptime on a laptop under a desk.
2. **Serve a NON-production hostname** — e.g. `edge.carnimbus.com` — pointed at that host. Run `static` + `balancer`
   in front of a copy of the `nimbus-local` gateway. No customer traffic yet.
3. **Compare against prod** for a week: latency, error rate, correctness of the 48 API routes. Fix what diverges.

## Phase C — cutover gates (ALL must be green before ANY public traffic or PII leaves Cloudflare)
1. **TLS termination — the #1 hard blocker.** These daemons speak plaintext HTTP; carnimbus.com is HTTPS-only.
   Nothing public can move until the stack terminates TLS (ACME/Let's Encrypt for certs + a TLS layer in front of
   `static`/`balancer`). This is real, non-trivial work and gates everything else.
2. **DDoS resilience / rate limiting** to rough Cloudflare parity. Today Cloudflare absorbs this for free; a home
   box does not.
3. **Process supervision** — auto-restart on crash, log rotation (the research doc's cron wrappers, done right).
4. **Backups + durability** for the D1-equivalent data. PII must be encrypted at rest and recoverable.
5. **Monitoring/alerting** that actually pages a human on downtime (`monitor` is the seed, not the whole thing).

Until all five are green, **customer PII and public traffic stay on Cloudflare.** That is not caution for its own
sake — it is the difference between "we own our stack" and "we dropped a live business onto an unhardened box."

## The wake trigger — flash-in boots the brain (Brandon's mental model, 2026-07-14)
The idea: plugging the verified CNMB drive into a trusted machine is the trigger that "wakes the brain" — it opens
Nimbus, brings up our own edge/VPS, and lands you in `ai.carnimbus.com`, the way waking from sleep switches your
awareness on. This is the right model, and most of it already exists — but one honest constraint sets the shape:

- **A webpage cannot detect the drive being plugged in.** No browser API exposes USB/mass-storage mount events
  (this is the same wall the 01aa67 flash-key work hit). So the trigger CANNOT live in the site itself.
- **An OS-level agent can, and that's the real mechanism.** A tiny always-installed launch agent on the trusted
  Mac (`launchd` + a DiskArbitration/mount watch on `/Volumes/CNMB`) fires the moment the drive mounts. On mount it:
  1. verifies the drive is really ours — the **Ed25519 keystore already in `nimbus-local/`** (private key on the
     drive, machine holds only the pubkey) is exactly this "verified computer + verified drive" handshake;
  2. boots the stack — `nimbus-local/serve.js` (Node projection) and/or the `nimbus-edge` daemons, and in Phase B
     connects up to the always-on VPS;
  3. opens `ai.carnimbus.com`. **Brain online.**
- **Unplug = sleep.** This half is already built and shipping: the site's 2s File-System-Access heartbeat wipes the
  key, locks, and hard-reloads within ~2.3s of the drive leaving (measured, live). The launch agent tears the local
  daemons down the same way. Plug in → wake; pull out → sleep.

So the path is: **a signed `launchd` "wake agent" on the trusted machine** that does verify → boot → open. It is the
missing 10% around parts we already own (Ed25519 custody + auto-lock). Scoped for tomorrow's "integrity" pass with
Brandon; everything runs behind `ai.carnimbus.com` as he specified.

## Adjacent tracks (not blocking the cutover)
- **eLEAD/CDK custom-API tunnel** (from the call): once `configd`/`tunnel` are hardened, build the custom API tunnel
  that pushes scheduled test-drive packets to the dealer CRM. Cross-check against `../DEALER-CRM-RUNBOOK.md` — the
  dormant ADF/`routeLead` seam already there is the same integration from the other end.
- **`mailrelay.c` (deferred, reshaped):** the research doc's port-25 open relay is a spam vector and collides with
  the standing CAN-SPAM / no-blast rules. If built, it is an *authenticated, forward-only* relay to a keyed upstream
  (Resend/SendGrid), OFF by default.
- **`knockd.c` (deferred, reshaped):** the doc's `system("ufw allow from <IP>")` is command-injection-prone and
  macOS has no `ufw`. A safe version validates the IP and calls the platform firewall API directly — no shell
  interpolation, ever.

## Explicitly out of scope (not part of a legitimate cutover)
- IP-spoofing / "artificially generate IPs from the crowd" / a Tor-like multi-IP relay to "hide." Not built, not
  planned. A normal reverse proxy is fine; concealment infrastructure is a different thing and we don't build it.
- A harness to scrape thousands of third-party sites. The proxy/tunnel front **our own** services only.
