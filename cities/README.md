# Adding a city

Create a folder under `cities/`, then add its entry to `cities/index.json`:

```json
{"id":"new-orleans","name":"New Orleans","path":"new-orleans/city.json"}
```

IDs must be stable, unique lowercase URL slugs. `?city=<id>` selects the city; the index's `default` ID is used when omitted. Unknown IDs show a data-load error. No application code changes are needed.

Each folder needs:

- `city.json`: `id`, `name`, `pageTitle`, `visitTitle`, `shareTitle`, `mapLabel`, `loadingText`; `center` as `[latitude, longitude]`, `span` as `[latitudeDelta, longitudeDelta]`; ordered `neighborhoods` array with `id`, `name`, and `center`; relative filenames `places`, `landmarks`, and `ride`.
- `places.json`: array of place records matching Nashville's schema. Preserve stable `id` values for shared place/trip links. Provide `name`, `category`, `neighborhood_id`, `lat`, `lon`, `map_point` and/or `street_point` (`lat`, `lon`), `why_go`, `story`, `best_time_tip`, `official_website_url`, and source metadata. Neighborhood IDs must exist in city.json. Exterior street points should be checked against imagery.
- `landmarks.json`: array with `label`, `latitude`, `longitude`, and numeric `importance` (1–3). These render with the existing semi-transparent text-only tags.
- `ride.json`: object with stable `id`, `name`, `coordinateNote`, and ordered `stops`. Each stop has `id`, `name`, `lat`, `lon`, `heading` (degrees clockwise from true north, or null), `line` (spoken text), and `sources` array. Welcome/goodbye may have null coordinates. Data only: no ride UI or narration loads in this round.

Use UTF-8 JSON and valid geographic coordinates. Resolve data filenames relative to the city's folder. Verify source claims and image coverage before adding a city. No credentials belong in these files.

Old Nashville `?place=<id>` and `?trip=<comma-separated IDs>` links continue to use the default city. New share links include `city`. The original default trip storage key is preserved; other cities have separate keys.

Run the local Playwright checks from the project root as documented in REPORT.md. Check map labels, neighborhood navigation, place links and walking on each new city's imagery. The Nashville walking fixtures in `evidence/verify.cjs` should be supplemented with that city's street coordinates.
