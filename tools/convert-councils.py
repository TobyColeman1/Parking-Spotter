#!/usr/bin/env python3
"""Convert Dún Laoghaire-Rathdown, Fingal and South Dublin parking meter
open data (in data/raw/) into the same shape as data/dcc-meters.js.

Each output file defines:
  window.<X>_ZONES      list of tariff group names (like DCC_ZONES)
  window.<X>_ZONE_INFO  one entry per zone: price per hour, all-day price,
                        max stay in minutes (0 = no limit), paid hours, note
  window.<X>_METERS     rows of [latitude, longitude, zone index, address, meter code]

Run from the "Parking Spotter" folder:  python3 tools/convert-councils.py
"""
import csv, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "..", "data", "raw")
OUT = os.path.join(HERE, "..", "data")


def read_csv(name):
    with open(os.path.join(RAW, name), encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def write_js(prefix, header, zones, info, rows):
    path = os.path.join(OUT, prefix.lower() + "-meters.js")
    with open(path, "w", encoding="utf-8") as f:
        f.write(header)
        f.write("window.%s_ZONES=%s;\n" % (prefix, json.dumps(zones, ensure_ascii=False)))
        f.write("window.%s_ZONE_INFO=[\n%s\n];\n" % (prefix, ",\n".join(json.dumps(i, ensure_ascii=False) for i in info)))
        f.write("window.%s_METERS=[\n%s\n];\n" % (prefix, ",\n".join(json.dumps(r, ensure_ascii=False) for r in rows)))
    return path, len(rows)


def money(s):
    return float(s.replace("€", ""))


# ---------- Dún Laoghaire-Rathdown ----------
# The CSV has current fees and max stay but no coordinates; the GeoJSON has
# coordinates but older tariffs. Join them on meter number (+ location for
# meter 627, which appears twice).
def dlr():
    rows = read_csv("dlr_parking_meter.csv")
    with open(os.path.join(RAW, "dlr_parking_meter.geojson"), encoding="utf-8") as f:
        feats = json.load(f)["features"]
    geo = {}
    for ft in feats:
        p = ft["properties"]
        lng, lat = ft["geometry"]["coordinates"][:2]
        geo[(str(p["Meter_Number"]), p["Location"].strip())] = (lat, lng)
        geo.setdefault(str(p["Meter_Number"]), (lat, lng))
    zones, info, out, missing = [], [], [], []
    for r in rows:
        fee, stay = r["Parking Fee"].strip(), r["Maximum Stay"].strip()
        name = fee + (" · " + stay.replace("Max ", "max ") if stay.startswith("Max") else " · no time limit")
        if name not in zones:
            m = re.match(r"€([\d.]+)/hour(?: or €([\d.]+) all day)?", fee)
            sm = re.match(r"Max (\d+) hours?", stay)
            zones.append(name)
            info.append({"price": float(m.group(1)), "day": float(m.group(2)) if m.group(2) else None,
                         "max": int(sm.group(1)) * 60 if sm else 0,
                         "paid": [8, 19], "hours": "Mon–Sat 8am–7pm",
                         "note": "DLR " + r["Tariff Area"].strip().lower() + " rate (2018 survey positions; fees from current CSV)"})
        key = (r["Meter Number"], r["Street / Car Park"].strip())
        ll = geo.get(key) or geo.get(r["Meter Number"])
        if not ll:
            missing.append(r["Meter Number"]); continue
        addr = r["Street / Car Park"].strip()
        if r["Area/Town"].strip() and r["Area/Town"].strip() not in addr:
            addr += ", " + r["Area/Town"].strip()
        code = r["Identifier"].strip() or "M" + r["Meter Number"]
        out.append([round(ll[0], 6), round(ll[1], 6), zones.index(name), addr, code])
    hdr = ("// Dún Laoghaire-Rathdown County Council pay and display meters.\n"
           "// Source: 'Parking Meters, Signs & Runs DLR', data.smartdublin.ie / data.gov.ie, CC BY 4.0.\n"
           "// Fees, hours and max stay from dlr_parking_meter.csv; positions from dlr_parking_meter.geojson (2018 survey).\n"
           "// Each row: [latitude, longitude, zone index into DLR_ZONES, address, meter code]\n")
    return write_js("DLR", hdr, zones, info, out), missing


# ---------- Fingal ----------
# Has positions only. The council's dataset description gives one tariff:
# €1.20/hour Mon–Sat 8am–6pm (€3 a day in long-term areas, not marked per meter).
def fcc():
    rows = read_csv("fcc_pay_and_display_meters.csv")
    zones = ["Fingal pay and display"]
    info = [{"price": 1.20, "day": None, "max": 0, "paid": [8, 18], "hours": "Mon–Sat 8am–6pm",
             "note": "Usual Fingal rate from the council's dataset description (March 2024). Some long-term areas are €3 a day. Check the meter."}]
    out = []
    for r in rows:
        if not r["Lat"] or not r["Long"]:
            continue
        addr = r["Street_Name"].strip() + ", " + r["Location"].strip()
        code = ("F" + r["Meter_ID"].strip()) if r["Meter_ID"].strip() else "F-obj" + r["ObjectId"]
        out.append([round(float(r["Lat"]), 6), round(float(r["Long"]), 6), 0, addr, code])
    hdr = ("// Fingal County Council pay and display meters.\n"
           "// Source: 'Pay and Display Meter Locations FCC', data.fingal.ie / data.gov.ie, CC BY 4.0 (dated 2024-03-05).\n"
           "// The data has no per-meter prices; the single zone uses the usual rate stated by the council.\n"
           "// Each row: [latitude, longitude, zone index into FCC_ZONES, address, meter code]\n")
    return write_js("FCC", hdr, zones, info, out)


# ---------- South Dublin ----------
# Each row is a stretch of street with a tariff type (A or B).
def sdcc():
    rows = read_csv("sdcc_parking_meters.csv")
    zones = ["Tariff A", "Tariff B"]
    info = [
        {"price": 1.00, "day": None, "max": 180, "paid": [8, 18], "hours": "Mon–Sat 8am–6pm",
         "note": "€1/hour; first 30 minutes free; €0.50 minimum after the free period. Max 3 hours."},
        {"price": 0, "day": 3.00, "max": 0, "paid": [8, 18], "hours": "Mon–Sat 8am–6pm",
         "note": "€3 all day (park and ride)."},
    ]
    out, skipped = [], []
    for r in rows:
        name = re.sub(r"\s+", " ", r["Street___Address_Name"]).strip()
        if not r["X"] or not r["Y"]:
            skipped.append(name + ", " + r["Area_Town"]); continue
        zi = 1 if r["Tariff_Type"].strip() == "B" else 0
        out.append([round(float(r["Y"]), 6), round(float(r["X"]), 6), zi,
                    name + ", " + r["Area_Town"].strip(), "S" + r["OBJECTID"]])
    hdr = ("// South Dublin County Council pay and display streets.\n"
           "// Source: 'Parking Meters SDCC', data-sdublincoco.opendata.arcgis.com / data.gov.ie, CC BY 4.0 (dated 2026-05-18).\n"
           "// Each row is one paid stretch of street, placed at the point the council gives.\n"
           "// Each row: [latitude, longitude, zone index into SDCC_ZONES, address, row code]\n")
    return write_js("SDCC", hdr, zones, info, out), skipped


if __name__ == "__main__":
    (p, n), miss = dlr(); print(p, n, "rows; no position for:", miss)
    p, n = fcc(); print(p, n, "rows")
    (p, n), skip = sdcc(); print(p, n, "rows; skipped (no position):", skip)
