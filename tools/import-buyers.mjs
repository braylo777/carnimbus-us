#!/usr/bin/env node
// CarNimbus buyer-pool importer — loads a buyers CSV (one row per buyer) into users+profiles
// via /api/admin/profiles/ingest. Usage: node tools/import-buyers.mjs <buyers.csv> [origin]
// Admin key read from ~/.carnimbus-admin-key (never printed). Arrays (hobbies, must_haves) are
// "|"-joined in the CSV — the server splits them.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const COLS = ["phone","full_name","zip","buy_method","max_down","max_monthly","fico","income","dream_car","reason","hobbies",
  "current_year","current_make","current_model","current_miles","trade_in","trade_value","timeline","body_pref","must_haves"];
const ORIGIN = process.argv[3] || "https://carnimbus.com";
const file = process.argv[2];
if(!file){ console.error("usage: node tools/import-buyers.mjs <buyers.csv> [origin]"); process.exit(1); }
const KEY = readFileSync(join(homedir(),".carnimbus-admin-key"),"utf8").trim();

function parseCSV(text){
  const rows=[]; let i=0,f="",row=[],q=false;
  const push=()=>{row.push(f);f="";}; const end=()=>{push();rows.push(row);row=[];};
  while(i<text.length){ const c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){f+='"';i++;} else q=false; } else f+=c; }
    else if(c==='"') q=true; else if(c===",") push(); else if(c==="\n") end();
    else if(c==="\r"){} else f+=c; i++; }
  if(f.length||row.length) end();
  const head=rows.shift().map(h=>h.trim());
  return rows.filter(r=>r.length>1).map(r=>Object.fromEntries(head.map((h,j)=>[h,(r[j]||"").trim()])));
}
const recs = parseCSV(readFileSync(file,"utf8"));
const buyers = recs.map(rec=>{ const o={}; for(const k of COLS) if(rec[k]!=null&&rec[k]!=="") o[k]=rec[k]; return o; })
  .filter(b=>/^\+1\d{10}$/.test(b.phone||""));
console.log(`parsed ${buyers.length} buyers from ${file} (rows without +1XXXXXXXXXX phone skipped: ${recs.length-buyers.length})`);
for(let i=0;i<buyers.length;i+=50){
  const batch=buyers.slice(i,i+50);
  const r=await fetch(ORIGIN+"/api/admin/profiles/ingest",{method:"POST",
    headers:{"content-type":"application/json","x-admin-key":KEY}, body:JSON.stringify(batch)});
  const d=await r.json().catch(()=>({}));
  console.log(`batch ${i/50+1}: HTTP ${r.status} ${JSON.stringify(d)}`);
}
console.log("done. Now POST /api/admin/reindex (or hit Reindex on ai.carnimbus.com/pools) to embed them.");
