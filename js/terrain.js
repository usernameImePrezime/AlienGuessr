(function (G) {
  const N = 320;
  const SEA = 1;
  const LAKE = 2;
  const RIVER = 3;

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

  function fbm(x, y, seed, octaves) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let total = 0;
    const count = octaves || 5;
    for (let octave = 0; octave < count; octave++) {
      value += amplitude * valueNoise(x * frequency, y * frequency, seed + octave * 9176);
      total += amplitude;
      frequency *= 2.03;
      amplitude *= 0.5;
    }
    return value / total;
  }

  function ridged(x, y, seed) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let total = 0;
    for (let octave = 0; octave < 4; octave++) {
      const n = 1 - Math.abs(valueNoise(x * frequency, y * frequency, seed + octave * 7331) * 2 - 1);
      value += n * n * amplitude;
      total += amplitude;
      frequency *= 2.1;
      amplitude *= 0.5;
    }
    return value / total;
  }

  function smoothstep(a, b, v) {
    const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function continentCenters(seed, count) {
    if (count <= 1) return [];
    const rand = G.mulberry32(G.hashSeed(`${seed}|continents|${count}`));
    let minDist = count === 2 ? 0.44 : count === 3 ? 0.38 : 0.34;
    for (let attempt = 0; attempt < 400; attempt++) {
      const pts = [];
      for (let guard = 0; guard < 300 && pts.length < count; guard++) {
        const p = { x: 0.22 + rand() * 0.56, y: 0.22 + rand() * 0.56 };
        if (pts.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= minDist)) pts.push(p);
      }
      if (pts.length === count) return pts;
      if (attempt % 40 === 39) minDist *= 0.92;
    }
    return Array.from({ length: count }, (_, i) => ({
      x: 0.5 + Math.cos((i / count) * Math.PI * 2) * 0.27,
      y: 0.5 + Math.sin((i / count) * Math.PI * 2) * 0.27,
    }));
  }

  function rawHeights(seed, centers) {
    const height = new Float32Array(N * N);
    const moist = new Float32Array(N * N);
    const ns = G.hashSeed(`${seed}|terrain-noise`) || 1;
    for (let y = 0; y < N; y++) {
      const ny = y / (N - 1);
      for (let x = 0; x < N; x++) {
        const nx = x / (N - 1);
        const wx = nx + (fbm(nx * 2.2 + 3.1, ny * 2.2, ns + 11, 4) - 0.5) * 0.7;
        const wy = ny + (fbm(nx * 2.2, ny * 2.2 + 7.7, ns + 23, 4) - 0.5) * 0.7;
        const continent = fbm(wx * 2.6, wy * 2.6, ns);
        const detail = fbm(wx * 7.5 + 1.7, wy * 7.5, ns + 101, 4);
        const mountainMask = smoothstep(0.5, 0.74, fbm(wx * 1.05 + 9, wy * 1.05, ns + 303, 3));
        const ridge = ridged(wx * 4.2 + 2.4, wy * 4.2, ns + 211);
        const edge = Math.min(nx, 1 - nx, ny, 1 - ny);
        const falloff = smoothstep(0, 0.16, edge);
        let h = continent * 0.62 + detail * 0.22 + ridge * mountainMask * 0.34;
        h = h * (0.72 + falloff * 0.28) - (1 - falloff) * 0.12;
        if (centers.length) {
          let d1 = Infinity;
          let d2 = Infinity;
          centers.forEach((c) => {
            const d = Math.hypot(wx - c.x, wy - c.y);
            if (d < d1) {
              d2 = d1;
              d1 = d;
            } else if (d < d2) d2 = d;
          });
          const channel = smoothstep(0.015, 0.11, d2 - d1);
          h = h * (0.6 + channel * 0.4) - (1 - channel) * 0.22 + smoothstep(0.34, 0.06, d1) * 0.1;
        }
        const index = y * N + x;
        height[index] = h;
        moist[index] = fbm(nx * 1.45 + 5, ny * 1.45, ns + 509, 3);
      }
    }
    return { height, moist };
  }

  function floodSea(height, sea) {
    const water = new Uint8Array(N * N);
    const stack = [];
    for (let i = 0; i < N; i++) {
      [i, (N - 1) * N + i, i * N, i * N + N - 1].forEach((index) => {
        if (height[index] <= sea && !water[index]) {
          water[index] = SEA;
          stack.push(index);
        }
      });
    }
    while (stack.length) {
      const index = stack.pop();
      const x = index % N;
      const y = (index - x) / N;
      const around = [
        x > 0 ? index - 1 : -1,
        x < N - 1 ? index + 1 : -1,
        y > 0 ? index - N : -1,
        y < N - 1 ? index + N : -1,
      ];
      around.forEach((next) => {
        if (next >= 0 && !water[next] && height[next] <= sea) {
          water[next] = SEA;
          stack.push(next);
        }
      });
    }
    for (let i = 0; i < N * N; i++) {
      if (!water[i] && height[i] <= sea) water[i] = LAKE;
    }
    return water;
  }

  function carveRivers(seed, elev, water) {
    const rand = G.mulberry32(G.hashSeed(`${seed}|rivers`));
    const flow = new Uint16Array(N * N);
    const paths = [];
    const sources = [];
    for (let attempt = 0; attempt < 900 && sources.length < 34; attempt++) {
      const x = 8 + Math.floor(rand() * (N - 16));
      const y = 8 + Math.floor(rand() * (N - 16));
      const index = y * N + x;
      if (water[index] || elev[index] < 0.3 || elev[index] > 0.85) continue;
      if (sources.some((s) => Math.abs(s.x - x) + Math.abs(s.y - y) < 22)) continue;
      sources.push({ x, y });
    }
    sources.forEach((source) => {
      let x = source.x;
      let y = source.y;
      const path = [];
      const visited = new Set();
      let stuck = 0;
      for (let step = 0; step < 700; step++) {
        const index = y * N + x;
        path.push(index);
        visited.add(index);
        if (water[index] === SEA || water[index] === LAKE) break;
        let best = -1;
        let bestH = Infinity;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
            const next = ny * N + nx;
            if (visited.has(next)) continue;
            const h = elev[next] + (dx && dy ? 0.0004 : 0);
            if (h < bestH) {
              bestH = h;
              best = next;
            }
          }
        }
        if (best < 0) break;
        if (bestH >= elev[index]) {
          stuck += 1;
          if (stuck > 6) {
            for (let dy = -2; dy <= 2; dy++) {
              for (let dx = -2; dx <= 2; dx++) {
                const lx = x + dx;
                const ly = y + dy;
                if (lx < 0 || ly < 0 || lx >= N || ly >= N || dx * dx + dy * dy > 5) continue;
                if (!water[ly * N + lx]) water[ly * N + lx] = LAKE;
              }
            }
            break;
          }
        } else {
          stuck = 0;
        }
        x = best % N;
        y = (best - x) / N;
      }
      if (path.length < 14) return;
      path.forEach((index) => {
        flow[index] = Math.min(65000, flow[index] + 1);
      });
      paths.push(path);
    });
    const rivers = paths.map((path) => {
      const points = [];
      for (let i = 0; i < path.length; i++) {
        const index = path[i];
        if (!water[index] || water[index] === RIVER) water[index] = water[index] || RIVER;
        const x = index % N;
        const y = (index - x) / N;
        points.push({
          x: ((x + 0.5) / N) * 1000,
          y: ((y + 0.5) / N) * 1000,
          w: Math.min(1, 0.25 + (i / path.length) * 0.55 + flow[index] * 0.08),
        });
      }
      return points;
    });
    return { rivers, flow };
  }

  function labelLand(water, want) {
    const comp = new Int32Array(N * N).fill(-1);
    const sizes = [];
    for (let start = 0; start < N * N; start++) {
      if (water[start] === SEA || comp[start] >= 0) continue;
      const id = sizes.length;
      let size = 0;
      const stack = [start];
      comp[start] = id;
      while (stack.length) {
        const index = stack.pop();
        size += 1;
        const x = index % N;
        const y = (index - x) / N;
        if (x > 0 && comp[index - 1] < 0 && water[index - 1] !== SEA) { comp[index - 1] = id; stack.push(index - 1); }
        if (x < N - 1 && comp[index + 1] < 0 && water[index + 1] !== SEA) { comp[index + 1] = id; stack.push(index + 1); }
        if (y > 0 && comp[index - N] < 0 && water[index - N] !== SEA) { comp[index - N] = id; stack.push(index - N); }
        if (y < N - 1 && comp[index + N] < 0 && water[index + N] !== SEA) { comp[index + N] = id; stack.push(index + N); }
      }
      sizes.push(size);
    }
    const land = sizes.reduce((a, b) => a + b, 0);
    const big = sizes.map((size, id) => ({ id, size }))
      .sort((a, b) => b.size - a.size)
      .filter((c, i) => i === 0 || c.size >= land * 0.08)
      .slice(0, Math.max(1, want));
    const continent = new Uint8Array(N * N).fill(255);
    const queue = new Int32Array(N * N);
    let head = 0;
    let tail = 0;
    const info = big.map((c, k) => ({ id: k, size: c.size, sx: 0, sy: 0 }));
    for (let i = 0; i < N * N; i++) {
      const k = big.findIndex((c) => c.id === comp[i]);
      if (k < 0) continue;
      continent[i] = k;
      queue[tail++] = i;
      info[k].sx += i % N;
      info[k].sy += Math.floor(i / N);
    }
    while (head < tail) {
      const index = queue[head++];
      const x = index % N;
      const y = (index - x) / N;
      const k = continent[index];
      [x > 0 ? index - 1 : -1, x < N - 1 ? index + 1 : -1, y > 0 ? index - N : -1, y < N - 1 ? index + N : -1].forEach((next) => {
        if (next >= 0 && continent[next] === 255) {
          continent[next] = k;
          queue[tail++] = next;
        }
      });
    }
    const continents = info.map((c) => ({
      id: c.id,
      size: c.size,
      x: ((c.sx / c.size + 0.5) / N) * 1000,
      y: ((c.sy / c.size + 0.5) / N) * 1000,
    }));
    return { continent, continents };
  }

  function makeTerrain(seed, continentCount) {
    const want = continentCount || 1;
    const { height, moist } = rawHeights(seed, continentCenters(seed, want));
    const rand = G.mulberry32(G.hashSeed(`${seed}|sea`));
    const sorted = Array.from(height).sort((a, b) => a - b);
    const waterShare = 0.5 + rand() * 0.1;
    const sea = sorted[Math.floor(sorted.length * waterShare)];
    const low = sorted[0];
    const high = sorted[sorted.length - 1];
    const water = floodSea(height, sea);
    const elev = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) {
      elev[i] = height[i] > sea
        ? (height[i] - sea) / (high - sea || 1)
        : -(sea - height[i]) / (sea - low || 1);
    }
    for (let i = 0; i < N * N; i++) {
      if (water[i] === LAKE) elev[i] = Math.min(elev[i], -0.02);
    }
    const { rivers, flow } = carveRivers(seed, elev, water);
    const { continent, continents } = labelLand(water, want);
    return { N, elev, moist, water, flow, rivers, continent, continents };
  }

  function continentAt(terrain, x, y) {
    return terrain.continent[cellOf(terrain, x, y)];
  }

  function cellOf(terrain, x, y) {
    const cx = Math.max(0, Math.min(terrain.N - 1, Math.floor((x / 1000) * terrain.N)));
    const cy = Math.max(0, Math.min(terrain.N - 1, Math.floor((y / 1000) * terrain.N)));
    return cy * terrain.N + cx;
  }

  function elevationAt(terrain, x, y) {
    const n = terrain.N;
    const fx = Math.max(0, Math.min(n - 1.001, (x / 1000) * n - 0.5));
    const fy = Math.max(0, Math.min(n - 1.001, (y / 1000) * n - 0.5));
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const e = terrain.elev;
    const a = e[y0 * n + x0];
    const b = e[y0 * n + x0 + 1];
    const c = e[(y0 + 1) * n + x0];
    const d = e[(y0 + 1) * n + x0 + 1];
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  }

  function waterAt(terrain, x, y) {
    return terrain.water[cellOf(terrain, x, y)];
  }

  function moistureAt(terrain, x, y) {
    return terrain.moist[cellOf(terrain, x, y)];
  }

  function biomeOf(elev, moist, water) {
    if (water === SEA) return "sea";
    if (water === LAKE) return "lake";
    if (elev > 0.72) return "snow";
    if (elev > 0.6) return "rock";
    if (elev > 0.55) return "highland";
    if (elev < 0.035) return "beach";
    if (moist > 0.52) return "jungle";
    if (moist < 0.46) return "dry";
    return "meadow";
  }

  function biomeAt(terrain, x, y) {
    const index = cellOf(terrain, x, y);
    return biomeOf(terrain.elev[index], terrain.moist[index], terrain.water[index]);
  }

  function isDryLand(terrain, x, y) {
    const w = waterAt(terrain, x, y);
    return w !== SEA && w !== LAKE;
  }

  G.WATER = { SEA, LAKE, RIVER };
  G.hash2 = hash2;
  G.valueNoise = valueNoise;
  G.fbm = fbm;
  G.makeTerrain = makeTerrain;
  G.elevationAt = elevationAt;
  G.waterAt = waterAt;
  G.moistureAt = moistureAt;
  G.biomeOf = biomeOf;
  G.biomeAt = biomeAt;
  G.isDryLand = isDryLand;
  G.continentAt = continentAt;
})(window.ProbeDrop = window.ProbeDrop || {});
