// Parking Spotter: live car park spaces on the map.
//
// How it works:
//  1. When the page opens, ask our own site for /api/carparks (the Netlify function).
//  2. Put a pin on each car park showing its free spaces.
//  3. Ask again every 5 minutes, but only while the tab is open and on screen.
//     Hidden tabs stop asking; when you come back, it refreshes straight away
//     if the numbers are more than 5 minutes old.
//  4. Pins go grey and say "not live" when a car park is full/closed/unknown,
//     or when the council's data is more than 15 minutes old.
//
// Needs: Leaflet (L), a Leaflet map, and window.CARPARK_LOCATIONS
// (from data/carpark-locations.js) to know where each car park is.
//
// Usage:  LiveCarparks.start(leafletMap);
//         LiveCarparks.start(leafletMap, { pins: false });  // fetch only, no pins of its own
//         LiveCarparks.subscribe(data => ...);  // data = feed JSON, or null when unavailable

const LiveCarparks = (() => {
  const API_URL = "/api/carparks";
  const EVERY_MS = 5 * 60 * 1000;
  const STALE_MINUTES = 15;

  let map = null, layer = null, info = null, timer = null, lastFetch = 0, showPins = true;
  const markers = {};
  const listeners = [];
  function subscribe(fn) { listeners.push(fn); }
  function notify(data) { for (const fn of listeners) { try { fn(data); } catch (e) { console.warn("[LiveCarparks]", e); } } }

  const key = (name) => String(name).toUpperCase().replace(/[^A-Z0-9]/g, "");

  function start(leafletMap, opts = {}) {
    if (map) return;
    map = leafletMap;
    showPins = opts.pins !== false;
    layer = L.layerGroup().addTo(map);
    addStyles();
    info = L.control({ position: "bottomleft" });
    info.onAdd = () => {
      const div = L.DomUtil.create("div", "lc-info");
      div.textContent = "Car parks: loading live spaces…";
      return div;
    };
    info.addTo(map);
    map.attributionControl.addAttribution("Car park data: Dublin City Council (CC BY 4.0)");
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && Date.now() - lastFetch >= EVERY_MS) refresh();
      else schedule();
    });
    refresh();
  }

  function schedule() {
    clearTimeout(timer);
    if (document.hidden) return;
    const wait = Math.max(0, EVERY_MS - (Date.now() - lastFetch));
    timer = setTimeout(refresh, wait);
  }

  async function refresh() {
    lastFetch = Date.now();
    try {
      const res = await fetch(API_URL, { cache: "no-cache" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      draw(data);
      notify(data);
    } catch (err) {
      setInfo("Car parks: live spaces unavailable right now", true);
      for (const k in markers) paint(markers[k], null, "not live");
      notify(null);
      console.warn("[LiveCarparks]", err);
    }
    schedule();
  }

  function draw(data) {
    const locations = {};
    for (const loc of window.CARPARK_LOCATIONS || []) locations[key(loc.name)] = loc;
    const stale = data.feedAgeMinutes == null || data.feedAgeMinutes > STALE_MINUTES;
    const missing = [];

    for (const cp of data.carparks) {
      const k = key(cp.name);
      const loc = locations[k] || (window.CARPARK_ALIASES && locations[key(window.CARPARK_ALIASES[k] || "")]);
      if (!showPins) continue;
      if (!loc) { missing.push(cp.name); continue; }
      if (!markers[k]) {
        markers[k] = L.marker([loc.lat, loc.lng], { icon: icon("…", true) }).addTo(layer);
      }
      const live = !stale && cp.freeSpaces !== null && cp.freeSpaces > 0;
      const label = cp.freeSpaces !== null ? String(cp.freeSpaces) : cp.status === "unknown" ? "?" : cp.status;
      paint(markers[k], { ...cp, label, live, name: loc.name || cp.name }, stale ? "data over 15 min old" : null);
    }

    const when = data.feedTime ? data.feedTime.slice(0, 5) : "unknown time";
    setInfo(stale ? `Car parks: not live (council data from ${when})` : `Car parks: live spaces, updated ${when}`, stale);
    if (missing.length) console.info("[LiveCarparks] No map position for:", missing.join(", "));
  }

  function paint(marker, cp, note) {
    if (!cp) {
      marker.setIcon(icon("–", true));
      marker.bindPopup(`<b>Car park</b><br>Not live: ${note}`);
      return;
    }
    marker.setIcon(icon(cp.label, !cp.live));
    const spaces = cp.freeSpaces !== null ? `${cp.freeSpaces} free spaces` : `Status: ${cp.status}`;
    marker.bindPopup(`<b>${escapeHtml(cp.name)}</b><br>${spaces}${note ? `<br><i>Not live: ${note}</i>` : ""}`);
  }

  function icon(text, grey) {
    return L.divIcon({
      className: "",
      html: `<div class="lc-pin${grey ? " lc-grey" : ""}"><span>P</span>${escapeHtml(String(text))}</div>`,
      iconSize: null,
      iconAnchor: [18, 14],
    });
  }

  function setInfo(text, warn) {
    const div = info && info.getContainer();
    if (!div) return;
    div.textContent = text;
    div.classList.toggle("lc-warn", !!warn);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function addStyles() {
    const css = `
      .lc-pin{display:inline-flex;align-items:center;gap:4px;padding:2px 7px 2px 3px;border-radius:12px;
        background:#1f6feb;color:#fff;font:600 12px/18px system-ui,sans-serif;white-space:nowrap;
        box-shadow:0 1px 3px rgba(0,0,0,.35);border:2px solid #fff}
      .lc-pin span{display:inline-block;width:18px;height:18px;border-radius:50%;background:#fff;color:#1f6feb;text-align:center}
      .lc-pin.lc-grey{background:#8a8f98}.lc-pin.lc-grey span{color:#8a8f98}
      .lc-info{background:rgba(255,255,255,.92);padding:4px 8px;border-radius:6px;font:12px system-ui,sans-serif;color:#222}
      .lc-info.lc-warn{color:#8a4b00}`;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  return { start, refresh, subscribe };
})();
