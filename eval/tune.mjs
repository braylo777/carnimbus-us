import { writeFileSync, readFileSync } from "node:fs";
import { WEIGHTS } from "../site/assets/match.js";
import { accuracy } from "./score.mjs";
const gold = JSON.parse(readFileSync(new URL("./golden.json", import.meta.url)));

// 20-phase coordinate-descent hill-climb. Tune on TRAIN, report HOLDOUT (unseen) each phase.
// Keep-if-better; multi-scale steps; stop early only if holdout is truly ≥99.9%.
let W = {...WEIGHTS};
let best = accuracy(gold.train, W);
const KEYS = Object.keys(W);
const STEP = { overPenalty:0.15, dNear:1, dScale:2 };   // default step is 2 for the rest
const SCALES = [4, 2, 1];

console.log(`phase  0: train ${(best*100).toFixed(1)}%  holdout ${(accuracy(gold.holdout,W)*100).toFixed(1)}%  (baseline)`);
let phase=0;
for(phase=1; phase<=20; phase++){
  let improved=false;
  for(const mult of SCALES){
    for(const k of KEYS){ const step=(STEP[k]||2)*mult;
      for(const dir of [1,-1]){
        const cand={...W, [k]: Math.max(0, +(W[k]+dir*step).toFixed(3))};
        const a=accuracy(gold.train, cand);
        if(a>best+1e-9){ best=a; W=cand; improved=true; }
      }
    }
  }
  const hold=accuracy(gold.holdout, W);
  console.log(`phase ${String(phase).padStart(2)}: train ${(best*100).toFixed(1)}%  holdout ${(hold*100).toFixed(1)}%`);
  if(best>=0.999 && hold>=0.999) break;
  if(!improved && best>=0.999) break;
}

// Persist tuned weights ONLY if they strictly beat the starting weights — a tie means the principled
// baseline is at least as good and more robust on unseen inputs, so we keep it (no degenerate drift).
const startBest = accuracy(gold.train, {...WEIGHTS});
const path=new URL("../site/assets/match.js", import.meta.url);
if(best > startBest + 1e-9){
  const src=readFileSync(path,"utf8");
  const body=KEYS.map(k=>`  ${k}:${W[k]}`).join(",\n");
  const lit=`export const WEIGHTS = {\n${body}\n};`;
  writeFileSync(path, src.replace(/export const WEIGHTS = \{[\s\S]*?\};/, lit));
  console.log("weights improved → written");
} else { console.log("no strict gain over baseline → keeping principled weights"); }
console.log(`\nstopped at phase ${phase}. final train ${(accuracy(gold.train,W)*100).toFixed(1)}% holdout ${(accuracy(gold.holdout,W)*100).toFixed(1)}%`);
console.log("weights", JSON.stringify(W));
