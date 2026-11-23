// Parking Spotter: the page.
// Reads what you picked, asks pricing.js for the ranked parking, and shows it as cards and map pins.

const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const QUICK_PICKS = [
  { name: "City Centre", lat: 53.3473, lng: -6.2591 },
  { name: "Temple Bar", lat: 53.3455, lng: -6.2650 },
  { name: "St Stephen’s Green", lat: 53.3382, lng: -6.2591 },
  { name: "Docklands", lat: 53.3474, lng: -6.2390 },
  { name: "Croke Park", lat: 53.3609, lng: -6.2512 },
  { name: "Aviva Stadium", lat: 53.3352, lng: -6.2285 }
];
const STAYS = [[0.5, "30m"], [1, "1h"], [2, "2h"], [4, "4h"], [8, "8h"], ["custom", "Custom"]];
const MAX_STAY_HOURS = 24; // longest stay you can type in
const WALKS = [5, 10, 15, 20];
const MAX_RESULTS = 25;

const OPTIONS = buildOptions(); // every meter + car park, built once
const sameDest = (a, b) => a && b && a.lat === b.lat && a.lng === b.lng;

const state = {
  dest: QUICK_PICKS[0], hours: 2, customStay: false /* true = hours and minutes typed in */, arrive: null /* null = now */, walk: 10, sort: "cheapest",
  open: null,   // id of the expanded result
  live: null,   // live car park spaces by car park id, when available
  saved: []
};

// ---------- saved places (kept in this browser) ----------
try {
  const s = JSON.parse(localStorage.getItem("ps-saved") || "[]");
  if (Array.isArray(s)) state.saved = s
    .map(x => typeof x === "string" ? QUICK_PICKS.find(q => q.name === x) || null : x)
    .filter(x => x && typeof x.name === "string" && isFinite(x.lat) && isFinite(x.lng));
} catch (e) {}
const storeSaved = () => { try { localStorage.setItem("ps-saved", JSON.stringify(state.saved)); } catch (e) {} };

// ---------- small helpers ----------
function toast(text) { const e = $("toast"); e.textContent = text; e.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove("on"), 2400); }
function segButtons(el, items, current, onPick) {
  el.replaceChildren(...items.map(([value, label]) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = label; b.setAttribute("aria-pressed", value === current);
    b.onclick = () => onPick(value);
    return b;
  }));
}
const arrivalTime = () => state.arrive || new Date();
const pad = n => String(n).padStart(2, "0");
const toLocalInput = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
// "25 min", "1 hour", "3 hours 40 min"
function durationLabel(totalMins) {
  const m = Math.round(totalMins), h = Math.floor(m / 60), r = m % 60;
  if (!h) return r + " min";
  return h + (h === 1 ? " hour" : " hours") + (r ? " " + r + " min" : "");
}
const stayLabel = h => durationLabel(h * 60);

function setDestination(dest) {
  state.dest = dest; state.open = null;
  $("hits").innerHTML = "";
  render();
}

// ---------- controls ----------
function renderControls() {
  $("destName").textContent = state.dest.name;
  const isSaved = state.saved.some(d => sameDest(d, state.dest));
  $("saveDest").textContent = isSaved ? "★ Saved" : "☆ Save place";
  $("saveDest").onclick = () => {
    state.saved = isSaved ? state.saved.filter(d => !sameDest(d, state.dest)) : [...state.saved, state.dest];
    storeSaved(); renderControls();
  };

  const picks = [...state.saved.map(d => ({ ...d, saved: true })), ...QUICK_PICKS.filter(q => !state.saved.some(s => sameDest(s, q)))];
  $("quick").replaceChildren(...picks.map(d => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip" + (d.saved ? " saved" : ""); b.textContent = d.name;
    b.setAttribute("aria-pressed", sameDest(d, state.dest));
    b.onclick = () => { Track.event("quick-pick"); setDestination({ name: d.name, lat: d.lat, lng: d.lng }); };
    return b;
  }));

  const presetOn = !state.customStay && STAYS.some(([v]) => v === state.hours);
  segButtons($("stay"), STAYS, presetOn ? state.hours : "custom", v => {
    if (v === "custom") { state.customStay = true; Track.once("custom-stay"); }
    else { state.customStay = false; state.hours = v; }
    render();
  });
  $("stayCustom").hidden = presetOn;
  if (!presetOn && !$("stayCustom").contains(document.activeElement)) {
    const total = Math.round(state.hours * 60);
    $("stayH").value = Math.floor(total / 60); $("stayM").value = total % 60;
  }
  segButtons($("arrive"), [["now", "Now"], ["later", "Later"]], state.arrive ? "later" : "now", v => {
    if (v === "now") state.arrive = null;
    else if (!state.arrive) { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); state.arrive = d; }
    render();
  });
  $("arriveAt").hidden = !state.arrive;
  if (state.arrive && document.activeElement !== $("arriveAt")) $("arriveAt").value = toLocalInput(state.arrive);
  segButtons($("walk"), WALKS.map(w => [w, w + " min"]), state.walk, v => { state.walk = v; render(); });
  segButtons($("sort"), Object.entries(SORTS).map(([k, s]) => [k, s.label]), state.sort, v => { state.sort = v; render(); });
}

