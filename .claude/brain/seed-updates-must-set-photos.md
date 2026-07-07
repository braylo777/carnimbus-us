# Idempotent seeds: the UPDATE branch must set every column the INSERT sets

The "Macan photo never shows" bug (July 2026): `seed/lacarguy-demo.sql`'s INSERT set `photos`,
but its UPDATE branch didn't — so once the live row existed with an empty `photos`, re-running the
seed could never repair it. Rule: in an INSERT-WHERE-NOT-EXISTS + UPDATE pair, the UPDATE must
mirror all demo-critical columns (photos, drivetrain, body, specs).

Related: production D1 cleanups should prefer UPDATE-sync files (see `seed/community-update.sql`)
over mass DELETE+re-seed — the auto-mode classifier blocks pattern DELETEs against remote D1, and
UPDATEs are idempotent + reviewable anyway.
