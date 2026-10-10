(function (G) {
  const COUNTS = { easy: 6, medium: 12, hard: 20 };
  const CONTINENT_COUNTS = { easy: [1, 1], medium: [2, 3], hard: [3, 4] };
  const PROVINCE_COUNTS = { easy: [2, 2], medium: [2, 3], hard: [2, 4] };
  const VEGETATION = ["mushroom", "palm", "tentacle", "crystal", "eyestalk", "bulb", "spiralfern", "balloon"];
  const ALIENS = ["yellow", "green", "blue", "pink", "mixed"];
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

  const SQUARE = [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 1000 },
    { x: 0, y: 1000 },
  ];

  function voronoiCell(site, sites, base) {
    let poly = (base || SQUARE).map((p) => ({ ...p }));
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

  function buildProfiles(rand, count, difficulty, presetHues) {
    const skyHues = presetHues || hues(rand, count, difficulty);
    const alienBag = evenBag(rand, count, ALIENS);
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

  function landCells(terrain) {
    const n = terrain.N;
    const good = terrain.continents.map(() => []);
    const any = terrain.continents.map(() => []);
    for (let i = 0; i < n * n; i++) {
      if (terrain.water[i] !== 0) continue;
      const x = (((i % n) + 0.5) / n) * 1000;
      const y = ((Math.floor(i / n) + 0.5) / n) * 1000;
      if (x < 30 || x > 970 || y < 30 || y > 970) continue;
      const k = terrain.continent[i];
      if (!any[k]) continue;
      any[k].push({ x, y });
      const e = terrain.elev[i];
      if (e > 0.03 && e < 0.7) good[k].push({ x, y });
    }
    return good.map((list, k) => (list.length >= 200 ? list : any[k]));
  }

  function splitCounts(total, sizes) {
    if (sizes.length === 1) return [total];
    const sum = sizes.reduce((a, b) => a + b, 0) || 1;
    const out = sizes.map((s) => clamp(Math.round((total * s) / sum), 2, 9));
    let guard = 0;
    while (out.reduce((a, b) => a + b, 0) !== total && guard++ < 100) {
      const diff = out.reduce((a, b) => a + b, 0) - total;
      const order = sizes.map((s, i) => ({ i, ratio: s / out[i] })).sort((a, b) => a.ratio - b.ratio);
      if (diff > 0) {
        const pickDown = order.find((o) => out[o.i] > 2);
        if (!pickDown) break;
        out[pickDown.i] -= 1;
      } else {
        const pickUp = order.reverse().find((o) => out[o.i] < 9);
        if (!pickUp) break;
        out[pickUp.i] += 1;
      }
    }
    return out;
  }

  function scatter(rand, count, cells, minDist) {
    if (cells.length < count) return null;
    let gap = minDist;
    for (let attempt = 0; attempt < 14; attempt++) {
      const sites = [];
      for (let guard = 0; guard < count * 90 && sites.length < count; guard++) {
        const c = cells[Math.floor(rand() * cells.length)];
        if (sites.every((s) => Math.hypot(s.x - c.x, s.y - c.y) >= gap)) sites.push({ x: c.x, y: c.y });
      }
      if (sites.length === count) return sites;
      gap *= 0.84;
    }
    return null;
  }

  function nearestOf(items, x, y) {
    let best = items[0];
    let bestDist = Infinity;
    for (let i = 0; i < items.length; i++) {
      const d = (items[i].site.x - x) ** 2 + (items[i].site.y - y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = items[i];
      }
    }
    return best;
  }

  function shuffled(rand, list) {
    return evenBag(rand, list.length, list);
  }

  function continentHues(rand, difficulty, continents, countryCount) {
    if (difficulty !== "medium") return hues(rand, countryCount, difficulty);
    const base = rand() * 360;
    const out = [];
    continents.forEach((continent, k) => {
      const center = base + k * (360 / continents.length);
      const n = continent.countryIds.length;
      continent.countryIds.forEach((id, j) => {
        out[id] = (center + (n > 1 ? (j / (n - 1) - 0.5) * 56 : 0) + 360) % 360;
      });
    });
    return out;
  }

  function applyContinentMetas(rand, difficulty, continents, profiles) {
    const tier = G.METAS.tierOf(difficulty);
    const k = continents.length;
    const hemis = evenBag(rand, k, G.METAS.POOLS.hemisphere);
    const sides = evenBag(rand, k, SIDES);
    const colors = tier === 2 ? evenBag(rand, k, ["blue", "pink"]) : evenBag(rand, k, G.METAS.POOLS.alienColor);
    const events = evenBag(rand, k, SKY_EVENTS);
    continents.forEach((continent, i) => {
      continent.hemisphere = hemis[i];
      continent.drivingSide = sides[i];
      continent.alienColor = colors[i];
      continent.skyEvent = events[i];
      continent.countryIds.forEach((id) => {
        const p = profiles[id];
        p.hemisphere = continent.hemisphere;
        if (tier === 0) {
          p.alienColors = p.alienMix === "mixed" ? ["pink", "blue"] : [p.alienMix];
          return;
        }
        p.drivingSide = continent.drivingSide;
        if (tier === 1) p.skyEvent = continent.skyEvent;
        const others = (tier === 2 ? ["blue", "pink", "green"] : G.METAS.POOLS.alienColor).filter((c) => c !== continent.alienColor);
        const mix = rand() < (tier === 2 ? 0.4 : 0.25);
        p.alienColors = mix ? [continent.alienColor, others[Math.floor(rand() * others.length)]] : [continent.alienColor];
        p.alienMix = p.alienColors.length > 1 ? "mixed" : p.alienColors[0];
      });
    });
  }

  function applyCountryMetas(rand, difficulty, continents, countries, profiles) {
    const tier = G.METAS.tierOf(difficulty);
    const P = G.METAS.POOLS;
    const n = countries.length;
    const bag = (pool) => evenBag(rand, n, pool);
    const layouts = bag(P.flagLayout);
    const soils = bag(P.soil);
    const dryness = bag(P.dryness);
    const bollards = bag(P.bollard);
    const reflectors = bag(P.reflector);
    const chevrons = bag(P.chevron);
    const lines = bag(P.linePattern);
    const plates = bag(P.plate);
    const antennas = bag(P.antenna);
    const tapes = bag(P.tape);
    const poles = bag(P.poleBody);
    const insulators = bag(P.insulators);
    const rails = bag(P.guardrail);
    const markers = bag(P.kmMarker);
    const curbs = bag(P.curb);
    const domains = new Set();
    continents.forEach((continent) => {
      const digits = shuffled(rand, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
      continent.countryIds.forEach((id, j) => {
        countries[id].digit = digits[j % 9];
      });
    });
    countries.forEach((country, i) => {
      const p = profiles[i];
      const colors = shuffled(rand, G.METAS.FLAG_COLORS).slice(0, 3);
      country.flag = { layout: layouts[i], colors };
      country.domain = G.METAS.domainFor(country.name, domains);
      p.difficulty = difficulty;
      p.flag = country.flag;
      p.soil = tier >= 1 ? soils[i] : null;
      p.dryness = tier >= 1 ? dryness[i] : null;
      p.bollard = tier >= 1 ? { shape: bollards[i], reflector: reflectors[i] } : null;
      p.chevron = tier >= 1 ? chevrons[i] : null;
      p.linePattern = tier >= 1 ? lines[i] : null;
      p.plate = tier >= 1 ? plates[i] : null;
      p.probeCar = tier >= 1 ? { antenna: antennas[i], tape: tapes[i] } : null;
      p.domain = tier >= 1 ? country.domain : null;
      p.poleBody = tier >= 2 ? poles[i] : null;
      p.insulators = tier >= 2 ? insulators[i] : null;
      p.guardrail = tier >= 2 ? rails[i] : null;
      p.kmMarker = tier >= 2 ? markers[i] : null;
      p.curb = tier >= 2 ? curbs[i] : null;
      p.phoneDigit = tier >= 2 ? country.digit : null;
    });
  }

  function tryGenerate(seed, difficulty, terrain) {
    const total = COUNTS[difficulty];
    const rand = G.mulberry32(G.hashSeed(`${seed}|${difficulty}|world`));
    const names = G.METAS.makeNamer(G.mulberry32(G.hashSeed(`${seed}|${difficulty}|names`)));
    const cells = landCells(terrain);
    const cellArea = (1000 / terrain.N) ** 2;
    const split = splitCounts(total, cells.map((list) => list.length));
    const continents = [];
    const countries = [];
    for (let c = 0; c < cells.length; c++) {
      const sites = scatter(rand, split[c], cells[c], Math.sqrt((cells[c].length * cellArea) / split[c]) * 0.8);
      if (!sites) return null;
      const info = terrain.continents[c];
      const continent = { id: c, name: names.continent(), x: info.x, y: info.y, size: info.size, countryIds: [] };
      continents.push(continent);
      sites.forEach((site) => {
        const country = { id: countries.length, continentId: c, name: names.country(), site, polygon: voronoiCell(site, sites), provinceIds: [] };
        countries.push(country);
        continent.countryIds.push(country.id);
      });
    }
    if (countries.some((country) => country.polygon.length < 3)) return null;

    const regions = [];
    const [plo, phi] = PROVINCE_COUNTS[difficulty];
    for (const country of countries) {
      const siblings = continents[country.continentId].countryIds.map((id) => countries[id]);
      const own = cells[country.continentId].filter((p) => nearestOf(siblings, p.x, p.y) === country);
      const want = Math.max(1, Math.min(own.length, plo + Math.floor(rand() * (phi - plo + 1))));
      const sites = want > 1 ? scatter(rand, want, own, Math.sqrt((own.length * cellArea) / want) * 0.75) : [country.site];
      if (!sites) return null;
      sites.forEach((site) => {
        const polygon = sites.length > 1 ? voronoiCell(site, sites, country.polygon) : country.polygon.map((p) => ({ ...p }));
        const province = { id: regions.length, countryId: country.id, continentId: country.continentId, name: names.province(), site, polygon };
        regions.push(province);
        country.provinceIds.push(province.id);
      });
    }
    if (regions.some((region) => region.polygon.length < 3)) return null;

    const profiles = buildProfiles(rand, countries.length, difficulty, continentHues(rand, difficulty, continents, countries.length));
    applyContinentMetas(rand, difficulty, continents, profiles);
    applyCountryMetas(rand, difficulty, continents, countries, profiles);
    const sites = countries.map((country) => country.site);
    if (difficulty === "hard") {
      const snapshot = profiles.map((profile) => ({
        sky: profile.skyGradient.map((color) => ({ ...color })),
        alienColors: profile.alienColors.slice(),
        terrain: profile.terrain,
        weather: profile.weather,
        poleTop: profile.poleTop,
        signShape: profile.signShape,
        signGlyph: profile.signGlyph,
        lineHue: profile.pathLineColor.h,
        starPattern: profile.starPattern,
        pathStyle: profile.pathStyle,
        windowStyle: profile.windowStyle,
        fence: profile.fence,
        soil: profile.soil,
        dryness: profile.dryness,
        poleBody: profile.poleBody,
        insulators: profile.insulators,
        species: { ...profile.alienSpecies },
      }));
      countries.forEach((country) => {
        const profile = profiles[country.id];
        const siblings = continents[country.continentId].countryIds;
        const pool = siblings.length > 1 ? siblings.map((id) => sites[id]) : sites;
        const near = nearestIndex(pool, pool.indexOf(country.site));
        const neighbor = snapshot[siblings.length > 1 ? siblings[near] : near];
        const species = profile.alienSpecies;
        if (rand() < 0.8) profile.skyGradient = neighbor.sky.map((color) => ({ ...color }));
        if (rand() < 0.6) {
          profile.alienColors = neighbor.alienColors.slice();
          profile.alienMix = profile.alienColors.length > 1 ? "mixed" : profile.alienColors[0];
        }
        if (rand() < 0.4) profile.soil = neighbor.soil;
        if (rand() < 0.4) profile.dryness = neighbor.dryness;
        if (profile.poleBody === neighbor.poleBody && profile.insulators === neighbor.insulators) {
          profile.insulators = different(rand, profile.insulators, G.METAS.POOLS.insulators);
        }
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

    const tier = G.METAS.tierOf(difficulty);
    const letters = "ABCDEFGHJKLMNPRSTVWXZ".split("");
    countries.forEach((country) => {
      country.profile = profiles[country.id];
      const digits = shuffled(rand, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const plateLetters = shuffled(rand, letters);
      const emblems = evenBag(rand, country.provinceIds.length, G.METAS.POOLS.emblem);
      const emblemColors = G.METAS.FLAG_COLORS.filter((c) => !country.flag.colors.includes(c));
      country.provinceIds.forEach((id, j) => {
        const province = regions[id];
        province.areaCode = `${country.digit}${digits[j % 10]}`;
        province.plateLetter = plateLetters[j % plateLetters.length];
        province.flag = { emblem: emblems[j], color: emblemColors[Math.floor(rand() * emblemColors.length)] };
        province.profile = {
          ...country.profile,
          areaCode: tier >= 2 ? province.areaCode : null,
          plateLetter: tier >= 2 ? province.plateLetter : null,
          provinceFlag: tier >= 2 ? province.flag : null,
        };
      });
    });
    return { seed, difficulty, continents, countries, regions };
  }

  function continentCount(seed, difficulty) {
    const [lo, hi] = CONTINENT_COUNTS[difficulty] || [1, 1];
    return lo + Math.floor(G.mulberry32(G.hashSeed(`${seed}|${difficulty}|continents`))() * (hi - lo + 1));
  }

  function createPlanet(seed, difficulty) {
    const terrain = G.makeTerrain(seed, continentCount(seed, difficulty));
    for (let salt = 0; salt < 12; salt++) {
      const keyed = salt === 0 ? seed : `${seed}#${salt}`;
      const planet = tryGenerate(keyed, difficulty, terrain);
      if (planet) return finishPlanet(planet, seed, terrain);
    }
    throw new Error(`Could not build planet ${seed}`);
  }

  function finishPlanet(planet, seed, terrain) {
    planet.seed = seed;
    planet.terrain = terrain;
    planet.network = G.buildNetwork(planet);
    planet.roads = planet.network.roads;
    planet.towns = planet.network.towns;
    return planet;
  }

  function placeAt(planet, x, y) {
    const label = G.continentAt(planet.terrain, x, y);
    const continent = planet.continents[label] || planet.continents[0];
    const country = nearestOf(continent.countryIds.map((id) => planet.countries[id]), x, y);
    const province = nearestOf(country.provinceIds.map((id) => planet.regions[id]), x, y);
    const sea = G.waterAt(planet.terrain, x, y) === G.WATER.SEA;
    return { continent, country, province, sea };
  }

  function nearestRegion(planet, x, y) {
    return placeAt(planet, x, y).province;
  }

  function placeOfRegion(planet, regionId) {
    const province = planet.regions[regionId];
    const country = planet.countries[province.countryId];
    return { continent: planet.continents[country.continentId], country, province, sea: false };
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
  G.placeAt = placeAt;
  G.placeOfRegion = placeOfRegion;
})(window.ProbeDrop = window.ProbeDrop || {});
