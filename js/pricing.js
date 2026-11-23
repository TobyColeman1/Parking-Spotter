// Parking Spotter: pricing and ranking.
// Pure functions: data in, answers out. Nothing here touches the page or the map.

// €/hour per council zone, from the council's 2022 parking zone map (parking-zone-maps-2022.pdf).
const ZONE_PRICE = { Yellow: 3.5, Red: 3.0, Green: 1.8, Orange: 1.1, Blue: 0.8 };
// The same map has a separate Sunday rate: €1.60/h, 2pm to 6pm, in the city centre.
// It applies to meters whose paid hours include "Sun 14:00–18:00" (all of them Yellow zone).
const SUNDAY_PRICE = 1.6;
const SUNDAY_HOURS = [14 * 60, 18 * 60];
function hasSundayRate(schedule) {
  const sun = schedule && schedule.days[0];
  return !!(sun && sun[0] === SUNDAY_HOURS[0] && sun[1] === SUNDAY_HOURS[1]);
}
const WALK_METRES_PER_MIN = 80; // relaxed walking pace

// Straight-line distance in metres (fine over a few km).
function distanceMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000, r = Math.PI / 180;
  const x = (lng2 - lng1) * r * Math.cos((lat1 + lat2) / 2 * r), y = (lat2 - lat1) * r;
  return Math.hypot(x, y) * R;
}

// The three other Dublin councils. Each data file (data/dlr-meters.js etc., built by
// tools/convert-councils.py) carries its own prices and hours in *_ZONE_INFO.
const OTHER_COUNCILS = [
  { key: "DLR",  name: "Dún Laoghaire-Rathdown" },
  { key: "FCC",  name: "Fingal" },
  { key: "SDCC", name: "South Dublin" }
];

// Turn a council's zone info ({ price, day, max, paid: [startHour, endHour], hours, note })
// into the same timetable shape as Dublin City's (paid Monday to Saturday).
function councilSchedule(info) {
  const span = [info.paid[0] * 60, info.paid[1] * 60];
  return { label: info.hours, days: [null, span, span, span, span, span, span], confirmed: true };
}

// All the places you could park, in one shape:
// { id, kind: "meter" | "carpark", council, name, lat, lng, zone?, perHour (null = unknown), schedule?, code?, feed?,
//   dayCap?, maxStay? (minutes), freeMins?, minCharge?, priceNote? }
function buildOptions() {
  const meters = (window.METERS || []).map(([lat, lng, zi, address, code, si]) => {
    const zone = METER_ZONES[zi];
    return { id: "m" + code, kind: "meter", council: "Dublin City", name: address || "Parking meter " + code, lat, lng, zone,
      zoneLabel: zone + " zone", perHour: ZONE_PRICE[zone], schedule: METER_SCHEDULES[si], code,
      sundayPerHour: hasSundayRate(METER_SCHEDULES[si]) ? SUNDAY_PRICE : null,
      priceNote: zone + " zone, 2022 rate" };
  });
  const others = OTHER_COUNCILS.flatMap(c => {
    const rows = window[c.key + "_METERS"], zones = window[c.key + "_ZONES"], infos = window[c.key + "_ZONE_INFO"];
    if (!rows || !zones || !infos) return [];
    return rows.map(([lat, lng, zi, address, code], i) => {
      const info = infos[zi], zone = zones[zi];
      const sdccA = c.key === "SDCC" && info.price > 0; // "first 30 minutes free, €0.50 minimum"
      return { id: c.key.toLowerCase() + i + "-" + code, kind: "meter", council: c.name, name: address, lat, lng, zone,
        zoneLabel: c.name, perHour: info.price, dayCap: info.day, maxStay: info.max || 0,
        freeMins: sdccA ? 30 : 0, minCharge: sdccA ? 0.5 : 0,
        schedule: councilSchedule(info), code, priceNote: info.note };
    });
  });
  const carparks = (window.CARPARKS || []).map(c => ({ ...c, id: "c" + c.id, kind: "carpark", council: "Dublin City", perHour: null }));
  return [...meters, ...others, ...carparks];
}

// What a stay costs at a meter, given the minutes that fall in paid hours.
// sundayMins = how many of those minutes are on a Sunday (charged at the Sunday rate, if the meter has one).
function meterCost(opt, paidMins, sundayMins = 0) {
  if (!paidMins) return 0;
  const billable = Math.max(0, paidMins - (opt.freeMins || 0));
  if (!billable) return 0;
  const sunMins = opt.sundayPerHour ? Math.min(sundayMins, billable) : 0;
  let cost = (opt.perHour * (billable - sunMins) + (opt.sundayPerHour || 0) * sunMins) / 60;
  if (opt.minCharge) cost = Math.max(cost, opt.minCharge);
  if (opt.dayCap) cost = opt.perHour ? Math.min(cost, opt.dayCap) : opt.dayCap; // all-day ticket, or day-only tariff
  return Math.round(cost * 100) / 100;
}

