(function (G) {
  const COUNTS = { easy: 6, medium: 12, hard: 20 };
  const VEGETATION = ["mushroom", "palm", "tentacle", "crystal", "eyestalk", "bulb", "spiralfern", "balloon"];
  const ALIENS = ["blue", "pink", "mixed"];
  const HEIGHTS = ["short", "medium", "tall"];
  const ROOFS = ["dome", "spike", "flat", "arch"];
  const POLE_TOPS = ["ball", "ring", "fork", "none"];
  const SIGN_SHAPES = ["circle", "diamond", "triangle", "banner"];
  const SIDES = ["left", "right"];
  const TERRAINS = ["mesa", "dune", "spire", "ridge"];
  const SKY_EVENTS = ["ring", "eye", "jelly", "shard", "spiral", "worm"];
  const STAR_PATTERNS = ["cross", "arc", "cluster", "ring", "scatter"];
  const GROUND_PATTERNS = ["plain", "cracked", "rippled", "hex"];
  const PATH_STYLES = ["dirt", "plates", "glow", "rails"];
  const BANNERS = ["flags", "lanterns", "ribbons", "none"];
  const WINDOWS = ["slit", "round", "grid", "arch"];
  const WEATHERS = ["clear", "mist", "dust", "spores"];
  const FENCES = ["posts", "chain", "wall", "none"];
  const BODIES = ["A", "B", "C", "D", "E", "F"];
  const EYES = ["cute_light", "human", "psycho_light", "yellow", "red", "blue", "angry_blue", "human_green", "cute_dark"];
  const EYE_COUNTS = [1, 2, 3];
  const DETAILS = ["antenna_large", "antenna_small", "ear", "ear_round", "horn_large", "horn_small", "none"];
  const MOUTHS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "closed_fangs", "closed_happy", "closed_teeth"];
  const LIMBS = ["A", "B", "C", "D", "E"];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function cssColor(color) {
    return `hsl(${((color.h % 360) + 360) % 360} ${clamp(color.s, 0, 100)}% ${clamp(color.l, 0, 100)}%)`;
  }

  function evenBag(rand, count, items) {
    const bag = [];
    for (let i = 0; i < count; i++) bag.push(items[i % items.length]);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const swap = bag[i];
      bag[i] = bag[j];
      bag[j] = swap;
    }
    return bag;
  }

  function hues(rand, count, difficulty) {
    const base = rand() * 360;
    if (difficulty === "easy") {
      return Array.from({ length: count }, (_, i) => (base + i * (360 / count)) % 360);
    }
    if (difficulty === "medium") {
      const family = [0, 1, 2, 3].map((i) => (base + i * 78) % 360);
      return evenBag(rand, count, family);
    }
    const family = [0, 1, 2].map((i) => (base + i * 22) % 360);
    return evenBag(rand, count, family);
  }

  function goodSite(terrain, x, y) {
    if (!G.isDryLand(terrain, x, y)) return false;
    const e = G.elevationAt(terrain, x, y);
    return e > 0.03 && e < 0.7;
  }

  function scatterSites(rand, count, terrain) {
    let minDist = count <= 6 ? 200 : count <= 12 ? 125 : 78;
    for (let attempt = 0; attempt < 7; attempt++) {
      const sites = [];
      let guard = 0;
      while (sites.length < count && guard < 6000) {
        guard += 1;
        const x = 40 + rand() * 920;
        const y = 40 + rand() * 920;
        if (terrain && !goodSite(terrain, x, y)) continue;
        const clear = sites.every((site) => Math.hypot(site.x - x, site.y - y) >= minDist);
        if (clear) sites.push({ x, y });
      }
      if (sites.length === count) return sites;
      minDist *= 0.8;
    }
    return null;
  }

  function gridSites(count, rand) {
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const sites = [];
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cellW = 1000 / cols;
      const cellH = 1000 / rows;
      sites.push({
        x: cellW * (col + 0.32 + rand() * 0.36),
        y: cellH * (row + 0.32 + rand() * 0.36),
      });
    }
    return sites;
  }

  function intersect(p1, p2, nx, ny, c) {
    const d1 = nx * p1.x + ny * p1.y;
    const d2 = nx * p2.x + ny * p2.y;
    const t = (c - d1) / (d2 - d1 || 1e-9);
    return {
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t,
    };
  }

  function clipHalfPlane(poly, nx, ny, c) {
    if (!poly.length) return [];
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const prev = poly[(i + poly.length - 1) % poly.length];
      const cur = poly[i];
      const prevIn = nx * prev.x + ny * prev.y <= c + 1e-4;
      const curIn = nx * cur.x + ny * cur.y <= c + 1e-4;
      if (curIn) {
        if (!prevIn) out.push(intersect(prev, cur, nx, ny, c));
        out.push(cur);
      } else if (prevIn) {
        out.push(intersect(prev, cur, nx, ny, c));
      }
    }
    return out;
  }

  function cleanPoly(poly) {
    const out = [];
    poly.forEach((point) => {
      const next = {
        x: clamp(point.x, 0, 1000),
        y: clamp(point.y, 0, 1000),
      };
      const prev = out[out.length - 1];
      if (!prev || Math.hypot(prev.x - next.x, prev.y - next.y) > 0.8) out.push(next);
    });
    if (out.length > 2) {
      const first = out[0];
      const last = out[out.length - 1];
      if (Math.hypot(first.x - last.x, first.y - last.y) <= 0.8) out.pop();
    }
    return out;
  }

  function voronoiCell(site, sites) {
    let poly = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 1000 },
      { x: 0, y: 1000 },
    ];
    sites.forEach((other) => {
      if (other === site) return;
      const nx = other.x - site.x;
      const ny = other.y - site.y;
      const c = (other.x * other.x + other.y * other.y - site.x * site.x - site.y * site.y) / 2;
      poly = clipHalfPlane(poly, nx, ny, c);
    });
    return cleanPoly(poly);
  }

  function nearestIndex(sites, index) {
    let best = index === 0 ? 1 : 0;
    let bestDist = Infinity;
    sites.forEach((site, other) => {
      if (other === index) return;
      const dist = Math.hypot(site.x - sites[index].x, site.y - sites[index].y);
      if (dist < bestDist) {
        bestDist = dist;
        best = other;
      }
    });
    return best;
  }

  function different(rand, current, options) {
    const pool = options.filter((option) => option !== current);
    return pool[Math.floor(rand() * pool.length)];
  }

  function hueDistance(a, b) {
    const d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
  }

  function buildProfiles(rand, count, difficulty) {
    const skyHues = hues(rand, count, difficulty);
    const alienBag = difficulty === "hard"
      ? evenBag(rand, count, ["blue", "pink"])
      : evenBag(rand, count, ALIENS);
    const vegetationBag = evenBag(rand, count, VEGETATION);
    const heightBag = evenBag(rand, count, HEIGHTS);
    const roofBag = evenBag(rand, count, ROOFS);
    const poleBag = evenBag(rand, count, POLE_TOPS);
    const signBag = evenBag(rand, count, SIGN_SHAPES);
    const sideBag = evenBag(rand, count, SIDES);
    const glyphBag = evenBag(rand, count, Array.from({ length: G.GLYPH_COUNT }, (_, i) => i));
    const terrainBag = evenBag(rand, count, TERRAINS);
    const eventBag = evenBag(rand, count, SKY_EVENTS);
    const starBag = evenBag(rand, count, STAR_PATTERNS);
    const patternBag = evenBag(rand, count, GROUND_PATTERNS);
    const pathBag = evenBag(rand, count, PATH_STYLES);
    const bannerBag = evenBag(rand, count, BANNERS);
    const windowBag = evenBag(rand, count, WINDOWS);
    const weatherBag = difficulty === "hard"
      ? evenBag(rand, count, ["clear", "mist"])
      : evenBag(rand, count, WEATHERS);
    const fenceBag = evenBag(rand, count, FENCES);
    const bodyBag = evenBag(rand, count, BODIES);
    const eyeBag = evenBag(rand, count, EYES);
    const eyeCountBag = evenBag(rand, count, EYE_COUNTS);
    const detailBag = evenBag(rand, count, DETAILS);
    const mouthBag = evenBag(rand, count, MOUTHS);
    const armBag = evenBag(rand, count, LIMBS);
    const legBag = evenBag(rand, count, LIMBS);
    const accentBase = rand() * 360;
    const lineBase = rand() * 360;
    const moonBase = rand() * 360;

    return skyHues.map((skyHue, index) => {
      const sat = difficulty === "easy" ? 70 : difficulty === "medium" ? 60 : 48;
      const sky = { h: skyHue, s: sat, l: 78 };
      const skyDeep = { h: (skyHue + 40) % 360, s: sat, l: 66 };
      const groundHue = difficulty === "easy" ? (skyHue + 150) % 360 : (skyHue + 120 + (index % 3) * 24) % 360;
      const lineHue = difficulty === "easy"
        ? (skyHue + 180) % 360
        : (lineBase + glyphBag[index] * 29) % 360;
      return {
        skyGradient: [skyDeep, sky],
        groundColor: { h: groundHue, s: 46, l: 52 },
        pathColor: { h: 32, s: 38, l: 62 },
        pathLineColor: { h: lineHue, s: difficulty === "hard" ? 70 : 84, l: 62 },
        vegetation: vegetationBag[index],
        vegetationColor: {
          h: difficulty === "easy" ? (skyHue + 28) % 360 : (accentBase + index * 47) % 360,
          s: 68,
          l: 62,
        },
        alienMix: alienBag[index],
        alienHeight: heightBag[index],
        alienSpecies: {
          body: bodyBag[index],
          eye: eyeBag[index],
          eyes: eyeCountBag[index],
          detail: detailBag[index],
          mouth: mouthBag[index],
          arm: armBag[index],
          leg: legBag[index],
        },
        roofShape: roofBag[index],
        roofColor: { h: (skyHue + (difficulty === "easy" ? 12 : 160)) % 360, s: 64, l: 58 },
        wallColor: { h: (accentBase + index * 61 + 90) % 360, s: 52, l: 72 },
        poleColor: { h: (lineBase + index * 19) % 360, s: 30, l: difficulty === "hard" ? 64 : 74 },
        poleTop: poleBag[index],
        signShape: signBag[index],
        signGlyph: glyphBag[index] % G.GLYPH_COUNT,
        drivingSide: sideBag[index],
        accentColor: { h: (accentBase + index * (360 / count)) % 360, s: 80, l: 60 },
        moonColor: { h: (moonBase + index * 53) % 360, s: 60, l: 84 },
        terrain: terrainBag[index],
        skyEvent: eventBag[index],
        starPattern: starBag[index],
        groundPattern: patternBag[index],
        pathStyle: pathBag[index],
        banner: bannerBag[index],
        windowStyle: windowBag[index],
        weather: weatherBag[index],
        fence: fenceBag[index],
      };
    });
  }

  function tryGenerate(seed, difficulty, terrain, forceGrid) {
    const count = COUNTS[difficulty];
    const rand = G.mulberry32(G.hashSeed(`${seed}|${difficulty}|world`));
    const sites = forceGrid ? gridSites(count, rand) : scatterSites(rand, count, terrain);
    if (!sites) return null;
    const regions = sites.map((site, i) => ({ id: i, site, polygon: voronoiCell(site, sites) }));
    if (regions.some((region) => region.polygon.length < 3)) return null;
    const profiles = buildProfiles(rand, count, difficulty);
    regions.forEach((region, index) => {
      region.profile = profiles[index];
    });
    if (difficulty === "hard") {
      const snapshot = regions.map((region) => ({
        sky: region.profile.skyGradient.map((color) => ({ ...color })),
        alien: region.profile.alienMix,
        terrain: region.profile.terrain,
        weather: region.profile.weather,
        poleTop: region.profile.poleTop,
        signShape: region.profile.signShape,
        signGlyph: region.profile.signGlyph,
        lineHue: region.profile.pathLineColor.h,
        starPattern: region.profile.starPattern,
        pathStyle: region.profile.pathStyle,
        windowStyle: region.profile.windowStyle,
        fence: region.profile.fence,
        species: { ...region.profile.alienSpecies },
      }));
      regions.forEach((region) => {
        const profile = region.profile;
        const neighbor = snapshot[nearestIndex(sites, region.id)];
        const species = profile.alienSpecies;
        if (rand() < 0.8) profile.skyGradient = neighbor.sky.map((color) => ({ ...color }));
        if (rand() < 0.7) profile.alienMix = neighbor.alien;
        if (rand() < 0.55) profile.terrain = neighbor.terrain;
        if (rand() < 0.5) profile.weather = neighbor.weather;
        if (rand() < 0.5) species.mouth = neighbor.species.mouth;
        if (profile.poleTop === neighbor.poleTop) profile.poleTop = different(rand, profile.poleTop, POLE_TOPS);
        if (profile.signShape === neighbor.signShape) profile.signShape = different(rand, profile.signShape, SIGN_SHAPES);
        if (profile.signGlyph === neighbor.signGlyph) {
          profile.signGlyph = (profile.signGlyph + 1 + Math.floor(rand() * (G.GLYPH_COUNT - 1))) % G.GLYPH_COUNT;
        }
        if (profile.starPattern === neighbor.starPattern) profile.starPattern = different(rand, profile.starPattern, STAR_PATTERNS);
        if (profile.pathStyle === neighbor.pathStyle) profile.pathStyle = different(rand, profile.pathStyle, PATH_STYLES);
        if (profile.windowStyle === neighbor.windowStyle) profile.windowStyle = different(rand, profile.windowStyle, WINDOWS);
        if (profile.fence === neighbor.fence) profile.fence = different(rand, profile.fence, FENCES);
        if (species.body === neighbor.species.body) species.body = different(rand, species.body, BODIES);
        if (species.detail === neighbor.species.detail) species.detail = different(rand, species.detail, DETAILS);
        if (species.eyes === neighbor.species.eyes) species.eyes = different(rand, species.eyes, EYE_COUNTS);
        if (hueDistance(profile.pathLineColor.h, neighbor.lineHue) < 28) {
          profile.pathLineColor = { h: (profile.pathLineColor.h + 55) % 360, s: 74, l: 62 };
        }
      });
    }
    return { seed, difficulty, regions };
  }

  function createPlanet(seed, difficulty) {
    const terrain = G.makeTerrain(seed);
    for (let salt = 0; salt < 8; salt++) {
      const keyed = salt === 0 ? seed : `${seed}#${salt}`;
      const planet = tryGenerate(keyed, difficulty, terrain, false);
      if (planet) return finishPlanet(planet, seed, terrain);
    }
    return finishPlanet(tryGenerate(`${seed}#grid`, difficulty, terrain, true), seed, terrain);
  }

  function finishPlanet(planet, seed, terrain) {
    planet.seed = seed;
    planet.terrain = terrain;
    planet.network = G.buildNetwork(planet);
    planet.roads = planet.network.roads;
    planet.towns = planet.network.towns;
    return planet;
  }

  function nearestRegion(planet, x, y) {
    let best = planet.regions[0];
    let bestDist = Infinity;
    planet.regions.forEach((region) => {
      const dist = (region.site.x - x) ** 2 + (region.site.y - y) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = region;
      }
    });
    return best;
  }

  function pickLocation(planet, rng) {
    const spot = G.randomRoadSpot(planet, rng);
    const region = nearestRegion(planet, spot.x, spot.y);
    return {
      regionId: region.id,
      x: Math.round(spot.x * 100) / 100,
      y: Math.round(spot.y * 100) / 100,
      heading: spot.heading,
      road: spot.road,
      along: spot.along,
    };
  }

  G.cssColor = cssColor;
  G.createPlanet = createPlanet;
  G.pickLocation = pickLocation;
  G.nearestRegion = nearestRegion;
})(window.AlienGuessr = window.AlienGuessr || {});
