// German version of trademania-v3-thinking, built from the English v008.
// Same motion; only text changes. Tags and the "..." after titles are re-placed
// from measured German title widths (Geist 500, 49.18px).
//
//   node scripts/trademania-v3-de.mjs  →  shots/trademania-v3-thinking-de/v001.json

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const src = new URL("../shots/trademania-v3-thinking/v008.json", import.meta.url);
const shot = JSON.parse(readFileSync(src, "utf8"));
const r4 = (v) => +v.toFixed(4);
const get = (id) => {
  const l = shot.layers.find((x) => x.id === id);
  if (!l) throw new Error(`missing layer ${id}`);
  return l;
};

const DE = {
  title: "Trademania V3 denkt nach...",
  timer: "Denkt seit {counter} s nach",
  "header-thinking": "Trademania V3 denkt nach",
  "header-ready": "Deine Sitzung ist bereit",
  "step1-title": "Live-Daten",
  "step1-desc": "Live-Marktdaten werden geladen und Sitzungszeitstempel auf UTC +3 abgeglichen.",
  "step2-desc": "Marktkontext für den BTCUSDT-Perpetual-Kontrakt von Bitcoin auf Binance wird vorbereitet.",
  "step3-title": "Wird geladen",
  "step3-title-alt": "Analysedaten",
  "step3-desc": "Datenquellen für die Marktanalyse werden geladen.",
  "sub1-title": "Indikatoren",
  "sub1-desc": "Technische Indikatordaten für den aktuellen Marktkontext werden vorbereitet.",
  "sub2-title": "Wirtschaftsdaten",
  "sub2-desc": "Wirtschaftsinformationen für einen breiteren Marktkontext werden geladen.",
  "sub3-title": "Orderflow",
  "sub3-desc": "Orderflow-Daten zur Analyse der Handelsaktivität werden vorbereitet.",
};
for (const [id, text] of Object.entries(DE)) get(id).props.text = text;
get("timer").props.counterSeparator = ","; // 1,8 s

// Titles whose width changed: move what sits to their right.
const EN_W = { "step1-title": 208.47 };
const DE_W = { "step1-title": 245.41, "sub1-title": 253.03, "sub2-title": 391.87, "sub3-title": 225.2 };
const shiftX = (id, dx) => {
  const l = get(id);
  if (typeof l.props.x === "number") l.props.x = r4(l.props.x + dx);
  for (const k of l.keyframes?.x ?? []) k.v = r4(k.v + dx);
};
const dx = DE_W["step1-title"] - EN_W["step1-title"];
shiftX("step1-tag", dx);
shiftX("step1-tag-text", dx);
for (const n of [1, 2, 3]) get(`sub${n}-dots`).props.x = DE_W[`sub${n}-title`];

// Layer names follow the language too (timeline readability).
const NAME = { "step1": "Step 1 · Live-Daten", "step3": "Step 3 · Wird geladen", "sub1": "Sub 1 · Indikatoren", "sub2": "Sub 2 · Wirtschaftsdaten" };
for (const [id, name] of Object.entries(NAME)) get(id).name = name;

shot.name = "Trademania V3 · Denkt nach → Bereit (DE)";
shot.note = "German version of EN v008";

const dir = new URL("../shots/trademania-v3-thinking-de/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL("v001.json", dir), JSON.stringify(shot, null, 2) + "\n");
console.log(`DE v001: ${shot.layers.length} layers, ${shot.duration}s`);
