# Sovereign Inference — the one-page talking sheet
*(S-04 / P-01–P-04 / T-09 · for Brandon + John + Ryan · replaces ALL "private Opus 4.8" language)*

## The one-liner (canonical — use verbatim)
> "Owned, air-gapped inference on open-weight models — unlimited internal compute, no per-seat
> frontier billing, hedged against an industry that always needs it: buying the right car."

## The box
- **Model:** GLM-5.2 — ~744–753B-parameter Mixture-of-Experts, **MIT-licensed** open weights.
- **Architecture:** **CPU/RAM-offload on ~1TB DDR5.** It is NOT VRAM-resident — a ~750B MoE
  cannot fit in 96GB of VRAM; the active experts stream through system RAM.
  *(Correction for Jonathan: the earlier spec conflated VRAM and system RAM. Bake this into
  any procurement doc.)*
- **CapEx:** **$52,000** (locked figure — matches the model; the "$50K" pitch round-down is
  fine verbally, the ask slide says $52K).
- **Posture:** air-gapped, locally served. Weights are non-exfiltrable. No third party meters,
  rate-limits, or deprecates our core capability.

## Why it wins (the repriced value — no "$200/mo sub payback" math)
- **Unmetered internal inference.** Matching + per-car conversation run all day at zero
  marginal cost.
- **No per-seat frontier billing.** Headcount and usage scale without an API line item.
- **No rate-limit exposure.** Today's API path caps at ~100 matches/day; cloud LLM scaling
  runs $100s–$1,000s/day at volume. The box removes the ceiling.
- **Investor perk framing:** CapEx / foundational asset — "unlimited AI for life."

## The hedge (the only framing we use)
Frontier access is trending toward **more restriction and higher cost**. Owning inference is
the hedge — and the demand we serve never goes away: people always need to buy the right car.
*(No surveillance framing. No compute-scraping framing. Ever.)*

## Who says what
- **John** owns the architecture story: MoE, RAM-offload, air-gap, why open weights.
- **Brandon** owns the investor hedge + economics.
- The capability claim that survives scrutiny: **"the $52K box services ~90% of our daily
  tasks."** True, defensible — and it is never called "Opus," "Claude," or any frontier brand.

## Where it lives in the product
Everything already runs behind one seam (`embed()`/`llm()` in the Worker). Cutover to the box
= point `ai.carnimbus.us` DNS at it + set one secret (`AI_BACKEND_URL`). Zero code change.
