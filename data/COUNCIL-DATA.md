# Parking data for the other Dublin councils

Downloaded 20 November 2026. All three datasets are published by the councils under **Creative Commons Attribution 4.0**. You can use them in the app as long as you credit the council, for example: "Contains data from Dún Laoghaire-Rathdown, Fingal and South Dublin County Councils (CC BY 4.0)".

## What was made

| File | Council | Rows | Prices |
|---|---|---|---|
| `data/dlr-meters.js` | Dún Laoghaire-Rathdown | 344 meters | Per meter, €1.60 or €2.00/h, some with all-day rates |
| `data/fcc-meters.js` | Fingal | 139 meters | One usual rate, €1.20/h (not per meter) |
| `data/sdcc-meters.js` | South Dublin | 78 streets | €1/h with first 30 min free (one park and ride at €3/day) |

Each file has the same row shape as `dcc-meters.js`: `[latitude, longitude, zone index, address, code]`, plus a `*_ZONES` list of names. Dublin City's zone prices are typed into `index.html`, so each new file also carries a `*_ZONE_INFO` list (price per hour, all-day price, max stay in minutes, paid hours, note) so the app doesn't need prices typed in for them.

The original downloads are in `data/raw/`, and `tools/convert-councils.py` rebuilds the three files from them (`python3 tools/convert-councils.py`).

## Sources

- **Dún Laoghaire-Rathdown**: [Parking Meters, Signs & Runs DLR](https://data.gov.ie/dataset/parking-meters-dlr). Files used: `dlr_parking_meter.csv` (current fees, hours, max stay; no coordinates) and `dlr_parking_meter.geojson` (coordinates). They are joined on meter number. Updated September 2026.
- **Fingal**: [Pay and Display Meter Locations FCC](https://data.gov.ie/en_GB/dataset/pay-and-display-meter-locations-fcc2) (also on [data.fingal.ie](https://data.fingal.ie/datasets/FingalCoCo::pay-and-display-meter-locations-fcc)). Dated March 2024.
- **South Dublin**: [Parking Meters SDCC](https://data.gov.ie/dataset/parking-meters-sdcc1) (also on [the SDCC open data hub](https://data-sdublincoco.opendata.arcgis.com/datasets/sdublincoco::parking-meters-sdcc-1)). Dated May 2026.
- Extra, not converted: [Zoned Areas for Pay Display Residential Areas FCC](https://data.gov.ie/en_GB/dataset/zoned-areas-for-pay-display-residential-areas-fcc2) (91 Fingal residential permit zone points, saved in `data/raw/`), and [DLR Commercial Parking Locations and Charges](https://data.gov.ie/en_GB/dataset/dlr-commercial-parking-locations-numbers-and-charges) (private car parks, 2015, no coordinates).

## Gaps to know about

- **DLR positions are from a 2018 survey.** The council says changes since then are not shown. Fees are current. Meter 627 appears twice (two different Braemor Road spots); both are kept.
- **DLR paid hours are 8am to 7pm**, an hour later than Dublin City and the other two councils.
- **Fingal has no prices per meter.** The council's own description says the usual charge is €1.20/h, Mon–Sat 8am–6pm, or €3 a day in long-term areas, but doesn't say which meters are long-term. The file is from March 2024 and lists 139 meters, while the description says 146 are in use.
- **South Dublin: 8 of 86 streets have no position** and were left out: Tower Road Service Road, Tuttles S and Tuttles N (Clondalkin), Adamstown Castlegate (Lucan), Old Lucan Road, Woodfarm Tce and Red Cow Tce (Palmerstown), Yellow Lane (Rathfarnham). Each South Dublin row is a stretch of street placed at one point, not a single machine. Some rows have odd end times (18:01 to 18:15) that look like typing slips, so all are treated as 6pm.
- **"First 30 minutes free" in South Dublin** isn't something the app's price logic understands yet; it's in the zone note.
- None of the three councils publish live space counts or multi-storey car park data in these sets.
