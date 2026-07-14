# nimbus-edge — a "mini-Cloudflare" edge stack in C

A suite of small, single-purpose network daemons written in C — the C-level expression of the same thesis as
`../nimbus-local` (run CarNimbus without depending on a managed cloud), one layer closer to the metal. Each daemon
is one file, compiles warns-clean, and does exactly one job.

> **This is an R&D sandbox, not the production path — today.** carnimbus.com is a live business (real traffic, real
> customer data) and stays on Cloudflare (managed TLS, DDoS protection, global edge). The founder's goal is to
> *migrate off* that onto this self-hosted stack; `MASTER-PLAN.md` sequences that cutover honestly, with the gates
> that must pass before any public traffic or customer PII moves. In Phase A every daemon binds `127.0.0.1` only.

## Build
```sh
make all        # cc -std=c11 -Wall -Wextra -O2, one binary per daemon
make clean
```
(The research doc said `gcc -ansi`; strict C89 fights POSIX sockets, so we use C11 + `_DARWIN_C_SOURCE` and keep it
warns-clean. Same spirit — no runtime, close to the metal.)

## The daemons (Phase A: all loopback)
| Bin | Port | Job |
|---|---|---|
| `static`   | 8080 | Static file HTTP server for `../site` (GET only, path-traversal-safe). Project #1. |
| `balancer` | 8081 | Reverse proxy / round-robin across OUR backends (8080 + the nimbus-local gateway 8787), with failover. |
| `dns`      | 8053/udp | Caching DNS resolver → upstream 1.1.1.1, TTL-aware LRU. (8053, not 53/5353 — 53 needs root, 5353 is macOS mDNS.) |
| `monitor`  | 8085 | Uptime daemon; TCP-probes our endpoints every 10s → `GET /status`. |
| `statsd`   | 8086 (+8096/udp) | Request/bandwidth tracker; UDP ingest → ring buffer → `GET /stats`. |
| `shorty`   | 8087 | URL shortener; `POST /shorten` (base62, flat file) + `GET /<id>` → 302. |
| `configd`  | 8088 | Runtime config API; `POST /config`, master-token (constant-time compare). |
| `tunnel`   | 8089 | `CONNECT host:port` blind relay (does NOT decrypt TLS). |

## Run (example)
```sh
./static 8080 ../site &      # serves the real homepage from the flash
./balancer 8081 &            # front it (add ../nimbus-local `node serve.js` on 8787 for the second backend)
./monitor 8085 &             # http://127.0.0.1:8085/status
NIMBUS_CONFIG_TOKEN=<tok> ./configd 8088 &
```

## Deliberately NOT built here (see MASTER-PLAN + the 01aa68 execution receipt for reasons)
- No IP-spoofing / anonymizing multi-IP relay ("generate IPs from the crowd" / "hide"). The proxy and tunnel are
  scoped to **our own** services, not concealment.
- No mass-scraping harness for third-party sites.
- `mailrelay` (open port-25 relay) and `knockd` (`system("ufw …")`) from the research doc are **deferred** and, if
  ever built, only in hardened form — an open relay is a spam vector and the ufw shell-out is injection-prone.
