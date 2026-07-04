# Dealer console requires admin activation (since 0007)

`withDealer` (worker.js) now requires the matching `dealer_leads` row to have
`status='active'` AND a `client_no` — submitting the dealer request form is no longer enough.
Activation happens in admin.carnimbus.com ("Activate → issue #" button →
`POST /api/admin/dealer/activate`), which issues a `CN-######-####` client number via
`genCode()` (crypto RNG). Buyers get a `SID-######-####` on first OTP verify, shown on the
You/Account page. Rationale: manifest DEX-AUTH-03 — "no number = no dashboard"; the client
number is the paid-activation switch, phone match stays the identity factor.
Gotcha: pre-0007 dealer rows have status NULL ⇒ treated as pending; Brandon must activate his
own test lead from admin after each fresh DB.
