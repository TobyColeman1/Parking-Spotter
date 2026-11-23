// Parking Spotter: live multi-storey car park spaces.
//
// This runs on Netlify's servers, not in the visitor's browser. The page asks
// /api/carparks for data; this function fetches Dublin City Council's live XML
// feed, turns it into simple JSON, and Netlify keeps that answer for 5 minutes.
// So the council gets at most one request every 5 minutes, however many
// people have the app open. It also avoids the browser's CORS block, because
// the page only ever talks to its own site.
//
// Data: Dublin City Council, "Multistorey Car Parking Space Availability",
// licensed CC BY 4.0. The app must show a credit.

const FEED_URL = "https://opendata.dublincity.ie/TrafficOpenData/CP_TR/CPDATA.xml";

export default async () => {
  try {
    const res = await fetch(FEED_URL, {
      headers: { "User-Agent": "ParkingSpotterDublin/1.0 (open data app)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Council feed answered ${res.status}`);
    const data = parseFeed(await res.text());
    if (data.carparks.length === 0) throw new Error("Council feed had no car parks in it");

    return Response.json(data, {
      headers: {
        // Browsers may reuse the answer for 1 minute.
        "Cache-Control": "public, max-age=60",
        // Netlify's shared cache keeps it for 5 minutes, then refreshes it in the
        // background while still serving the old copy for up to 1 more minute.
        "Netlify-CDN-Cache-Control": "public, durable, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    return Response.json(
      { error: "Live car park data is unavailable right now.", detail: String(err.message || err) },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
};

export const config = { path: "/api/carparks" };

// The feed looks roughly like:
//   <carparkData>
//     <Northwest><carpark name="PARNELL" spaces="123"></carpark>...</Northwest>
//     ...
//     <Timestamp>14:35:02</Timestamp>
//   </carparkData>
// "spaces" is a number, or blank / a word such as FULL or CLOSED.
// The parser is deliberately forgiving about the exact layout.
export function parseFeed(xml, now = new Date()) {
  const carparks = [];
  for (const m of xml.matchAll(/<carpark\b([^>]*?)\/?>/gi)) {
    const attrs = {};
    for (const a of m[1].matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)) attrs[a[1].toLowerCase()] = decode(a[2]).trim();
    if (!attrs.name) continue;
    const raw = attrs.spaces ?? "";
    const free = /^\d+$/.test(raw) ? Number(raw) : null;
    carparks.push({
      name: attrs.name,
      freeSpaces: free,
      status: free !== null ? (free === 0 ? "full" : "open") : raw ? raw.toLowerCase() : "unknown",
    });
  }
  const ts = xml.match(/<Timestamp>\s*([^<]*?)\s*<\/Timestamp>/i);
  const feedTime = ts ? ts[1] : null;
  return {
    source: "Dublin City Council",
    licence: "CC BY 4.0",
    feedTime,
    feedAgeMinutes: ageInMinutes(feedTime, now),
    fetchedAt: now.toISOString(),
    carparks,
  };
}

function decode(s) {
  return s.replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

// The feed's timestamp is a Dublin clock time with no date ("HH:MM:SS").
// Work out how many minutes ago that was; a time "in the future" means yesterday.
function ageInMinutes(feedTime, now) {
  const m = feedTime && feedTime.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/);
  if (!m) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Dublin", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const nowSec = get("hour") * 3600 + get("minute") * 60 + get("second");
  const feedSec = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] || 0);
  return Math.round((((nowSec - feedSec) % 86400) + 86400) % 86400 / 60);
}
