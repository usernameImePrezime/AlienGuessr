(function (G) {
  const COUNTS = { easy: 6, medium: 12, hard: 20 };
  const VEGETATION = ["crystal", "mushroom", "coral", "spike"];
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
  const TRAITS = ["plain", "horns", "antenna", "spots", "crest"];
  const EYE_COUNTS = [1, 2, 3];
  const BANNERS = ["flags", "lanterns", "ribbons", "none"];
  const WINDOWS = ["slit", "round", "grid", "arch"];
  const WEATHERS = ["clear", "mist", "dust", "spores"];
  const FENCES = ["posts", "chain", "wall", "none"];

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

  function scatterSites(rand, count) {
    let minDist = count <= 6 ? 210 : count <= 12 ? 125 : 72;
    for (let attempt = 0; attempt < 6; attempt++) {
      const sites = [];
      let guard = 0;
      while (sites.length < count && guard < 5000) {
        guard += 1;
        const x = 90 + rand() * 820;
        const y = 90 + rand() * 820;
        const clear = sites.every((site) => Math.hypot(site.x - x, site.y - y) >= minDist);
        if (clear) sites.push({ x, y });
      }
      if (sites.length === count) return sites;
      minDist *= 0.82;
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

  function shoelace(poly) {
    let sum = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) / 2;
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
    const alienBag = difficulty === "easy"
      ? evenBag(rand, count, ["blue", "pink", "mixed"])
      : difficulty === "medium"
        ? evenBag(rand, count, ALIENS)
        : evenBag(rand, count, ["blue", "pink"]);
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
    const traitBag = evenBag(rand, count, TRAITS);
    const eyeBag = evenBag(rand, count, EYE_COUNTS);
    const bannerBag = evenBag(rand, count, BANNERS);
    const windowBag = evenBag(rand, count, WINDOWS);
    const weatherBag = difficulty === "hard"
      ? evenBag(rand, count, ["clear", "mist"])
      : evenBag(rand, count, WEATHERS);
    const fenceBag = evenBag(rand, count, FENCES);
    const accentBase = rand() * 360;
    const lineBase = rand() * 360;

    const profiles = skyHues.map((skyHue, index) => {
      const sat = difficulty === "easy" ? 78 : difficulty === "medium" ? 64 : 46;
      const skyLight = difficulty === "hard" ? 42 : 54;
      const sky = { h: skyHue, s: sat, l: skyLight };
      const skyDeep = { h: skyHue, s: sat, l: difficulty === "easy" ? 18 : 24 };
      const groundHue = difficulty === "easy" ? skyHue : (skyHue + 40 + (index % 3) * 18) % 360;
      const ground = { h: groundHue, s: difficulty === "easy" ? 42 : 34, l: difficulty === "easy" ? 32 : 28 };
      const lineHue = difficulty === "easy"
        ? (skyHue + 180) % 360
        : (lineBase + glyphBag[index] * 29) % 360;
      return {
        skyGradient: [skyDeep, sky],
        groundColor: ground,
        pathColor: { h: groundHue, s: 18, l: 46 },
        pathLineColor: { h: lineHue, s: difficulty === "hard" ? 70 : 84, l: 62 },
        vegetation: vegetationBag[index],
        vegetationColor: {
          h: difficulty === "easy" ? (skyHue + 28) % 360 : (accentBase + index * 47) % 360,
          s: 72,
          l: 58,
        },
        alienMix: alienBag[index],
        alienHeight: heightBag[index],
        roofShape: roofBag[index],
        roofColor: { h: (skyHue + (difficulty === "easy" ? 12 : 160)) % 360, s: 68, l: 48 },
        poleColor: { h: (lineBase + index * 19) % 360, s: 30, l: difficulty === "hard" ? 72 : 84 },
        poleTop: poleBag[index],
        signShape: signBag[index],
        signGlyph: glyphBag[index] % G.GLYPH_COUNT,
        drivingSide: sideBag[index],
        accentColor: { h: (accentBase + index * (360 / count)) % 360, s: 80, l: 56 },
        mapColor: { h: (index * 137.508 + accentBase) % 360, s: 58, l: 56 },
        terrain: terrainBag[index],
        skyEvent: eventBag[index],
        starPattern: starBag[index],
        groundPattern: patternBag[index],
        pathStyle: pathBag[index],
        alienTrait: traitBag[index],
        eyeCount: eyeBag[index],
        banner: bannerBag[index],
        windowStyle: windowBag[index],
        weather: weatherBag[index],
        fence: fenceBag[index],
      };
    });

    return profiles;
  }

  function tryGenerate(seed, difficulty, forceGrid) {
    const count = COUNTS[difficulty];
    const rand = G.mulberry32(G.hashSeed(`${seed}|${difficulty}|world`));
    const sites = forceGrid ? gridSites(count, rand) : scatterSites(rand, count);
    if (!sites) return null;
    const regions = [];
    for (let i = 0; i < sites.length; i++) {
      const polygon = voronoiCell(sites[i], sites);
      const minArea = count >= 16 ? 3200 : 7000;
      if (polygon.length < 3 || shoelace(polygon) < minArea) return null;
      regions.push({ id: i, site: sites[i], polygon });
    }
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
        alienTrait: region.profile.alienTrait,
        pathStyle: region.profile.pathStyle,
        windowStyle: region.profile.windowStyle,
        fence: region.profile.fence,
        eyeCount: region.profile.eyeCount,
      }));
      regions.forEach((region) => {
        const profile = region.profile;
        const neighbor = snapshot[nearestIndex(sites, region.id)];
        if (rand() < 0.8) profile.skyGradient = neighbor.sky.map((color) => ({ ...color }));
        if (rand() < 0.7) profile.alienMix = neighbor.alien;
        if (rand() < 0.55) profile.terrain = neighbor.terrain;
        if (rand() < 0.5) profile.weather = neighbor.weather;
        if (profile.poleTop === neighbor.poleTop) profile.poleTop = different(rand, profile.poleTop, POLE_TOPS);
        if (profile.signShape === neighbor.signShape) profile.signShape = different(rand, profile.signShape, SIGN_SHAPES);
        if (profile.signGlyph === neighbor.signGlyph) {
          profile.signGlyph = (profile.signGlyph + 1 + Math.floor(rand() * (G.GLYPH_COUNT - 1))) % G.GLYPH_COUNT;
        }
        if (profile.starPattern === neighbor.starPattern) profile.starPattern = different(rand, profile.starPattern, STAR_PATTERNS);
        if (profile.alienTrait === neighbor.alienTrait) profile.alienTrait = different(rand, profile.alienTrait, TRAITS);
        if (profile.pathStyle === neighbor.pathStyle) profile.pathStyle = different(rand, profile.pathStyle, PATH_STYLES);
        if (profile.windowStyle === neighbor.windowStyle) profile.windowStyle = different(rand, profile.windowStyle, WINDOWS);
        if (profile.fence === neighbor.fence) profile.fence = different(rand, profile.fence, FENCES);
        if (profile.eyeCount === neighbor.eyeCount) profile.eyeCount = different(rand, profile.eyeCount, EYE_COUNTS);
        if (hueDistance(profile.pathLineColor.h, neighbor.lineHue) < 28) {
          profile.pathLineColor = {
            h: (profile.pathLineColor.h + 55) % 360,
            s: 74,
            l: 62,
          };
        }
      });
    }
    return { seed, difficulty, regions };
  }

  function hash2(ix, iy, seed) {
    let n = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + (seed | 0)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function valueNoise(x, y, seed) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = x - x0;
    const ty = y - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = hash2(x0, y0, seed);
    const b = hash2(x0 + 1, y0, seed);
    const c = hash2(x0, y0 + 1, seed);
    const d = hash2(x0 + 1, y0 + 1, seed);
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  }

  function fbm(x, y, seed) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let total = 0;
    for (let octave = 0; octave < 5; octave++) {
      value += amplitude * valueNoise(x * frequency, y * frequency, seed + octave * 9176);
      total += amplitude;
      frequency *= 2.04;
      amplitude *= 0.5;
    }
    return value / total;
  }

  function makeGeo(seed) {
    const rand = G.mulberry32(G.hashSeed(`${seed}|geo`));
    const hue = rand() * 360;
    const noiseSeed = G.hashSeed(`${seed}|noise`) || 1;
    return {
      seed: noiseSeed,
      sea: 0.455 + rand() * 0.05,
      deep: { h: hue, s: 62, l: 16 },
      shallow: { h: (hue + 48) % 360, s: 74, l: 46 },
      foam: { h: (hue + 170) % 360, s: 24, l: 86 },
    };
  }

  function landSample(geo, nx, ny) {
    const warpX = fbm(nx * 2.4 + 1.3, ny * 2.4, geo.seed);
    const warpY = fbm(nx * 2.4, ny * 2.4 + 5.1, geo.seed + 80);
    const x = nx + (warpX - 0.5) * 0.9;
    const y = ny + (warpY - 0.5) * 0.9;
    const continent = fbm(x * 3.6, y * 3.6, geo.seed);
    const detail = fbm(x * 8.2 + 2.2, y * 8.2, geo.seed + 240);
    const islands = fbm(x * 15 + 8, y * 15, geo.seed + 770);
    const ridgeNoise = fbm(x * 6.2 + 1.4, y * 6.2, geo.seed + 410);
    const ridge = 1 - Math.abs(ridgeNoise * 2 - 1);
    const height = continent * 0.5 + detail * 0.3 + islands * 0.2 + ridge * 0.06;
    const latitude = Math.abs(ny - 0.5) * 2;
    const sea = geo.sea + latitude * 0.04;
    const land = height > sea;
    const lakeNoise = fbm(x * 13 + 4, y * 13, geo.seed + 1280);
    return {
      height,
      land,
      shallow: height > sea - 0.032 && height <= sea,
      mountain: land && (height > sea + 0.1 || ridge > 0.84),
      coast: land && height < sea + 0.026,
      lake: land && lakeNoise < 0.36 && height < sea + 0.07,
    };
  }

  function createPlanet(seed, difficulty) {
    for (let salt = 0; salt < 8; salt++) {
      const keyed = salt === 0 ? seed : `${seed}#${salt}`;
      const planet = tryGenerate(keyed, difficulty, false);
      if (planet) return finishPlanet(planet, seed);
    }
    return finishPlanet(tryGenerate(`${seed}#grid`, difficulty, true), seed);
  }

  function finishPlanet(planet, seed) {
    planet.seed = seed;
    planet.geo = makeGeo(seed);
    planet.roads = buildRoads(planet);
    return planet;
  }

  function buildRoads(planet) {
    const rand = G.mulberry32(G.hashSeed(`${planet.seed}|roads`));
    const nodes = [];
    for (let i = 0; i < 36; i++) {
      const x = 30 + rand() * 940;
      const y = 30 + rand() * 940;
      const sample = landSample(planet.geo, x / 1000, y / 1000);
      if (sample.land && !sample.lake) nodes.push({ x, y });
    }
    planet.regions.forEach((region) => {
      const sample = landSample(planet.geo, region.site.x / 1000, region.site.y / 1000);
      if (sample.land && !sample.lake) nodes.push({ x: region.site.x, y: region.site.y });
    });
    const roads = [];
    const used = new Set();
    nodes.forEach((node, index) => {
      const nearest = nodes
        .map((other, otherIndex) => ({
          otherIndex,
          dist: Math.hypot(other.x - node.x, other.y - node.y),
        }))
        .filter((item) => item.otherIndex !== index && item.dist > 40 && item.dist < 320)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 2);
      nearest.forEach((item) => {
        const key = index < item.otherIndex ? `${index}-${item.otherIndex}` : `${item.otherIndex}-${index}`;
        if (used.has(key)) return;
        used.add(key);
        const line = curveRoad(node, nodes[item.otherIndex], rand);
        const dry = line.filter((point) => {
          const sample = landSample(planet.geo, point.x / 1000, point.y / 1000);
          return sample.land && !sample.lake;
        }).length;
        if (dry >= line.length * 0.6) roads.push(line);
      });
    });
    return roads;
  }

  function curveRoad(a, b, rand) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const bend = (rand() - 0.5) * Math.min(160, len * 0.42);
    const cx = (a.x + b.x) / 2 + (-dy / len) * bend;
    const cy = (a.y + b.y) / 2 + (dx / len) * bend;
    const points = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const u = 1 - t;
      points.push({
        x: u * u * a.x + 2 * u * t * cx + t * t * b.x,
        y: u * u * a.y + 2 * u * t * cy + t * t * b.y,
      });
    }
    return points;
  }

  function randomRoadPoint(roads, rng) {
    const road = roads[Math.floor(rng() * roads.length)];
    const index = Math.floor(rng() * Math.max(1, road.length - 1));
    const a = road[index];
    const b = road[Math.min(road.length - 1, index + 1)];
    const t = rng();
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    };
  }

  function pointInPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x;
      const yi = poly[i].y;
      const xj = poly[j].x;
      const yj = poly[j].y;
      const hit = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi;
      if (hit) inside = !inside;
    }
    return inside;
  }

  function distanceToEdges(x, y, poly) {
    let best = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = dx * dx + dy * dy;
      const t = len === 0 ? 0 : clamp(((x - a.x) * dx + (y - a.y) * dy) / len, 0, 1);
      best = Math.min(best, Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)));
    }
    return best;
  }

  function centroid(poly) {
    let x = 0;
    let y = 0;
    poly.forEach((point) => {
      x += point.x;
      y += point.y;
    });
    return { x: x / poly.length, y: y / poly.length };
  }

  function randomInteriorPoint(poly, rng, geo) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    poly.forEach((point) => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
    const margins = [42, 22, 8, 0];
    let fallback = null;
    for (let m = 0; m < margins.length; m++) {
      for (let i = 0; i < 80; i++) {
        const x = minX + rng() * (maxX - minX);
        const y = minY + rng() * (maxY - minY);
        if (!pointInPoly(x, y, poly) || distanceToEdges(x, y, poly) < margins[m]) continue;
        if (!fallback) fallback = { x, y };
        if (!geo || landSample(geo, x / 1000, y / 1000).land) return { x, y };
      }
    }
    return fallback || centroid(poly);
  }

  function pickLocation(planet, rng, seen) {
    let pool = planet.regions.filter((region) => !seen.has(region.id));
    if (!pool.length) {
      seen.clear();
      pool = planet.regions.slice();
    }
    const region = pool[Math.floor(rng() * pool.length)];
    seen.add(region.id);
    if (planet.roads && planet.roads.length) {
      for (let i = 0; i < 28; i++) {
        const spot = randomRoadPoint(planet.roads, rng);
        const sample = landSample(planet.geo, spot.x / 1000, spot.y / 1000);
        if (!sample.land || sample.lake) continue;
        if (!pointInPoly(spot.x, spot.y, region.polygon)) continue;
        return {
          regionId: region.id,
          x: Math.round(spot.x * 100) / 100,
          y: Math.round(spot.y * 100) / 100,
        };
      }
    }
    const point = randomInteriorPoint(region.polygon, rng, planet.geo);
    return {
      regionId: region.id,
      x: Math.round(point.x * 100) / 100,
      y: Math.round(point.y * 100) / 100,
    };
  }

  G.cssColor = cssColor;
  G.createPlanet = createPlanet;
  G.pickLocation = pickLocation;
  G.landSample = landSample;
})(window.AlienGuessr = window.AlienGuessr || {});