// Minutes you'd have to pay for, between arrival and leaving, using the meter's paid hours.
function paidMinutes(schedule, arrive, hours) {
  return paidMinutesSplit(schedule, arrive, hours).total;
}
// Same, but also says how many of the paid minutes fall on a Sunday.
function paidMinutesSplit(schedule, arrive, hours) {
  const stayMins = Math.round(hours * 60); // any whole number of minutes, e.g. 85
  if (!schedule) return { total: stayMins, sunday: 0 }; // no timetable known: assume you pay throughout
  let paid = 0, sunday = 0;
  const t = new Date(arrive);
  // Check the stay in 5-minute slices (the last slice can be shorter, so 1h 27m counts exactly 87 minutes).
  for (let m = 0; m < stayMins; m += 5) {
    const step = Math.min(5, stayMins - m);
    const day = schedule.days[t.getDay()], minute = t.getHours() * 60 + t.getMinutes();
    if (day && minute >= day[0] && minute < day[1]) { paid += step; if (t.getDay() === 0) sunday += step; }
    t.setMinutes(t.getMinutes() + step);
  }
  return { total: paid, sunday };
}

// Is the meter charging at this moment?
function chargingAt(schedule, when) {
  const day = schedule && schedule.days[when.getDay()], minute = when.getHours() * 60 + when.getMinutes();
  return !!(day && minute >= day[0] && minute < day[1]);
}

// Work out one option for a trip. cost = null means "we don't know the price".
function evaluate(opt, dest, hours, arrive, live) {
  const m = distanceMetres(dest.lat, dest.lng, opt.lat, opt.lng);
  const walk = Math.max(1, Math.round(m / WALK_METRES_PER_MIN));
  let cost = null, paidMins = null;
  if (opt.kind === "meter") {
    const split = paidMinutesSplit(opt.schedule, arrive, hours);
    paidMins = split.total;
    cost = meterCost(opt, paidMins, split.sunday);
  }
  // Longer than the street's time limit, during paid hours? (Only known outside Dublin City.)
  const overMax = !!(opt.maxStay && paidMins > opt.maxStay);
  const liveInfo = opt.kind === "carpark" && live ? live[opt.id] || null : null;
  const full = !!(liveInfo && (liveInfo.status === "full" || liveInfo.status === "closed" || liveInfo.free === 0));
  return { ...opt, m, walk, cost, paidMins, overMax, live: liveInfo, full };
}

// How each sort orders results. Unknown prices go after known ones when sorting by price.
const SORTS = {
  // Price first (in whole cents), then distance only to break ties. Metres stay below 100,000,
  // so they can never outweigh even a 1c price difference.
  cheapest: { label: "Cheapest",   key: o => (o.cost === null ? 1e12 : Math.round(o.cost * 100) * 1e5) + o.m },
  closest:  { label: "Closest",    key: o => o.m },
  value:    { label: "Best value", key: o => (o.cost === null ? 1e6 : o.cost) + o.walk * 0.15 } // a minute's walk ≈ 15c
};

// Rank everything within walking range. Meters on the same street are merged into one result
// (the closest meter to your destination), so the list shows streets, not 20 identical meters.
function rankOptions(options, { dest, hours, arrive, maxWalkMin, sort, freeOnly, carParksOnly, live }) {
  const maxM = maxWalkMin * WALK_METRES_PER_MIN;
  const byStreet = new Map();
  for (const o of options) {
    if (carParksOnly && o.kind !== "carpark") continue;
    const e = evaluate(o, dest, hours, arrive, live);
    if (e.m > maxM) continue;
    if (freeOnly && e.cost !== 0) continue;
    if (e.full) continue;
    const key = e.kind === "meter" ? e.council + "|" + e.name.toLowerCase().replace(/[^a-z0-9]/g, "") + "|" + e.zone : e.id;
    const prev = byStreet.get(key);
    if (!prev) byStreet.set(key, { ...e, meterCount: 1 });
    else { const best = e.m < prev.m ? e : prev; byStreet.set(key, { ...best, meterCount: prev.meterCount + 1 }); }
  }
  const k = SORTS[sort].key;
  return [...byStreet.values()].sort((a, b) => k(a) - k(b));
}

function money(n) { return n === 0 ? "Free" : "€" + n.toFixed(2); }