// ---------- results ----------
let lastResults = [];
function render() {
  renderControls();
  const arrive = arrivalTime();
  const all = rankOptions(OPTIONS, {
    dest: state.dest, hours: state.hours, arrive, maxWalkMin: state.walk, sort: state.sort,
    freeOnly: $("fFree").checked, carParksOnly: $("fCar").checked, live: state.live
  });
  // Keep the top street results, but always list every car park in range (their prices aren't
  // known, so a price sort would otherwise push them off the end).
  let meterCount = 0;
  const results = all.filter(o => o.kind === "carpark" || ++meterCount <= MAX_RESULTS);
  lastResults = results;

  ParkingMap.draw(results, state.dest, state.walk * WALK_METRES_PER_MIN, state.open, id => openResult(id, true));

  const when = state.arrive ? "arriving " + arrive.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "arriving now";
  const free = all.filter(o => o.cost === 0).length;
  $("summary").innerHTML = all.length
    ? "<strong>" + all.length + " place" + (all.length === 1 ? "" : "s") + "</strong> within a " + state.walk + "-minute walk, for " + stayLabel(state.hours) + ", " + esc(when) +
      (free ? " · <strong>" + free + " free</strong>" : "") + (results.length < all.length ? ". Showing the best " + results.length + "." : ".")
    : "";

  const list = $("results");
  if (!results.length) {
    const nextWalk = WALKS.find(w => w > state.walk);
    list.innerHTML = '<li class="empty">' +
      ($("fFree").checked || $("fCar").checked ? "Nothing matches your filters within a " + state.walk + "-minute walk. Try turning a filter off."
        : "No council meters or car parks within a " + state.walk + "-minute walk of " + esc(state.dest.name) +
          ". This app covers paid street parking from the four Dublin councils, so street parking here is probably free and unmetered, but check the signs.") +
      (nextWalk ? '<br><button type="button" class="btn" id="widen">Show up to ' + nextWalk + " min walk</button>" : "") + "</li>";
    if (nextWalk) $("widen").onclick = () => { state.walk = nextWalk; render(); };
    return;
  }
  list.replaceChildren(...results.map((o, i) => card(o, i, arrive)));
}

function card(o, i, arrive) {
  const li = document.createElement("li");
  li.className = "card" + (state.open === o.id ? " open" : "");
  li.id = "r-" + o.id;
  const kindClass = o.kind === "carpark" ? "carpark" : o.cost === 0 ? "free" : "";
  const top = i === 0 && (state.sort === "closest" || o.cost !== null) ? '<span class="tag">' + SORTS[state.sort].label + "</span><br>" : "";

  let meta, price;
  if (o.kind === "meter") {
    meta = o.zoneLabel + " meter · " + o.walk + " min walk" + (o.overMax ? ' · <span class="live low">' + durationLabel(o.maxStay) + " limit</span>" : "");
    if (o.cost === 0) price = '<div class="price free">Free<small>' + (o.paidMins && o.freeMins ? "first " + o.freeMins + " min free" : o.schedule.days.some(Boolean) ? "outside paid hours" : "") + "</small></div>";
    else price = '<div class="price">' + money(o.cost) + "<small>for " + stayLabel(state.hours) + "</small></div>";
  } else {
    let live = "";
    if (o.live && o.live.free != null) live = ' · <span class="live' + (o.live.free < 30 ? " low" : "") + '">' + o.live.free + " spaces free</span>";
    meta = "Multi-storey car park · " + o.walk + " min walk" + live;
    price = '<div class="price unknown">Price at entrance</div>';
  }
  const main = document.createElement("button");
  main.type = "button"; main.className = "card-main"; main.setAttribute("aria-expanded", state.open === o.id);
  main.innerHTML = '<span class="badge ' + kindClass + '">' + (i + 1) + "</span><div>" + top + "<h3>" + esc(o.name) + '</h3><div class="meta">' + meta + "</div></div>" + price;
  main.onclick = () => openResult(state.open === o.id ? null : o.id, false);
  li.appendChild(main);
  if (state.open === o.id) li.appendChild(detail(o, arrive));
  return li;
}

