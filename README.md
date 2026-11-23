# Parking Spotter Dublin

A small web app that finds the cheapest legal parking near a destination in
Dublin city centre. Pick where you're going and how long you'll stay, and it
ranks nearby car parks, pay-and-display streets and free streets by price,
walking distance or overall value.

> Prototype: meter locations and paying hours come from the four Dublin councils'
> open data, but check the signs on the street before you rely on them.

## What's in this folder

| File | What it is |
| --- | --- |
| `index.html` | The page itself: layout and the list of scripts to load. Hosts open `index.html` automatically. |
| `css/styles.css` | How the app looks (colours, spacing, light and dark mode). |
| `js/app.js` | Starts the app and connects all the parts. |
| `js/map.js` | The interactive map (Leaflet + OpenStreetMap). |
| `js/search.js` | Address search, using OpenStreetMap services (Photon and Nominatim). |
| `js/pricing.js` | Works out what parking costs for your arrival time and stay. |
| `js/live-carparks.js` | Adds live free spaces in council multi-storey car parks to the results. |
| `js/reports.js` | Saves "report incorrect info" notes in the visitor's own browser. |
| `data/meters.js` | Dublin City Council parking meters: locations, zones and paying hours. |
| `data/dlr-meters.js`, `data/fcc-meters.js`, `data/sdcc-meters.js` | Meters for Dún Laoghaire-Rathdown, Fingal and South Dublin, with their own prices and hours. |
| `data/carparks.js` | City centre multi-storey car parks (approximate positions). |
| `data/carpark-locations.js` | Positions used to match car parks to the live feed. |
| `netlify/functions/carparks.mjs` | Runs on Netlify's servers: fetches the council's live car park feed and caches it for 5 minutes. |
| `netlify.toml` | Settings for Netlify: no build step, serve this folder as-is, plus a few safety headers. |
| `README.md` | This file. |
| `data/dcc-meters.js` | Locations of 795 Dublin City Council parking meters, shown on the map. |

## Try it on your computer

Double-click `index.html` to open it in your browser. Nothing to install.

The map tiles and the Leaflet library load from the internet, so you need to
be online. If the map looks blank, run a tiny local server from this folder
instead:

```
python3 -m http.server 8000
```

then open http://localhost:8000.

## Publish it

Hosted free on [Netlify](https://www.netlify.com/). The quickest way is
Netlify Drop: drag this folder onto https://app.netlify.com/drop and you get
a public link in a few seconds. See the publishing guide for the full steps,
including how to update the site and connect GitHub later.

## Data sources

Meter data comes from Dublin City Council, Dún Laoghaire-Rathdown, Fingal and
South Dublin County Councils (all CC BY 4.0; see `data/COUNCIL-DATA.md` in the
project folder for links and gaps). Map tiles are © OpenStreetMap contributors.
Copy only what the app needs into `data/` so the published site stays small.

## Live car park spaces

The live car park feature uses a Netlify function (`netlify/functions/`,
served at `/api/carparks`). Netlify Drop (drag and drop) doesn't deploy
functions, so that feature only works when the site is published from a
GitHub repository linked to Netlify, or with the Netlify CLI
(`netlify deploy --prod`). The rest of the site works with drag and drop.
