# Probe Drop

A goofy geography guessing game for the browser, set on procedurally generated alien planets. You get dropped on a random road, look at one painted photo, and guess where you are on the planet map.

- **Easy:** one continent, six countries. Sky tint and alien color give it away.
- **Medium:** two or three continents, twelve countries. Bollards, chevrons, road lines, plates, web domains and the probe car start to matter.
- **Hard:** three or four continents, twenty countries. Neighbors look alike, so read pole types, phone digits, area codes, guardrails, km markers and curb paint.

Points come from distance, plus a bonus for the right country (+500) and the right province (+250). Study mode opens a Field Guide after each guess that shows every meta for the continent, country and province you were in.

## Run it

No build step. Serve the folder with any static server and open `index.html`, for example:

```
python -m http.server 8765
```

Every planet comes from its seed, so sharing a seed shares the exact same world.
