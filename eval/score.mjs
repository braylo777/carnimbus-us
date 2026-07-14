import { readFileSync } from "node:fs";
import { scoreCar, segOf, typeOf, normColor, WEIGHTS } from "../site/assets/match.js";
const inv = JSON.parse(readFileSync(new URL("./inventory.json", import.meta.url)));
const gold = JSON.parse(readFileSync(new URL("./golden.json", import.meta.url)));

// A query PASSES on a car if the car satisfies every stated expectation (segment, make family,
// color when asked, price ceiling). No expectation stated for a field = that field is free.
export function passes(query, car){
  const e = query.expect || {}; if(!car) return false;
  if(e.segment && segOf(car.make, car.model) !== e.segment) return false;
  if(e.type && typeOf(car) !== e.type) return false;
  if(e.makeFamily && !String(car.make).toLowerCase().includes(e.makeFamily)) return false;
  if(e.color && normColor(car.color) !== e.color) return false;
  if(e.maxPrice && (car.price||0) > e.maxPrice) return false;
  return true;
}

export function accuracy(set, W){
  const saved = {...WEIGHTS};
  if(W) Object.assign(WEIGHTS, W);          // scoreCar reads the live WEIGHTS object
  let num=0, den=0;
  for(const query of set){ const w=query.weight||1; den += w;
    const ctx = {monthly:query.monthly||0, budget:query.budget||0,
      isCash:query.deal==="cash", isLease:query.deal==="lease", type:query.type||null};   // AI: ||null keeps the 66 text cases byte-identical
    // Mirror worker scan(): pass-1 filters to affordable cars (cash→price, finance→price_mo); fall back to all.
    let pool = inv.filter(c => ctx.isCash ? (c.price<=ctx.budget) : (ctx.monthly ? (c.price_mo<=ctx.monthly) : true));
    if(!pool.length) pool = inv;
    const ranked = pool.map(c=>({c, s:scoreCar(query.q, c, ctx).s})).sort((a,b)=>b.s-a.s).map(x=>x.c);
    if(passes(query, ranked[0])) num += w;                                  // top-1 correct = full
    else if(ranked.slice(0,3).some(c=>passes(query,c))) num += w*0.5;       // in top-3 = half (stricter than top-5)
  }
  Object.assign(WEIGHTS, saved);
  return den ? num/den : 0;
}

if(import.meta.url === `file://${process.argv[1]}`){
  console.log("train  ", (accuracy(gold.train)*100).toFixed(1)+"%");
  console.log("holdout", (accuracy(gold.holdout)*100).toFixed(1)+"%");
  if(gold.type) console.log("type   ", (accuracy(gold.type)*100).toFixed(1)+"%");
}
