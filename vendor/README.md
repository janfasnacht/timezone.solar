# Vendored data

## openflights-airports.dat

Source: https://github.com/jpatokal/openflights/blob/master/data/airports.dat
License: Open Database License (ODbL) v1.0
Attribution: © OpenFlights.org

Used by `scripts/generate-airports.ts` to produce `src/engine/airport-data.generated.ts`.

Columns (no header in the file):
1. Airport ID
2. Name
3. City
4. Country
5. IATA (3-letter, `\N` if absent)
6. ICAO (4-letter, `\N` if absent)
7. Latitude
8. Longitude
9. Altitude (feet)
10. Timezone (UTC offset, decimal hours)
11. DST (E/A/S/O/Z/N/U)
12. Tz database time zone (IANA, `\N` if absent)
13. Type (airport / station / port / heliport / unknown)
14. Source

To refresh:

```sh
curl -fsSL -o vendor/openflights-airports.dat \
  https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat
npm run airports:generate
```
