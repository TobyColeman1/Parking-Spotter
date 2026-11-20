#!/usr/bin/env node
// Builds data/meters.js from the council files in this folder.
//   node tools/build-meters.js
// Locations and zones: dublin_terminals_coordinates_19062025.csv (2025, newest).
// Paid hours: copied from the nearest 2021 meter (parking-meter-locations.2021.csv) within 40 m,
// otherwise the council's usual Mon–Sat 07:00–19:00 is assumed and marked as unconfirmed.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
// ---------- helpers ----------
function parseCSV(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift().map(h => h.replace(/^﻿/, "").trim());
  return rows.filter(r => r.some(x => x.trim())).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || "").trim()])));
}
function read(rel, enc = "utf8") {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, enc);
}
function metres(lat1, lng1, lat2, lng2) {
  const R = 6371000, r = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lng2 - lng1) * r / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function nearest(lat, lng, list) {
  let best = null, bd = Infinity;
  for (const t of list) { const d = metres(lat, lng, t.lat, t.lng); if (d < bd) { bd = d; best = t; } }
  return { item: best, d: bd };
}
const zoneName = s => { const m = String(s || "").match(/yellow|red|green|orange|blue/i); return m ? m[0][0].toUpperCase() + m[0].slice(1).toLowerCase() : ""; };
const normStreet = s => String(s || "").toLowerCase().replace(/['’]/g, "")
  .replace(/^\s*st\b\.?/, "saint").replace(/\bst\b\.?/g, "street").replace(/\bgt\b\.?/g, "great").replace(/\bscr\b/g, "south circular road").replace(/\brd\b\.?/g, "road").replace(/\bsq\b\.?/g, "square")
  .replace(/\bave?\b\.?/g, "avenue").replace(/\bupr?\b\.?/g, "upper").replace(/\blwr?\b\.?/g, "lower")
  .replace(/\bnth\b|\bn\b/g, "north").replace(/\bsth\b|\bs\b/g, "south").replace(/[^a-z0-9]/g, "");
const eur = n => "€" + Number(n).toFixed(2);
const m0 = n => Math.round(n) + " m";

// Irish Grid (TM65, used by the 2021 file's X_Value/Y_Value) -> WGS84 lat/lng
function irishGridToWGS84(E, N) {
  const a = 6377340.189, b = 6356034.447, F0 = 1.000035, lat0 = 53.5 * Math.PI / 180, lon0 = -8 * Math.PI / 180, E0 = 200000, N0 = 250000;
  const e2 = 1 - (b * b) / (a * a), n = (a - b) / (a + b);
  const M = phi => b * F0 * ((1 + n + 1.25 * n * n + 1.25 * n ** 3) * (phi - lat0)
    - (3 * n + 3 * n * n + 2.625 * n ** 3) * Math.sin(phi - lat0) * Math.cos(phi + lat0)
    + (1.875 * n * n + 1.875 * n ** 3) * Math.sin(2 * (phi - lat0)) * Math.cos(2 * (phi + lat0))
    - (35 / 24) * n ** 3 * Math.sin(3 * (phi - lat0)) * Math.cos(3 * (phi + lat0)));
  let phi = lat0, Mv = 0;
  do { phi = (N - N0 - Mv) / (a * F0) + phi; Mv = M(phi); } while (Math.abs(N - N0 - Mv) >= 0.00001);
  const s = Math.sin(phi), c = Math.cos(phi), t = Math.tan(phi);
  const nu = a * F0 / Math.sqrt(1 - e2 * s * s), rho = a * F0 * (1 - e2) / (1 - e2 * s * s) ** 1.5, eta2 = nu / rho - 1;
  const dE = E - E0;
  const VII = t / (2 * rho * nu), VIII = t / (24 * rho * nu ** 3) * (5 + 3 * t * t + eta2 - 9 * t * t * eta2),
    IX = t / (720 * rho * nu ** 5) * (61 + 90 * t * t + 45 * t ** 4), X = 1 / (c * nu),
    XI = 1 / (c * 6 * nu ** 3) * (nu / rho + 2 * t * t), XII = 1 / (c * 120 * nu ** 5) * (5 + 28 * t * t + 24 * t ** 4),
    XIIA = 1 / (c * 5040 * nu ** 7) * (61 + 662 * t * t + 1320 * t ** 4 + 720 * t ** 6);
  const lat = phi - VII * dE ** 2 + VIII * dE ** 4 - IX * dE ** 6;
  const lon = lon0 + X * dE - XI * dE ** 3 + XII * dE ** 5 - XIIA * dE ** 7;
  // to cartesian on Airy Modified, Helmert shift to WGS84, back to lat/lng
  const sl = Math.sin(lat), v = a / Math.sqrt(1 - e2 * sl * sl);
  const x = v * Math.cos(lat) * Math.cos(lon), y = v * Math.cos(lat) * Math.sin(lon), z = v * (1 - e2) * sl;
  const as = Math.PI / 648000, rx = -1.042 * as, ry = -0.214 * as, rz = -0.631 * as, sc = 1 + 8.15e-6;
  const X2 = 482.5 + sc * (x - rz * y + ry * z), Y2 = -130.6 + sc * (rz * x + y - rx * z), Z2 = 564.6 + sc * (-ry * x + rx * y + z);
  const A = 6378137, B = 6356752.3142, ee = 1 - B * B / (A * A), p = Math.hypot(X2, Y2);
  let la = Math.atan2(Z2, p * (1 - ee)), prev;
  do { prev = la; const vv = A / Math.sqrt(1 - ee * Math.sin(la) ** 2); la = Math.atan2(Z2 + ee * vv * Math.sin(la), p); } while (Math.abs(la - prev) > 1e-12);
  return { lat: la * 180 / Math.PI, lng: Math.atan2(Y2, X2) * 180 / Math.PI };
}


const ZONES = ["Yellow", "Red", "Green", "Orange", "Blue"];
const MATCH_METRES = 40;
const DEFAULT_HOURS = "Mon-Sat 07.00-19.00";

// "Mon-Sat 07.00-19.00, Sun 14.00-18.00" -> 7 entries (Sun..Sat) of [startMin, endMin] or null
const DAY = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
function parseHours(text) {
  const days = [null, null, null, null, null, null, null];
  const t = String(text).toLowerCase().replace(/\s+/g, " ");
  const re = /(mon|tue|wed|thu|fri|sat|sun)[a-z]*\s*(?:-\s*(mon|tue|wed|thu|fri|sat|sun)[a-z]*)?\s*(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})/g;
  let m, any = false;
  while ((m = re.exec(t))) {
    any = true;
    const a = DAY[m[1]], b = m[2] ? DAY[m[2]] : a;
    const s = +m[3] * 60 + +m[4], e = +m[5] * 60 + +m[6];
    for (let d = a; ; d = (d + 1) % 7) { days[d] = [s, e]; if (d === b) break; }
  }
  return any ? days : null;
}
const hm = n => String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");
function label(days) { // tidy text like "Mon–Sat 07:00–19:00, Sun 14:00–18:00"
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], order = [1, 2, 3, 4, 5, 6, 0], out = [];
  let i = 0;
  while (i < 7) {
    const d = order[i], v = days[d]; if (!v) { i++; continue; }
    let j = i; while (j + 1 < 7 && days[order[j + 1]] && days[order[j + 1]][0] === v[0] && days[order[j + 1]][1] === v[1]) j++;
    out.push((j > i ? names[d] + "–" + names[order[j]] : names[d]) + " " + hm(v[0]) + "–" + hm(v[1]));
    i = j + 1;
  }
  return out.join(", ");
}

