// Parking Spotter: the street map (Leaflet + OpenStreetMap tiles, free, no key).
// Only this file talks to Leaflet.

const ParkingMap = (() => {
  let map = null, layer = null, lastView = "";
  const markers = {};
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // onMapTap(lat, lng) is called when someone taps an empty part of the map.
  function init(elementId, onMapTap) {
    if (typeof L === "undefined") {
      document.getElementById(elementId).innerHTML =
        '<p class="map-error">The map couldn’t load. Check your internet connection and refresh.</p>';
      return null;
    }
    map = L.map(elementId, { scrollWheelZoom: false, zoomControl: true }).setView([53.3473, -6.2591], 15);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    layer = L.layerGroup().addTo(map);
    map.on("click", e => onMapTap(+e.latlng.lat.toFixed(5), +e.latlng.lng.toFixed(5)));
    return map;
  }

  function pinClass(o) { return o.kind === "carpark" ? "pin-carpark" : o.cost === 0 ? "pin-free" : "pin-paid"; }

  // Draw the destination, the walking range and the numbered results.
  function draw(results, dest, maxWalkMetres, selectedId, onSelect) {
    if (!map) return;
    layer.clearLayers();
    for (const k in markers) delete markers[k];
    const c = [dest.lat, dest.lng];
    L.circle(c, { radius: maxWalkMetres, color: "#4b5563", weight: 1.5, dashArray: "5 6", fillColor: "#4b5563", fillOpacity: 0.04, interactive: false }).addTo(layer);
    L.marker(c, { icon: L.divIcon({ className: "", html: '<div class="pin-dest"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }), zIndexOffset: 2000, keyboard: false })
      .bindTooltip(esc(dest.name), { direction: "top", offset: [0, -10] }).addTo(layer);

    results.forEach((o, i) => {
      const sel = o.id === selectedId, size = sel ? 34 : 28;
      const m = L.marker([o.lat, o.lng], {
        title: o.name, zIndexOffset: sel ? 1500 : 1000 - i, riseOnHover: true,
        icon: L.divIcon({ className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2],
          html: '<div class="pin ' + pinClass(o) + (sel ? " pin-sel" : "") + '">' + (i + 1) + "</div>" })
      });
      m.on("click", ev => { L.DomEvent.stopPropagation(ev); onSelect(o.id); });
      m.bindTooltip(esc(o.name), { direction: "top", offset: [0, -12] });
      m.addTo(layer);
      markers[o.id] = m;
    });

    // Re-frame the map only when the destination or walking range changes.
    const view = dest.lat + "," + dest.lng + "," + maxWalkMetres;
    if (view !== lastView) {
      map.fitBounds(L.latLng(c).toBounds(maxWalkMetres * 2.1), { animate: false });
      lastView = view;
    }
  }

  function focus(id) {
    const m = markers[id];
    if (m && map) { map.panTo(m.getLatLng()); m.openTooltip(); }
  }

  function invalidate() { if (map) map.invalidateSize(); }

  return { init, draw, focus, invalidate };
})();
