#!/usr/bin/env node
// CarNimbus inventory importer — loads a LAcarGUY export (CSV or JSON) into vdps via /api/vdp/ingest.
// Usage: node tools/import-inventory.mjs <export.csv|export.json> [https://carnimbus.com]
// Admin key is read from ~/.carnimbus-admin-key (never printed). Edit COLMAP for the real headers.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const COLMAP = { // export-header -> vdp field. Adjust to LAcarGUY's actual columns.
  vin:"vin", year:"year", make:"make", model:"model", trim:"trim",
  price_mo:"price_mo", price_total:"price_total", miles:"miles", mileage:"mileage", drivetrain:"drivetrain", body:"body", location_zip:"location_zip",
  description:"description", photo:"photo", features:"features"
};
const ORIGIN = process.argv[3] || "https://carnimbus.com";
const file = process.argv[2];
if(!file){ console.error("usage: node tools/import-inventory.mjs <export.csv|export.json> [origin]"); process.exit(1); }
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
function toCar(rec){
  const g=k=>rec[COLMAP[k]] ?? rec[k] ?? "";
  return { vin:g("vin"), year:+g("year")||0, make:g("make"), model:g("model"), trim:g("trim"),
    price_mo:+String(g("price_mo")).replace(/[^0-9.]/g,"")||0, miles:g("miles"),
    drivetrain:g("drivetrain"), body:g("body"), description:g("description"),
    price_total:+String(g("price_total")).replace(/[^0-9.]/g,"")||0, mileage:+String(g("mileage")).replace(/[^0-9.]/g,"")||0, location_zip:g("location_zip"),
    features: g("features")? String(g("features")).split(/[;|]/).map(s=>s.trim()).filter(Boolean):[],
    photos: g("photo")? [g("photo")]:[] };
}
const raw=readFileSync(file,"utf8");
const recs = file.endsWith(".json") ? JSON.parse(raw) : parseCSV(raw);
const cars = recs.map(toCar).filter(c=>c.vin && c.make && c.model);
console.log(`parsed ${cars.length} cars from ${file}`);
for(let i=0;i<cars.length;i+=50){
  const batch=cars.slice(i,i+50);
  const r=await fetch(ORIGIN+"/api/vdp/ingest",{method:"POST",
    headers:{"content-type":"application/json","x-admin-key":KEY}, body:JSON.stringify(batch)});
  const d=await r.json().catch(()=>({}));
  console.log(`batch ${i/50+1}: HTTP ${r.status} ${JSON.stringify(d)}`);
}
console.log("done. Now POST /api/admin/reindex to embed the new cars.");
