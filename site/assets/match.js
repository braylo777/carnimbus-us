// CarNimbus matching scorer — SINGLE SOURCE OF TRUTH. Imported by worker.js AND eval/*.mjs so the benchmark
// measures exactly what ships. WEIGHTS are tuned by the 20-phase eval/tune.mjs loop.
export const WEIGHTS = {
  wMake:40,
  wModel:30,
  wYear:6,
  wSeg:6,
  wColorExact:12,
  wColorNear:5,
  wBody:10,
  wDrive:5,
  wFuel:8,
  wBudget:10,
  overPenalty:1.7,
  wDist:8,
  dNear:8,
  dScale:16,
  wMiles:6,
  wFresh:3,
  wCond:4,
  wValue:4,
  wType:45
};
const COLORS = { black:/black|onyx|ebony|obsidian|midnight|jet/, white:/white|pearl|quartz|frost|ivory|snow/,
  gray:/gray|grey|steel|graphite|gunmetal|slate|granite|ash|magnetic/, silver:/silver|platinum|aluminum|titanium|chrome/,
  blue:/blue|navy|cobalt|azure|indigo|teal/, red:/red|crimson|ruby|garnet|scarlet|maroon|burgundy/,
  green:/green|emerald|olive|forest|lime/, brown:/brown|mocha|espresso|bronze|copper|chestnut|walnut/,
  tan:/tan|beige|sand|champagne|khaki|gold|cream/, orange:/orange|amber/, yellow:/yellow/, purple:/purple|violet/ };
const NEAR = { silver:["gray"], gray:["silver"], white:["silver"], tan:["gold","brown"] };
export function normColor(s){ s=String(s||"").toLowerCase(); for(const k in COLORS){ if(COLORS[k].test(s)) return k; } return null; }
const SPORTY=/mclaren|ferrari|lamborghini|lambo|porsche|corvette|gt-?r|supra|artura|huracan|aventador|911|cayman|boxster|amg|\bm[2-8]\b|rs\d|maserati|aston|bentley|rolls/;
export function segOf(mk,md){ mk=(mk||"").toLowerCase(); md=(md||"").toLowerCase(); const s=mk+" "+md;
  if(/lexus|bmw|mercedes|audi|genesis|acura|infiniti|volvo|porsche|cadillac/.test(mk)) return "luxury";
  if(/f-?150|f-?250|f-?350|silverado|\bram\b|\b2500\b|\b3500\b|super ?duty|tundra|tacoma|sierra|ranger|frontier|colorado|canyon|gladiator|ridgeline|pickup|truck/.test(s)) return "truck";
  if(/sienna|odyssey|pacifica|carnival|quest|minivan|\bvan\b/.test(s)) return "minivan";
  if(/mustang|camaro|challenger|corvette|supra|gr86|\bbrz\b|\b86\b|miata|coupe|two-door/.test(s)) return "coupe";
  if(/tesla|ioniq|mach-e|leaf|\bbolt\b|\bev\b|electric|\beqs\b|\beqe\b|\beqb\b/.test(s)) return "ev";
  if(/jeep|grand cherokee|cherokee|wrangler|bronco|4runner|land cruiser|tahoe|yukon|suburban|expedition|sequoia|telluride|palisade|wagoneer|explorer|pilot|highlander|\bsuv\b|rav4|cr-v|crv|santa fe|tucson|kona|cx-5|cx-9|forester|outback|crosstrek|escape|edge|equinox|traverse|acadia|pathfinder|murano|rogue|venza|sorento|sportage|seltos|telluride|q5|q7|qx|mdx|rdx|x3|x5|gx|rx|nx|glc|gle|macan/.test(s)) return "suv";
  return "sedan"; }
// Stopwords: 3+ char filler that substring-collides with makes/models ("for"→ford, "the"→…). Prevents false +40.
const STOP = new Set(["for","the","and","with","near","under","over","the","car","cars","auto","autos","new","used",
  "want","need","looking","family","cheap","nice","good","great","best","reliable","affordable","dream","buy",
  "quiero","carro","coche","cerca","para","mejor","barato","bueno","que","con","los","las","del","una","que",
  "row","3rd","2nd","seat","seats","door","doors","miles","mile","budget","payment","month","monthly"]);
