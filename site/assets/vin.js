/**
 * VIN syntax validation and check digit — ISO 3779 / 49 C.F.R. Part 565.
 *
 * ⚠ THIS IS A VERBATIM COPY, NOT THE CANONICAL SOURCE.
 * Canonical: 01D-iov/nimbus-foundation-iov/broker/src/vin.js, which is exercised by the NF-5
 * conformance suite (`node conformance/run.js` — 319 assertions). If you change the algorithm
 * here you have forked it; change it there, re-run conformance, then copy back.
 *
 * WHY A COPY RATHER THAN AN IMPORT. Importing across `../../01D-iov/…` would work — esbuild
 * resolves it and wrangler would bundle it — but it couples deploying the production website to
 * the presence and layout of a different repository on the same disk. Moving or renaming the IoV
 * folder would break `wrangler deploy` for carnimbus.us, which is not a trade worth 200 lines.
 * The duplication is deliberate and is recorded in docs/SETTLEMENT-RUNBOOK.md.
 *
 * DOCTRINE. Everything here is about the VIN as a *name*. Nothing in this module authorises
 * anything and nothing accepts a credential — that is Refusal 1's enforcement point at the syntax
 * layer. A VIN is public: visible through a windshield, printed on insurance documents, and
 * enumerable. Code that treats it as a secret is wrong twice over.
 */

/** ISO 3779 excludes I, O and Q to avoid confusion with 1 and 0. */
const VIN_CHARSET = /^[A-HJ-NPR-Z0-9]{17}$/;

/** ISO 3779 / 49 C.F.R. Part 565 transliteration. */
const TRANSLITERATION = Object.freeze({
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
});

/** Positional weights; index 8 is the check digit itself and carries weight 0. */
const WEIGHTS = Object.freeze([8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]);

const CHECK_DIGIT_INDEX = 8;

/**
 * Validate VIN syntax and, separately, the check digit.
 *
 * The two are reported separately on purpose. The check digit is mandatory for vehicles
 * manufactured for the North American market (49 C.F.R. § 565.15) but is not universally required
 * by ISO 3779, so grey-market and some non-NA vehicles carry structurally valid VINs that fail it.
 * Collapsing both into one boolean would silently exclude those vehicles — and a dealer who cannot
 * list a legally-registered car because of a validation shortcut has hit a defect, not a policy.
 *
 * The wApp calls this with strict:true. A VIN that decodes to the wrong car is worse than no scan,
 * so /api/app/vin refuses on a check-digit mismatch and hands the expected digit back to the UI.
 */
export function validateVin(vin, opts = {}) {
  const strict = opts.strict !== false;

  if (typeof vin !== 'string') return fail('VIN must be a string');
  const normalized = vin.trim().toUpperCase();

  if (normalized.length !== 17) {
    return fail(`VIN must be exactly 17 characters, got ${normalized.length}`);
  }
  if (!VIN_CHARSET.test(normalized)) {
    return fail('VIN contains characters outside the ISO 3779 set (I, O and Q are excluded)');
  }

  const expected = computeCheckDigit(normalized);
  const checkDigitValid = normalized[CHECK_DIGIT_INDEX] === expected;

  return {
    valid: strict ? checkDigitValid : true,
    syntaxValid: true,
    checkDigitValid,
    normalized,
    expectedCheckDigit: expected,
    reason: checkDigitValid
      ? null
      : `check digit mismatch: position 9 is '${normalized[CHECK_DIGIT_INDEX]}', expected '${expected}'`,
  };

  function fail(reason) {
    return { valid: false, syntaxValid: false, checkDigitValid: null,
             normalized: null, expectedCheckDigit: null, reason };
  }
}

/** ISO 3779 check digit: weighted sum of transliterated characters, mod 11, 10 rendered as 'X'. */
export function computeCheckDigit(vin) {
  let sum = 0;
  for (let i = 0; i < 17; i += 1) {
    const ch = vin[i];
    const value = ch >= '0' && ch <= '9' ? Number(ch) : TRANSLITERATION[ch];
    if (value === undefined) return null;
    sum += value * WEIGHTS[i];
  }
  const remainder = sum % 11;
  return remainder === 10 ? 'X' : String(remainder);
}

/** The World Manufacturer Identifier: first three characters. */
export function wmi(vin) {
  const v = validateVin(vin, { strict: false });
  return v.syntaxValid ? v.normalized.slice(0, 3) : null;
}
