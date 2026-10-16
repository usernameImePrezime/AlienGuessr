(function (G) {
  const GR = 125;
  const CELL = 1000 / GR;
  const PREFIX = ["Bl", "Zor", "Glo", "Squ", "Pl", "Gr", "Fl", "Wub", "Snor", "Kr", "Yib", "Mor", "Sch", "Gl", "Pf", "Xor", "Bub", "Dr"];
  const VOWEL = ["a", "o", "u", "ee", "oo", "i", "ai", "ue", "y"];
  const SUFFIX = ["ville", "tron", "opolis", "burg", " Flats", " Pit", "ix", "ork", "oop", "ulon", " Prime", "zap", " Hollow", "nax", "blat"];

  function townName(rand) {
    const pick = (list) => list[Math.floor(rand() * list.length)];
    const core = pick(PREFIX) + pick(VOWEL) + (rand() < 0.6 ? pick(["rb", "mp", "x", "zz", "g", "b", "ng", "lp", "t"]) : "");
    return core + pick(SUFFIX);
  }

  function buildGrid(terrain) {
    const elev = new Float32Array(GR * GR);
    const blocked = new Uint8Array(GR * GR);
    const river = new Uint8Array(GR * GR);
    for (let r = 0; r < GR; r++) {
      for (let c = 0; c < GR; c++) {
        const x = (c + 0.5) * CELL;
        const y = (r + 0.5) * CELL;
        const index = r * GR + c;
        const water = G.waterAt(terrain, x, y);
        elev[index] = G.elevationAt(terrain, x, y);
        blocked[index] = water === G.WATER.SEA || water === G.WATER.LAKE ? 1 : 0;
        river[index] = water === G.WATER.RIVER ? 1 : 0;
      }
    }
    const slope = new Float32Array(GR * GR);
    const cost = new Float32Array(GR * GR);
    const nearWater = new Uint8Array(GR * GR);
    for (let r = 0; r < GR; r++) {
      for (let c = 0; c < GR; c++) {
        const index = r * GR + c;
        let s = 0;
        let wet = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr < 0 || cc < 0 || rr >= GR || cc >= GR) continue;
            const other = rr * GR + cc;
            s = Math.max(s, Math.abs(elev[other] - elev[index]));
          }
        }
        for (let dr = -3; dr <= 3 && !wet; dr++) {
          for (let dc = -3; dc <= 3; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr < 0 || cc < 0 || rr >= GR || cc >= GR) continue;
            const other = rr * GR + cc;
            if (blocked[other] || river[other]) {
              wet = 1;
              break;
            }
          }
        }
        slope[index] = s;
        nearWater[index] = wet;
        cost[index] = 1 + s * 140 + Math.max(0, elev[index] - 0.45) * 7 + (river[index] ? 9 : 0);
      }
    }
    return { elev, blocked, river, slope, cost, nearWater };
  }

  function heapPush(heap, scores, index, score) {
    heap.push(index);
    scores.push(score);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (scores[parent] <= scores[i]) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      [scores[parent], scores[i]] = [scores[i], scores[parent]];
      i = parent;
    }
  }

  function heapPop(heap, scores) {
    const top = heap[0];
    const lastIndex = heap.pop();
    const lastScore = scores.pop();
    if (heap.length) {
      heap[0] = lastIndex;
      scores[0] = lastScore;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < heap.length && scores[left] < scores[smallest]) smallest = left;
        if (right < heap.length && scores[right] < scores[smallest]) smallest = right;
        if (smallest === i) break;
        [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
        [scores[smallest], scores[i]] = [scores[i], scores[smallest]];
        i = smallest;
      }
    }
    return top;
  }

  function route(grid, roadMask, start, goal) {
    if (grid.blocked[start] || grid.blocked[goal]) return null;
    const g = new Float32Array(GR * GR).fill(Infinity);
    const came = new Int32Array(GR * GR).fill(-1);
    const closed = new Uint8Array(GR * GR);
    const heap = [];
    const scores = [];
    const gc = goal % GR;
    const gr = (goal - gc) / GR;
    const h = (index) => {
      const c = index % GR;
      const r = (index - c) / GR;
      const dx = Math.abs(c - gc);
      const dy = Math.abs(r - gr);
      return (Math.max(dx, dy) + 0.414 * Math.min(dx, dy)) * 0.4;
    };
    g[start] = 0;
    heapPush(heap, scores, start, h(start));
    let expanded = 0;
    while (heap.length && expanded < GR * GR * 1.5) {
      const current = heapPop(heap, scores);
      if (closed[current]) continue;
      closed[current] = 1;
      expanded += 1;
      if (current === goal) break;
      const c = current % GR;
      const r = (current - c) / GR;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= GR || cc >= GR) continue;
          const next = rr * GR + cc;
          if (closed[next] || grid.blocked[next]) continue;
          if (dr && dc && (grid.blocked[r * GR + cc] || grid.blocked[rr * GR + c])) continue;
          const step = ((grid.cost[current] + grid.cost[next]) / 2) * (dr && dc ? 1.414 : 1) * (roadMask[next] ? 0.4 : 1);
          const score = g[current] + step;
          if (score < g[next]) {
            g[next] = score;
            came[next] = current;
            heapPush(heap, scores, next, score + h(next));
          }
        }
      }
    }
    if (came[goal] < 0 && start !== goal) return null;
    const path = [goal];
    let cursor = goal;
    while (cursor !== start) {
      cursor = came[cursor];
      if (cursor < 0) return null;
      path.push(cursor);
    }
    return path.reverse();
  }

  function chaikin(points, passes) {
    let out = points;
    for (let pass = 0; pass < passes; pass++) {
      if (out.length < 3) return out;
      const next = [out[0]];
      for (let i = 0; i < out.length - 1; i++) {
        const a = out[i];
        const b = out[i + 1];
        next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
        next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
      }
      next.push(out[out.length - 1]);
      out = next;
    }
    return out;
  }

  function pathToRoad(path, cls, rand) {
    const raw = path.map((index) => {
      const c = index % GR;
      const r = (index - c) / GR;
      return {
        x: (c + 0.5) * CELL + (rand() - 0.5) * CELL * 0.5,
        y: (r + 0.5) * CELL + (rand() - 0.5) * CELL * 0.5,
      };
    });
    raw[0] = { x: (path[0] % GR + 0.5) * CELL, y: (Math.floor(path[0] / GR) + 0.5) * CELL };
    const tail = path[path.length - 1];
    raw[raw.length - 1] = { x: (tail % GR + 0.5) * CELL, y: (Math.floor(tail / GR) + 0.5) * CELL };
    const thinned = raw.filter((point, i) => i === 0 || i === raw.length - 1 || i % 2 === 0);
    const points = chaikin(thinned, 3);
    let length = 0;
    const cumulative = [0];
    for (let i = 1; i < points.length; i++) {
      length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      cumulative.push(length);
    }
    return { points, cls, length, cumulative };
  }

  function cellIndexOf(x, y) {
    const c = Math.max(0, Math.min(GR - 1, Math.floor(x / CELL)));
    const r = Math.max(0, Math.min(GR - 1, Math.floor(y / CELL)));
    return r * GR + c;
  }

  function placeTowns(planet, grid, rand) {
    const candidates = [];
    for (let r = 2; r < GR - 2; r += 2) {
      for (let c = 2; c < GR - 2; c += 2) {
        const index = r * GR + c;
        if (grid.blocked[index] || grid.river[index]) continue;
        const e = grid.elev[index];
        if (e > 0.78 || grid.slope[index] > 0.08) continue;
        const score = (1 - e) * 0.6 + grid.nearWater[index] * 0.7 + (0.06 - grid.slope[index]) * 6 + rand() * 0.45;
        candidates.push({ index, x: (c + 0.5) * CELL, y: (r + 0.5) * CELL, score });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    candidates.forEach((cand) => {
      cand.regionId = G.nearestRegion(planet, cand.x, cand.y).id;
    });
    const towns = [];
    const clear = (cand, gap) => towns.every((town) => Math.hypot(town.x - cand.x, town.y - cand.y) > gap);
    const add = (cand, kind) => {
      const province = planet.regions[cand.regionId];
      towns.push({ ...cand, kind, countryId: province.countryId, continentId: province.continentId });
    };
    planet.countries.forEach((country) => {
      const pick = candidates.find((cand) => planet.regions[cand.regionId].countryId === country.id && clear(cand, 60));
      if (pick) add(pick, "city");
    });
    const townCap = planet.difficulty === "hard" ? 80 : planet.difficulty === "medium" ? 60 : 46;
    const cap = Math.min(townCap, planet.countries.length + planet.regions.length);
    planet.regions.forEach((region) => {
      if (towns.length >= cap || towns.some((town) => town.regionId === region.id)) return;
      const pick = candidates.find((cand) => cand.regionId === region.id && clear(cand, 52));
      if (pick) add(pick, "village");
    });
    const target = Math.min(cap, planet.regions.length + 10);
    for (let i = 0; i < candidates.length && towns.length < target; i++) {
      if (clear(candidates[i], 95)) add(candidates[i], "village");
    }
    const used = new Set();
    towns.forEach((town) => {
      let name = townName(rand);
      for (let i = 0; i < 6 && used.has(name); i++) name = townName(rand);
      used.add(name);
      town.name = name;
      town.radius = town.kind === "city" ? 30 : 18;
      delete town.score;
    });
    return towns;
  }

  function buildNetwork(planet) {
    const rand = G.mulberry32(G.hashSeed(`${planet.seed}|${planet.difficulty}|roads`));
    const grid = buildGrid(planet.terrain);
    const towns = placeTowns(planet, grid, rand);
    const roadMask = new Uint8Array(GR * GR);
    const roads = [];
    const addRoute = (from, to, cls) => {
      const path = route(grid, roadMask, from, to);
      if (!path || path.length < 3) return false;
      path.forEach((index) => {
        roadMask[index] = 1;
      });
      roads.push(pathToRoad(path, cls, rand));
      return true;
    };

    const edges = [];
    planet.continents.forEach((continent) => {
      const members = towns.map((town, i) => i).filter((i) => towns[i].continentId === continent.id);
      if (!members.length) return;
      const inTree = new Set([members[0]]);
      while (inTree.size < members.length) {
        let best = null;
        inTree.forEach((a) => {
          members.forEach((b) => {
            if (inTree.has(b)) return;
            const dist = Math.hypot(towns[b].x - towns[a].x, towns[b].y - towns[a].y);
            if (!best || dist < best.dist) best = { a, b, dist };
          });
        });
        inTree.add(best.b);
        edges.push(best);
      }
    });
    edges.sort((p, q) => p.dist - q.dist);
    const linked = new Set();
    edges.forEach((edge) => {
      if (addRoute(towns[edge.a].index, towns[edge.b].index, "major")) {
        linked.add(`${Math.min(edge.a, edge.b)}-${Math.max(edge.a, edge.b)}`);
      }
    });
    towns.forEach((town, a) => {
      const others = towns
        .map((other, b) => ({ b, dist: Math.hypot(other.x - town.x, other.y - town.y) }))
        .filter((item) => item.b !== a && item.dist < 240 && towns[item.b].continentId === town.continentId)
        .sort((p, q) => p.dist - q.dist)
        .slice(0, 3);
      others.forEach((item) => {
        const key = `${Math.min(a, item.b)}-${Math.max(a, item.b)}`;
        if (linked.has(key) || rand() > 0.45) return;
        linked.add(key);
        addRoute(town.index, towns[item.b].index, "major");
      });
    });
    towns.forEach((town) => {
      const spurs = town.kind === "city" ? 2 : 1;
      for (let s = 0; s < spurs; s++) {
        const angle = rand() * Math.PI * 2;
        const dist = 50 + rand() * 90;
        const x = Math.max(10, Math.min(990, town.x + Math.cos(angle) * dist));
        const y = Math.max(10, Math.min(990, town.y + Math.sin(angle) * dist));
        const target = cellIndexOf(x, y);
        if (grid.blocked[target]) continue;
        addRoute(town.index, target, "minor");
      }
    });
    const covered = new Set();
    roads.forEach((road) => {
      road.points.forEach((point, i) => {
        if (i % 4 === 0) covered.add(G.nearestRegion(planet, point.x, point.y).id);
      });
    });
    planet.regions.forEach((region) => {
      if (covered.has(region.id)) return;
      const town = towns.find((t) => t.regionId === region.id);
      if (!town) {
        const hub = towns
          .filter((t) => t.continentId === region.continentId)
          .sort((p, q) => Math.hypot(p.x - region.site.x, p.y - region.site.y) - Math.hypot(q.x - region.site.x, q.y - region.site.y))[0];
        for (let attempt = 0; hub && attempt < 12; attempt++) {
          const x = region.site.x + (rand() - 0.5) * 60;
          const y = region.site.y + (rand() - 0.5) * 60;
          const target = cellIndexOf(x, y);
          if (grid.blocked[target] || G.nearestRegion(planet, x, y) !== region) continue;
          if (addRoute(hub.index, target, "minor")) return;
        }
      }
      const start = town ? town.index : cellIndexOf(region.site.x, region.site.y);
      for (let attempt = 0; attempt < 16; attempt++) {
        const angle = rand() * Math.PI * 2;
        const dist = 30 + rand() * 70;
        const sx = start % GR;
        const x = Math.max(10, Math.min(990, (sx + 0.5) * CELL + Math.cos(angle) * dist));
        const y = Math.max(10, Math.min(990, (Math.floor(start / GR) + 0.5) * CELL + Math.sin(angle) * dist));
        const target = cellIndexOf(x, y);
        if (grid.blocked[target] || G.nearestRegion(planet, x, y) !== region) continue;
        if (addRoute(start, target, "minor")) break;
      }
    });
    if (!roads.length) {
      const fallback = [];
      for (let i = 0; i < 400 && fallback.length < 2; i++) {
        const index = Math.floor(rand() * GR * GR);
        if (!grid.blocked[index]) fallback.push(index);
      }
      if (fallback.length === 2) addRoute(fallback[0], fallback[1], "minor");
    }
    return { roads, towns };
  }

  function pointAlong(road, along) {
    const cum = road.cumulative;
    let lo = 0;
    let hi = cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= along) lo = mid;
      else hi = mid;
    }
    const a = road.points[lo];
    const b = road.points[hi];
    const span = cum[hi] - cum[lo] || 1;
    const t = Math.max(0, Math.min(1, (along - cum[lo]) / span));
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }

  function randomRoadSpot(planet, rng) {
    const roads = planet.roads;
    if (!roads.length) {
      return { x: planet.regions[0].site.x, y: planet.regions[0].site.y, heading: rng() * Math.PI * 2, road: -1, along: 0 };
    }
    const total = roads.reduce((sum, road) => sum + road.length, 0);
    let fallback = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      let pick = rng() * total;
      let roadIndex = 0;
      while (roadIndex < roads.length - 1 && pick > roads[roadIndex].length) {
        pick -= roads[roadIndex].length;
        roadIndex += 1;
      }
      const road = roads[roadIndex];
      const along = Math.min(road.length - 0.5, Math.max(0.5, pick));
      const point = pointAlong(road, along);
      const forward = rng() < 0.5;
      const spot = {
        x: point.x,
        y: point.y,
        heading: forward ? point.angle : point.angle + Math.PI,
        road: roadIndex,
        along,
        forward,
      };
      if (!fallback) fallback = spot;
      if (G.waterAt(planet.terrain, spot.x, spot.y) === 0) return spot;
    }
    return fallback;
  }

  function roadAhead(planet, location, reach) {
    const road = planet.roads[location.road];
    const heading = location.heading;
    const fx = Math.cos(heading);
    const fy = Math.sin(heading);
    const toCamera = (p) => {
      const dx = p.x - location.x;
      const dy = p.y - location.y;
      return { z: dx * fx + dy * fy, x: dx * -fy + dy * fx };
    };
    if (!road) return [{ z: 0, x: 0 }, { z: reach, x: 0 }];
    const along = location.along;
    const roadAngle = pointAlong(road, along).angle;
    const forward = Math.cos(roadAngle - heading) > 0;
    const out = [];
    for (let d = 0; d <= reach; d += 2) {
      const at = forward ? along + d : along - d;
      if (at < 0 || at > road.length) break;
      out.push(toCamera(pointAlong(road, at)));
    }
    return out.length > 1 ? out : [{ z: 0, x: 0 }, { z: reach, x: 0 }];
  }

  function settlementAt(planet, x, y) {
    let best = null;
    let bestDist = Infinity;
    planet.towns.forEach((town) => {
      const dist = Math.hypot(town.x - x, town.y - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = town;
      }
    });
    if (!best) return { kind: "wild", town: null, dist: Infinity };
    if (best.kind === "city" && bestDist < best.radius) return { kind: "city", town: best, dist: bestDist };
    if (bestDist < best.radius * (best.kind === "city" ? 1.8 : 1)) return { kind: "village", town: best, dist: bestDist };
    return { kind: "wild", town: best, dist: bestDist };
  }

  function buildSpots(planet) {
    const target = { easy: 1000, medium: 5000, hard: 10000 }[planet.difficulty] || 1000;
    const roads = planet.roads || [];
    let total = 0;
    roads.forEach((road) => {
      total += road.length;
    });
    if (!roads.length || total < 1) return [];
    const spots = [];
    let step = Math.max(0.35, total / target);
    for (let pass = 0; pass < 4 && spots.length < target; pass++) {
      roads.forEach((road, roadIndex) => {
        for (let along = 0.4 + pass * step * 0.37; along < road.length - 0.3 && spots.length < target; along += step) {
          const point = pointAlong(road, along);
          if (G.waterAt(planet.terrain, point.x, point.y) !== 0) continue;
          const region = G.nearestRegion(planet, point.x, point.y);
          spots.push({
            regionId: region.id,
            x: Math.round(point.x * 100) / 100,
            y: Math.round(point.y * 100) / 100,
            heading: point.angle,
            road: roadIndex,
            along,
          });
        }
      });
      step *= 0.55;
    }
    return spots;
  }

  G.buildNetwork = buildNetwork;
  G.buildSpots = buildSpots;
  G.randomRoadSpot = randomRoadSpot;
  G.roadAhead = roadAhead;
  G.settlementAt = settlementAt;
})(window.ProbeDrop = window.ProbeDrop || {});