const now2025 = parseCSV(read("dublin_terminals_coordinates_19062025.csv"))
  .filter(r => r.Latitude && r.Longitude)
  .map(r => ({ code: +r["Terminal Code"], zone: zoneName(r["Zone Desc"]), address: r.Address.trim(), lat: +r.Latitude, lng: +r.Longitude }));
const old2021 = parseCSV(read("parking-meter-locations.2021.csv", "latin1"))
  .filter(r => +r.X_Value && +r.Y_Value && parseHours(r["Hours of Operation"]))
  .map(r => ({ ...irishGridToWGS84(+r.X_Value, +r.Y_Value), hours: parseHours(r["Hours of Operation"]), spaces: r["No Spaces"] }));

const schedules = [], schedIndex = {};
function schedId(days, confirmed) {
  const k = JSON.stringify(days) + confirmed;
  if (!(k in schedIndex)) { schedIndex[k] = schedules.length; schedules.push({ label: label(days), days, confirmed }); }
  return schedIndex[k];
}
let matched = 0;
const rows = now2025.map(m => {
  const { item, d } = nearest(m.lat, m.lng, old2021);
  const ok = item && d <= MATCH_METRES;
  if (ok) matched++;
  return [+m.lat.toFixed(6), +m.lng.toFixed(6), ZONES.indexOf(m.zone), m.address, m.code, schedId(ok ? item.hours : parseHours(DEFAULT_HOURS), !!ok)];
});

let js = "// Dublin City Council parking meters. Built by tools/build-meters.js, so don't edit by hand.\n";
js += "// Locations/zones: 2025 terminal list. Hours: nearest 2021 meter within " + MATCH_METRES + " m (" + matched + " of " + rows.length + " matched),\n";
js += "// otherwise the usual " + DEFAULT_HOURS + " (confirmed: false).\n";
js += "// METERS rows: [lat, lng, zone index, address, terminal code, schedule index]\n";
js += "// SCHEDULES days: Sunday..Saturday, each [start minute, end minute] when you must pay, or null = free all day\n";
js += "window.METER_ZONES = " + JSON.stringify(ZONES) + ";\n";
js += "window.METER_SCHEDULES = " + JSON.stringify(schedules) + ";\n";
js += "window.METERS = [\n" + rows.map(r => JSON.stringify(r)).join(",\n") + "\n];\n";
fs.writeFileSync(path.join(ROOT, "data/meters.js"), js);
console.log("meters", rows.length, "hours matched", matched, "schedules", schedules.length);
