// Parking Spotter: address search (geocoding). Free, no account, no key.
//
// Two free OpenStreetMap-based services, tried in order:
//   1. Photon (photon.komoot.io): allows suggestions as you type and works when the page
//      is opened straight from your computer (double-clicking index.html).
//   2. Nominatim (nominatim.openstreetmap.org): used as a back-up when you press Enter.
//      Its rules allow at most 1 search per second and no search-as-you-type, and it can refuse
//      pages opened from your computer (they send no web address), which is why it's second.
// To switch provider later, only this file needs to change: search() must return
// a list of { name, full, lat, lng }.

const Geocoder = (() => {
  // Rough box around County Dublin, so "Main Street" finds a Dublin one.
  const W = -6.55, S = 53.20, E = -6.00, N = 53.65;
  const inDublin = (lat, lng) => lat >= S && lat <= N && lng >= W && lng <= E;
  const round = n => +(+n).toFixed(5);
  let lastNominatim = 0;

  async function getJson(url) {
    let res;
    try { res = await fetch(url, { headers: { Accept: "application/json" } }); }
    catch (e) { throw new Error("couldn’t reach the search service (are you online?)"); }
    if (!res.ok) throw new Error("the search service refused the request (error " + res.status + ")");
    return res.json();
  }

  async function photon(query) {
    const url = "https://photon.komoot.io/api/?" + new URLSearchParams({
      q: query, limit: "8", lang: "en", lat: "53.35", lon: "-6.26", bbox: [W, S, E, N].join(",")
    });
    const data = await getJson(url);
    return (data.features || [])
      .map(f => {
        const p = f.properties || {}, [lng, lat] = f.geometry.coordinates;
        const street = [p.housenumber, p.street].filter(Boolean).join(" ");
        const name = p.name || street || p.district || p.city || "Unnamed place";
        const parts = [name, p.name && street ? street : "", p.district, p.city, p.postcode]
          .filter((x, i, a) => x && a.indexOf(x) === i);
        return { name: parts.slice(0, 2).join(", "), full: parts.join(", "), lat: round(lat), lng: round(lng), cc: p.countrycode };
      })
      .filter(r => (!r.cc || r.cc === "IE") && inDublin(r.lat, r.lng))
      .slice(0, 5);
  }

  async function nominatim(query) {
    const wait = 1000 - (Date.now() - lastNominatim);
    if (wait > 0) await new Promise(r => setTimeout(r, wait)); // 1 request per second
    lastNominatim = Date.now();
    const url = "https://nominatim.openstreetmap.org/search?" + new URLSearchParams({
      q: query, format: "jsonv2", limit: "5", countrycodes: "ie",
      viewbox: [W, N, E, S].join(","), bounded: "1", "accept-language": "en"
    });
    const rows = await getJson(url);
    return rows.map(r => ({
      name: r.display_name.split(",").slice(0, 2).join(",").trim(),
      full: r.display_name, lat: round(r.lat), lng: round(r.lon)
    }));
  }

  // Suggestions while typing: Photon only (Nominatim doesn't allow this).
  function suggest(query) { return photon(query); }

  // Full search (Enter / Search button): Photon, then Nominatim if Photon fails or finds nothing.
  async function search(query) {
    let firstError = null;
    try { const r = await photon(query); if (r.length) return r; } catch (e) { firstError = e; }
    try { return await nominatim(query); }
    catch (e) { throw firstError || e; }
  }

  return { search, suggest };
})();