const BODYWORDS = { truck:/truck|pickup|troca|pick-?up|camioneta/, suv:/\bsuv\b|crossover/, coupe:/coupe|two-door|cupé/, sedan:/sedan|four-door|sedán/,
  van:/van|minivan/, hatch:/hatch|hatchback/, wagon:/wagon|estate/, convertible:/convertible|cabrio|roadster|convertible/ };
function bodyIntent(q){ for(const k in BODYWORDS){ if(BODYWORDS[k].test(q)) return k; } return null; }
function bodyOf(c){ return String(c.body||c.body_style||"").toLowerCase(); }
// ── AI: structured type classifier (homepage bubbles). Independent of segOf() BY DESIGN: segOf models shopping
// segments (luxury/ev shadow the shape) and the 66-case golden set depends on it; typeOf models body shape only.
// Never make one call the other. NOTE: `porsche` is deliberately NOT a sport make here (Macan/Cayenne are SUVs) —
// this is why the SPORTY const above cannot be reused.
const T_SPORT_MK = /ferrari|lamborghini|lambo|mclaren|lotus|aston/;
const T_SPORT_MD = /\b911\b|cayman|boxster|corvette|\bvette\b|mustang|camaro|challenger|\bsupra\b|gr86|\bbrz\b|\b86\b|miata|\bmx-?5\b|\bgt-?r\b|amg ?gt|\bm[2-8]\b|\brs ?[3-7]\b|huracan|aventador|artura|\bf8\b|\broma\b|\bemira\b|\btype ?r\b|\bsti\b/;
const T_TRUCK = /f-?[1234]50|silverado|\bram\b|\b[23]500\b|super ?duty|tundra|tacoma|sierra|ranger|frontier|colorado|canyon|gladiator|ridgeline|maverick|titan|cybertruck|r1t|lightning|\bpickup\b/;
const T_SUV = /jeep|cherokee|wrangler|bronco|4runner|land cruiser|tahoe|yukon|suburban|expedition|sequoia|telluride|palisade|wagoneer|explorer|pilot|highlander|rav-?4|cr-?v|hr-?v|santa fe|tucson|kona|venue|cx-?[3359]0?|forester|outback|ascent|crosstrek|escape|\bedge\b|equinox|traverse|blazer|acadia|pathfinder|murano|rogue|venza|sorento|sportage|seltos|\bq[357]\b|\bqx\d\d\b|\bmdx\b|\brdx\b|\bx[1-7]\b|\bgx\b|\brx\b|\bnx\b|\brz\b|\bux\b|gl[abcees]|\beq[bcgs]\b|macan|cayenne|model ?[xy]|mach-?e|ioniq ?5|id\.?4|xc\d\d|gv\d\d|e-?tron|discovery|range rover|defender|velar|evoque|grecale|levante|stelvio|taos|atlas|tiguan|corsair|aviator|nautilus|\bev6\b|ariya|\bsuv\b/;
// Total function, exactly 4 buckets. Body is primary POSITIVE evidence but model regex is a co-equal OR —
// the body column is dirty (observed: GLC 300 body="Coupe" but is an SUV; GV60/i4 body="EV", a fuel type).
export function typeOf(c){
  const mk=String(c.make||"").toLowerCase(), md=String(c.model||"").toLowerCase(), s=mk+" "+md;
  const b=bodyOf(c);
  if(T_SPORT_MK.test(mk) || T_SPORT_MD.test(md)) return "sport";
  if(/truck|pickup/.test(b) || T_TRUCK.test(s))  return "truck";
  if(/suv|sport utility|crossover/.test(b) || T_SUV.test(s)) return "suv";
  if(/minivan|\bvan\b|wagon/.test(b))            return "suv";     // no van bubble → nearest hauler
  if(/coupe|convertible|roadster/.test(b))       return "sport";   // 2-door, no sport-model hit
  return "sedan";                                                   // incl. hatchback + the dirty "EV" body rows
}
export function scoreCar(q, c, ctx){
  q=String(q||"").toLowerCase(); const W=WEIGHTS, reasons=[]; let s=0;
  const toks=q?q.split(/[^a-z0-9]+/).filter(t=>t.length>=3 && !STOP.has(t)):[];
  const mk=String(c.make||"").toLowerCase(), md=String(c.model||"").toLowerCase(), yr=String(c.year||"");
  for(const t of toks){ if(mk.includes(t)){ s+=W.wMake; } else if(md.includes(t)){ s+=W.wModel; } else if(yr===t){ s+=W.wYear; } }
  // segment
  const qSeg=q?((SPORTY.test(q)||/luxury|premium|high.?end|upscale/.test(q))?"luxury":segOf(q,q)):null;
  if(qSeg && segOf(c.make,c.model)===qSeg){ s+=W.wSeg; }
  // color (only when asked)
  const qc=normColor(q); if(qc){ const cc=normColor(c.color); if(cc===qc){ s+=W.wColorExact; reasons.push("🎨 "+qc); }
    else if(cc && (NEAR[qc]||[]).includes(cc)){ s+=W.wColorNear; } }
  // body intent
  const qb=bodyIntent(q); if(qb){ const b=bodyOf(c);
    if((qb==="suv"&&/suv|sport utility|crossover/.test(b))||(qb==="truck"&&/truck|pickup/.test(b))||
       (qb==="coupe"&&/coupe/.test(b))||(qb==="sedan"&&/sedan/.test(b))||(qb==="van"&&/van/.test(b))||
       (qb==="hatch"&&/hatch/.test(b))||(qb==="wagon"&&/wagon/.test(b))||(qb==="convertible"&&/convertible|roadster/.test(b))){ s+=W.wBody; reasons.push("🚗 "+qb); } }
  // AI: structured type bubble. ctx.type absent ⇒ zero-op (byte-identical to pre-change scoring for text callers).
  // Keep `ctx.type` BEFORE typeOf(c) — short-circuit keeps typeOf off the hot path for the 66 text goldens.
  if(ctx && ctx.type && typeOf(c)===ctx.type){ s+=W.wType; reasons.push("🚙 "+ctx.type); }
  // drivetrain
  if(/awd|all.?wheel|4wd|4x4|four.?wheel/.test(q) && /awd|all-wheel|4wd|4x4|four/.test(String(c.drivetrain||"").toLowerCase())){ s+=W.wDrive; reasons.push("AWD"); }
  // fuel / EV
  if(/\bev\b|electric|eléctric|electric|híbrid|hibrid|hybrid|plug.?in/.test(q)){ const f=String(c.fuel||"").toLowerCase();
    if(/electric|ev|hybrid|phev|plug/.test(f)||segOf(c.make,c.model)==="ev"){ s+=W.wFuel; reasons.push("⛽ "+(/(hybrid|phev|plug)/.test(f)?"Hybrid":"EV")); } }
  // budget fit (asymmetric)
  const tgt=ctx.isCash?ctx.budget:ctx.monthly, val=ctx.isCash?c.price:c.price_mo;
  if(tgt&&val){ const d=(val-tgt)/tgt; const pen=d>0?W.overPenalty:1; const r=Math.min(Math.abs(d)*pen,1); const add=W.wBudget*(1-r);
    s+=add; if(add>=W.wBudget*0.6) reasons.push("💰 in budget"); }
  // distance convenience (plateau + smooth decay)
  if(c._d!=null){ const d=+c._d; const add=d<=W.dNear?W.wDist:W.wDist*Math.exp(-(d-W.dNear)/W.dScale); s+=add;
    if(d<=W.dNear+4) reasons.push("📍 "+(d<1?"<1":Math.round(d))+" mi"); }
  // low miles vs age expectation
  if(c.mileage_exact!=null && c.year){ const age=Math.max(1,(new Date().getFullYear())-(+c.year)); const exp=age*12000;
    if(c.mileage_exact<exp){ s+=W.wMiles*Math.min(1,(exp-c.mileage_exact)/exp); reasons.push("low miles"); } }
  // freshness
  if(c.updated_at){ const days=Math.max(0,(Date.now()-Date.parse(c.updated_at))/864e5); s+=W.wFresh*Math.exp(-days/30); }
  // condition / value
  if(c.certified||/excellent|great|clean/i.test(String(c.cond||""))){ s+=W.wCond; }
  if(/below|under/i.test(String(c.pvm||""))){ s+=W.wValue; reasons.push("great value"); }
  return { s, reasons: reasons.slice(0,4) };
}
