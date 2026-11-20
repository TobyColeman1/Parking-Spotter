# Parking Spotter Dublin

A small web app that finds the cheapest legal parking near where you're going in Dublin.
Open `index.html` in a browser to use it, keeping the `css`, `js` and `data` folders next to it. There's no build step and nothing to install: it's plain HTML, CSS and JavaScript.

## How it works

1. You pick where you're going. You can search an address, use your location, tap the map, or choose a quick pick.
2. You choose how long you're staying, when you'll arrive, and how far you'll walk.
3. The app checks every real council parking meter in County Dublin (Dublin City, Dún Laoghaire-Rathdown, Fingal and South Dublin) and every city-centre car park within that walk. For each meter it works out what your stay would actually cost, minute by minute, using that meter's paid hours. Time outside paid hours (evenings, Sundays) is free.
4. Meters on the same street are merged into one result. Results are sorted by cheapest, closest or best value (a minute of walking counts as about 15c).

## What each file does

| File | What it's for |
|---|---|
| `index.html` | The page: search box, controls, results list and map. It loads all the other files. |
| `css/styles.css` | How it looks, including dark mode. Phones get the map on top with the list below. Wide screens get the list beside the map. |
| `data/meters.js` | All 795 council meters: position, zone and paid hours. Built by `tools/build-meters.js`, so don't edit it by hand. |
| `data/dlr-meters.js`, `data/fcc-meters.js`, `data/sdcc-meters.js` | Meters for Dún Laoghaire-Rathdown (344), Fingal (139) and South Dublin (78 paid streets), each with its own prices and hours. Built by `tools/convert-councils.py` from the downloads in `data/raw/`. Sources and gaps are in `data/COUNCIL-DATA.md`. |
| `data/carparks.js` | 14 city-centre multi-storey car parks. Their positions are **approximate** (about 100 m). |
| `data/carpark-locations.js` | Exact car park positions for the live pins, once `tools/make_carpark_locations.py` fills it. |
| `js/pricing.js` | The rules: zone prices, paid hours, cost of your stay, distance and sorting. It never touches the page. |
| `js/map.js` | The street map (Leaflet + OpenStreetMap). It's the only file that knows about the map library. |
| `js/search.js` | Address search: Photon, with Nominatim as a back-up. |
| `js/live-carparks.js` | Fetches live free spaces from `/api/carparks` every 5 minutes. This only works on the hosted site. |
| `netlify/functions/carparks.mjs` | (in the hosting copy) Runs on Netlify and fetches the council's live car park feed. |
| `js/reports.js` | The "Report" button. It currently saves to this browser only. Supabase plugs in here. |
| `js/app.js` | Ties it all together: your choices, the results cards, the details and the map pins. |
| `tools/convert-councils.py` | Rebuilds the three other-council files from `data/raw/`. Run it with `python3 tools/convert-councils.py`. |
| `tools/build-meters.js` | Rebuilds `data/meters.js` from the council CSV files in this folder. Run it with `node tools/build-meters.js`. |

`data/spots.js` and `data/dcc-meters.js` belong to the older version and are no longer loaded. They're kept only because `tools/check-data.js` reads them. The original single-file app, `Parking Spotter Dublin.html`, is also kept for reference.

## Where the data comes from, and what it can't tell you

- **Meter positions and zones:** `dublin_terminals_coordinates_19062025.csv` (June 2025).
- **Prices:** the council's 2022 zone map. Yellow is €3.50/h, Red €3.00, Green €1.80, Orange €1.10 and Blue €0.80. Prices may have changed since 2022.
- **Paid hours:** each meter takes its hours from the nearest meter on the 2021 list, within 40 m. That matched 705 of the 795 meters. The other 90 assume the usual Mon–Sat 07:00–19:00 and say "not confirmed".
- **Other councils:** Dún Laoghaire-Rathdown fees are current but meter positions are from a 2018 survey, and paid hours run to 7pm. Fingal doesn't publish prices per meter, so all its meters use the usual €1.20/h. South Dublin is €1/h with the first 30 minutes free (€0.50 minimum), and 8 of its 86 streets have no position so they're left out. Time limits are shown for these councils and the app warns when your stay is longer. Details in `data/COUNCIL-DATA.md`.
- **Not covered:** Dublin City maximum-stay limits, clearways, loading bays, private car park prices, and free unmetered streets. Outside the four councils' paid areas, the app says it has no data rather than guessing.
- **Car park prices** aren't published as data, so they show "Price at entrance". Car parks are always listed when they're in range.

## Costs and limits

- **Map:** Leaflet and OpenStreetMap tiles are free with no key. Under the [tile policy](https://operations.osmfoundation.org/policies/tiles/), keep the credit visible and avoid heavy traffic. If the site gets busy, switch to MapTiler, Stadia or Thunderforest, which is a one-line change in `js/map.js`.
- **Search:** Photon is free with no key, allows suggestions as you type, and works when the page is opened from your computer. Nominatim is also free, but allows only 1 search per second and no typing suggestions. It's used only as a back-up when you press Enter.
- **Use my location** needs your permission. Some browsers only allow it on a hosted (https) site.
