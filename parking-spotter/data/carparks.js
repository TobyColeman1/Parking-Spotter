// Dublin city centre multi-storey car parks in the council's live spaces feed.
// Positions are APPROXIMATE (typed in by hand, accurate to roughly 100 m), and prices
// are not in any council dataset, so the app shows "price at entrance" instead of guessing.
// Replace with an exact list (e.g. from the council's car_parks_location file) when available.
// `feed` lists the names this car park may use in the live feed (/api/carparks).
window.CARPARKS = [
  { id: "parnell",   name: "Parnell Centre Car Park",       lat: 53.3524, lng: -6.2632, feed: ["PARNELL"] },
  { id: "ilac",      name: "ILAC Centre Car Park",          lat: 53.3503, lng: -6.2660, feed: ["ILAC"] },
  { id: "jervis",    name: "Jervis Centre Car Park",        lat: 53.3480, lng: -6.2670, feed: ["JERVIS"] },
  { id: "arnotts",   name: "Arnotts Car Park",              lat: 53.3489, lng: -6.2610, feed: ["ARNOTTS"] },
  { id: "marlboro",  name: "Marlborough Street Car Park",   lat: 53.3512, lng: -6.2585, feed: ["MARLBORO", "MARLBOROUGH"] },
  { id: "abbey",     name: "Abbey Street Car Park",         lat: 53.3490, lng: -6.2560, feed: ["ABBEY"] },
  { id: "thomas",    name: "Thomas Street Car Park",        lat: 53.3434, lng: -6.2800, feed: ["THOMASST", "THOMAS STREET"] },
  { id: "christch",  name: "Christchurch Car Park",         lat: 53.3424, lng: -6.2706, feed: ["C/CHURCH", "CHRISTCHURCH"] },
  { id: "drury",     name: "Drury Street Car Park",         lat: 53.3418, lng: -6.2637, feed: ["DRURY"] },
  { id: "greenrcs",  name: "Stephen’s Green Shopping Centre Car Park", lat: 53.3396, lng: -6.2624, feed: ["GREENRCS", "STEPHENS GREEN"] },
  { id: "trinity",   name: "Trinity Street Car Park",       lat: 53.3437, lng: -6.2622, feed: ["TRINITY"] },
  { id: "dawson",    name: "Dawson Street Car Park",        lat: 53.3404, lng: -6.2583, feed: ["DAWSON"] },
  { id: "setanta",   name: "Setanta Car Park",              lat: 53.3409, lng: -6.2553, feed: ["SETANTA"] },
  { id: "brunswick", name: "Brunswick Street Car Park",     lat: 53.3444, lng: -6.2475, feed: ["BRUNSWICK"] }
];
