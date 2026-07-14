// AI: regression net for typeOf() — the classifier behind the homepage's 4 type bubbles.
// AJ: + condOf() — the condition gradient on the match card (see the CONDITION section at the bottom).
// Two halves:
//   1. DOMAIN — over the real inventory fixture: every row lands in exactly one of the 4 buckets.
//   2. SHAPE  — synthetic rows for cases the fixture can't cover honestly (it has no true sports car,
//      no Model Y). These are NOT added to inventory.json on purpose: the fixture mirrors real stock,
//      and seeding fake cars there would make the golden accuracy numbers lie.
// Run: node eval/typecheck.mjs
import { readFileSync } from "node:fs";
import { typeOf, condOf } from "../site/assets/match.js";

const inv = JSON.parse(readFileSync(new URL("./inventory.json", import.meta.url)));
const OK = new Set(["sedan","suv","truck","sport"]);
let fails = 0;
const ok = (c,m)=>{ if(!c){ fails++; console.log("  FAIL " + m); } else console.log("  pass " + m); };

console.log("DOMAIN (real inventory, " + inv.length + " rows)");
const dist = {}; inv.forEach(c => { dist[typeOf(c)] = (dist[typeOf(c)]||0)+1; });
console.log("  distribution:", dist);
ok(inv.every(c => OK.has(typeOf(c))), "every row lands in exactly one of the 4 buckets");
ok(inv.filter(c => /truck/i.test(c.body||"")).every(c => typeOf(c)==="truck"), "every body=Truck row -> truck");
ok(inv.filter(c => /^suv$/i.test(c.body||"")).every(c => typeOf(c)==="suv"), "every body=SUV row -> suv");

console.log("SHAPE (synthetic — the bugs this classifier exists to fix)");
const T = [
  // segOf() returns "luxury"/"ev" for these — the shadowing bugs typeOf must not inherit.
  [{make:"Lexus", model:"RX 350", body:"SUV"}, "suv", "Lexus RX (segOf says luxury)"],
  [{make:"Tesla", model:"Model Y", body:"SUV"}, "suv", "Tesla Model Y (segOf says ev)"],
  [{make:"Genesis", model:"GV60", body:"EV"}, "suv", "Genesis GV60 (body column holds a FUEL type)"],
  [{make:"Porsche", model:"Macan", body:"SUV"}, "suv", "Porsche Macan (SPORTY regex would say sport)"],
  [{make:"Porsche", model:"Cayenne", body:"SUV"}, "suv", "Porsche Cayenne (same trap)"],
  // True sports cars — the fixture has none, so only synthetics can prove this path.
  [{make:"Porsche", model:"911 Carrera", body:"Coupe"}, "sport", "Porsche 911"],
  [{make:"Chevrolet", model:"Corvette", body:"Coupe"}, "sport", "Corvette"],
  [{make:"Ford", model:"Mustang GT", body:"Coupe"}, "sport", "Mustang"],
  [{make:"Toyota", model:"GR Supra", body:"Coupe"}, "sport", "Supra"],
  [{make:"McLaren", model:"Artura", body:"Coupe"}, "sport", "McLaren (sport by make)"],
  // Trucks incl. EV trucks, which segOf would call "ev".
  [{make:"Ford", model:"F-150 Lightning", body:"Truck"}, "truck", "F-150 Lightning (EV truck)"],
  [{make:"Rivian", model:"R1T", body:"Truck"}, "truck", "Rivian R1T"],
  [{make:"Tesla", model:"Cybertruck", body:"Truck"}, "truck", "Cybertruck"],
  // Sedans, incl. an EV sedan whose body column lies.
  [{make:"BMW", model:"i4", body:"EV"}, "sedan", "BMW i4 (EV body, but a sedan)"],
  [{make:"Honda", model:"Civic", body:"Sedan"}, "sedan", "Civic"],
  // No van/wagon bubble exists -> nearest hauler.
  [{make:"Toyota", model:"Sienna", body:"Minivan"}, "suv", "Sienna (no van bubble -> suv)"],
  [{make:"Subaru", model:"Outback", body:"Wagon"}, "suv", "Outback (wagon -> suv)"],
  // Missing/garbage data must never throw or escape the domain.
  [{}, "sedan", "empty row -> sedan (total function, no throw)"],
];
for(const [car, want, label] of T){ const got = typeOf(car); ok(got===want, `${label}: ${got}` + (got===want?"":` (want ${want})`)); }

console.log("CONDITION (condOf — the match card's gradient)");
const Y = new Date().getFullYear();
const C = [
  [{year:Y,   mileage_exact:5},      "Brand New",    "current-year, 5 mi"],
  [{year:Y-1, mileage_exact:2000},   "Brand New",    "1yr old at the 2k boundary (<=)"],
  [{year:Y-1, mileage_exact:2001},   "Like New",     "1yr old, one mile past the boundary"],
  [{year:Y-2, mileage_exact:9000},   "Like New",     "2yr old, low use"],
  [{year:Y,   mileage_exact:40000},  "Like New",     "current-year but heavily driven — age===0 guard, never Higher Miles"],
  [{year:Y-6, mileage_exact:30000},  "Low Miles",    "6yr old, well under 12k/yr"],
  [{year:Y-8, mileage_exact:95000},  "Well Kept",    "8yr old at normal use"],
  [{year:Y-13,mileage_exact:169288}, "Higher Miles", "oldest real car in stock"],
  // Totality: never throw, never invent a grade from absent data.
  [{year:Y-6},                       null,           "no mileage -> null (2-pill card, not a guess)"],
  [{mileage_exact:5},                null,           "no year -> null"],
  [{year:Y-6, mileage_exact:null},   null,           "explicit null mileage -> null"],
  [{},                               null,           "empty row -> null (total function, no throw)"],
];
for(const [car, want, label] of C){ const got = condOf(car); ok(got===want, `${label}: ${got}` + (got===want?"":` (want ${want})`)); }

// The assertion that actually matters: the gradient must SPREAD on real stock. A scale where every car lands in
// one bucket is decoration, and no per-case assertion above would catch it. Non-empty (not a frozen count) —
// counts legitimately drift as cars age each January.
const cd = {}; inv.forEach(c => { const g = condOf(c); cd[g] = (cd[g]||0)+1; });
console.log("  distribution:", cd);
ok(inv.every(c => condOf(c) !== null), "every real row grades (year + mileage_exact are 100% populated)");
for(const g of ["Brand New","Like New","Low Miles","Well Kept","Higher Miles"]) ok((cd[g]||0) > 0, `bucket "${g}" is non-empty`);

console.log(fails ? `\nFAIL — ${fails} assertion(s)` : "\nALL PASS");
process.exit(fails ? 1 : 0);