function detail(o) {
  const d = document.createElement("div");
  d.className = "card-detail";
  let rows = "";
  if (o.kind === "meter") {
    const charging = chargingAt(o.schedule, arrivalTime());
    const priceText = o.perHour ? "€" + o.perHour.toFixed(2) + " per hour" + (o.sundayPerHour ? ", €" + o.sundayPerHour.toFixed(2) + " on Sunday afternoons" : "") + (o.dayCap ? ", or €" + o.dayCap.toFixed(2) + " all day" : "")
      : o.dayCap ? "€" + o.dayCap.toFixed(2) + " all day" : "Free";
    rows += "<dt>Price</dt><dd>" + priceText + " (" + esc(o.priceNote) + ")</dd>";
    rows += "<dt>Council</dt><dd>" + esc(o.council) + "</dd>";
    if (o.maxStay) rows += "<dt>Time limit</dt><dd>" + durationLabel(o.maxStay) + " during paid hours" + (o.overMax ? ". <strong>Your stay is longer than this.</strong>" : "") + "</dd>";
    rows += "<dt>You pay for</dt><dd>" + (o.paidMins ? Math.round(o.paidMins) + " of your " + Math.round(state.hours * 60) + " minutes" : "None of your stay") + "</dd>";
    rows += "<dt>Paid hours</dt><dd>" + esc(o.schedule.label) + (o.schedule.confirmed ? "" : " (usual hours, not confirmed for this meter)") + "</dd>";
    rows += "<dt>When you arrive</dt><dd>" + (charging ? "Charges apply" : "Free") + "</dd>";
    rows += "<dt>Meters here</dt><dd>" + (o.council === "South Dublin" ? "Paid parking along this street (council ref. " + esc(o.code) + ")"
      : o.meterCount + (o.meterCount === 1 ? " meter" : " meters") + " · nearest is no. " + esc(o.code)) + "</dd>";
  } else {
    rows += "<dt>Price</dt><dd>Not published as data. Shown at the entrance.</dd>";
    rows += "<dt>Spaces</dt><dd>" + (o.live && o.live.free != null ? o.live.free + " free (live, " + esc(o.live.updated || "recently") + ")"
      : o.live ? esc(o.live.status) : "Live spaces show when the site is online") + "</dd>";
    rows += "<dt>Location</dt><dd>Approximate, within about 100 m</dd>";
  }
  rows += "<dt>Walk</dt><dd>" + o.walk + " min (" + Math.round(o.m) + " m)</dd>";
  d.innerHTML = "<dl>" + rows + "</dl>" +
    '<div class="actions"><a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + o.lat + "," + o.lng + '">Directions</a>' +
    '<select aria-label="What’s wrong?"><option>Wrong price</option><option>Wrong hours</option><option>Meter missing</option><option>Car park full or closed</option><option>Other</option></select>' +
    '<button type="button" class="btn ghost">Report</button></div>';
  d.querySelector(".ghost").onclick = async () => {
    const type = d.querySelector("select").value;
    try { await Reports.save({ spotId: o.id, type }); Track.event("report"); toast("Thanks, report saved: " + type); }
    catch (e) { toast("Couldn’t save the report. Try again later."); }
  };
  return d;
}

function openResult(id, fromMap) {
  if (id) Track.event("open-result");
  state.open = id;
  render();
  if (id) {
    ParkingMap.focus(id);
    const el = $("r-" + id);
    if (el && fromMap) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

// ---------- events ----------
$("fFree").onchange = $("fCar").onchange = render;
// Typed-in stay length: hours box + minutes box. Updates as you type; blank counts as 0.
function readCustomStay() {
  const h = Math.max(0, Math.floor(Number($("stayH").value) || 0));
  const m = Math.max(0, Math.floor(Number($("stayM").value) || 0));
  let total = Math.min(h * 60 + m, MAX_STAY_HOURS * 60);
  if (total < 1) return; // wait until there's something to price
  state.hours = total / 60; state.customStay = true;
  render();
}
$("stayH").oninput = readCustomStay;
$("stayM").oninput = readCustomStay;
// When you leave the boxes, tidy them (e.g. 90 minutes becomes 1 hour 30).
$("stayCustom").addEventListener("focusout", () => setTimeout(renderControls, 0));
$("arriveAt").onchange = () => { const d = new Date($("arriveAt").value); if (!isNaN(d)) { state.arrive = d; render(); } };

// Search: suggestions as you type; Enter does a full search.
function showHits(found, q) {
  const hits = $("hits");
  if (!found.length) { hits.innerHTML = '<li class="msg">Nothing in Dublin matched “' + esc(q) + '”. Try adding the area, like “Main Street, Swords”, or tap the map.</li>'; return; }
  hits.replaceChildren(...found.map(d => {
    const li = document.createElement("li"), b = document.createElement("button");
    b.type = "button"; b.innerHTML = esc(d.name) + "<small>" + esc(d.full) + "</small>";
    b.onclick = () => { Track.event("search"); $("q").value = ""; setDestination({ name: d.name, lat: d.lat, lng: d.lng }); };
    li.appendChild(b); return li;
  }));
}
let searchSeq = 0, typingTimer = null;
$("q").addEventListener("input", () => {
  clearTimeout(typingTimer);
  const q = $("q").value.trim();
  if (q.length < 3) { $("hits").innerHTML = ""; return; }
  typingTimer = setTimeout(async () => {
    const my = ++searchSeq;
    try { const found = await Geocoder.suggest(q); if (my === searchSeq) showHits(found, q); }
    catch (err) { if (my === searchSeq) $("hits").innerHTML = '<li class="msg">Press Enter to search.</li>'; }
  }, 400);
});
$("searchForm").onsubmit = async e => {
  e.preventDefault();
  clearTimeout(typingTimer);
  const q = $("q").value.trim();
  if (q.length < 3) { $("hits").innerHTML = '<li class="msg">Type at least 3 letters.</li>'; return; }
  const my = ++searchSeq;
  $("hits").innerHTML = '<li class="msg">Searching…</li>';
  try { const found = await Geocoder.search(q); if (my === searchSeq) showHits(found, q); }
  catch (err) { if (my === searchSeq) $("hits").innerHTML = '<li class="msg error">Search didn’t work: ' + esc(err.message || err) + ". You can tap the map or use your location instead.</li>"; }
};

// "Use my location"
$("locate").onclick = () => {
  if (!navigator.geolocation) { toast("Your browser can’t share its location"); return; }
  toast("Finding you…");
  navigator.geolocation.getCurrentPosition(
    p => { Track.event("use-my-location"); setDestination({ name: "Your location", lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) }); },
    () => toast("Couldn’t get your location. Search or tap the map instead."),
    { enableHighAccuracy: true, timeout: 10000 });
};

// ---------- start ----------
const leaflet = ParkingMap.init("map", (lat, lng) => { Track.event("map-tap"); setDestination({ name: "Pinned spot", lat, lng }); });

// Live car park spaces: only when the site is hosted (the data comes through our own /api/carparks).
if (leaflet && typeof LiveCarparks !== "undefined" && location.protocol !== "file:") {
  const norm = s => String(s).toUpperCase().replace(/[^A-Z0-9]/g, "");
  LiveCarparks.subscribe(data => {
    if (!data) { state.live = null; render(); return; }
    const stale = data.feedAgeMinutes == null || data.feedAgeMinutes > 15;
    const byFeed = {};
    for (const cp of data.carparks || []) byFeed[norm(cp.name)] = cp;
    const live = {};
    for (const c of window.CARPARKS || []) {
      const cp = c.feed.map(n => byFeed[norm(n)]).find(Boolean);
      if (cp) live["c" + c.id] = { free: stale ? null : cp.freeSpaces, status: stale ? "Live data is out of date" : cp.status, updated: data.feedTime ? data.feedTime.slice(0, 5) : "" };
    }
    state.live = live; render();
  });
  try { LiveCarparks.start(leaflet, { pins: false }); } catch (e) { console.warn("[LiveCarparks]", e); }
}

render();
