(function (G) {
  const { INK, TAU, clamp, col, mixC, shade, inkW, paint, stroke } = G.ink;
  const P = G.props;
  const ROAD_M = 7;
  const FAR_M = 60;
  const VERT = 650;
  const COLUMNS = 96;

  function stableRand(key) {
    return G.mulberry32(G.hashSeed(key));
  }

  function shownFeatures(profile, rng, kind) {
    const M = G.METAS;
    const tier = M.tierOf(profile.difficulty);
    const rural = kind !== "city";
    const available = {
      skyEvent: true,
      stars: true,
      building: true,
      vegetation: true,
      aliens: true,
      fence: profile.fence !== "none" && rural,
      banner: profile.banner !== "none",
      sign: true,
      pole: true,
      groundPattern: profile.groundPattern !== "plain" && rural,
      weather: profile.weather !== "clear",
      landmark: true,
      bollard: !!profile.bollard && rural,
      chevron: !!profile.chevron && rural,
      guardrail: !!profile.guardrail && rural,
      kmMarker: !!profile.kmMarker && rural,
      billboard: !!(profile.domain || profile.areaCode),
      plate: !!profile.plate,
    };
    const keys = Object.keys(available).filter((key) => available[key]);
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    const cap = [5, 6, 7][tier];
    const shown = { probeCar: !!profile.probeCar && rng() < M.FEATURE_CHANCE.probeCar };
    let count = 0;
    keys.forEach((key) => {
      shown[key] = count < cap && rng() < M.FEATURE_CHANCE[key];
      if (shown[key]) count += 1;
    });
    const fallback = tier > 0 ? ["sign", "bollard", "billboard", "aliens", "building"] : ["sign", "aliens", "building", "vegetation", "skyEvent"];
    fallback.forEach((key) => {
      if (count >= 2 || shown[key] || !available[key]) return;
      shown[key] = true;
      count += 1;
    });
    return shown;
  }

  function camera(W, H, lane) {
    const y0 = H * 0.5;
    const f = (W * 0.5) / Math.tan((38 * Math.PI) / 180);
    return {
      W,
      H,
      cx: W / 2,
      y0,
      f,
      ch: 1.6,
      lane,
      p(x, z, y) {
        const k = this.f / Math.max(0.3, z);
        return { x: this.cx + (x - this.lane) * k, y: this.y0 + (this.ch - (y || 0)) * k, s: k };
      },
    };
  }

  function roadModel(planet, loc, rng, kind) {
    const raw = G.roadAhead(planet, loc, 90).map((p) => ({ z: p.z * ROAD_M, x: p.x * ROAD_M }));
    const pts = [{ z: 0, x: 0 }];
    raw.forEach((p) => {
      if (p.z > pts[pts.length - 1].z + 0.5) pts.push(p);
    });
    if (pts.length < 2) pts.push({ z: 100, x: 0 });
    const amp = kind === "city" ? 0 : (0.18 + rng() * 0.32) * (rng() < 0.5 ? -1 : 1);
    const wave = 45 + rng() * 70;
    const phase = rng() * TAU;
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const slope = (last.x - prev.x) / (last.z - prev.z || 1);
    function x(z) {
      let base;
      if (z >= last.z) base = last.x + (z - last.z) * slope;
      else {
        let i = 1;
        while (i < pts.length - 1 && pts[i].z < z) i += 1;
        const a = pts[i - 1];
        const b = pts[i];
        const t = (z - a.z) / (b.z - a.z || 1);
        base = a.x + (b.x - a.x) * t;
      }
      const sway = amp * (Math.sin((z / wave) * TAU + phase) - Math.sin(phase)) * Math.min(1, z / 30);
      return base + sway;
    }
    return { x };
  }

  function palette(profile, biome) {
    const sky0 = profile.skyGradient[0];
    const sky1 = profile.skyGradient[1];
    const glow = mixC(shade(profile.accentColor, 24), { h: 48, s: 90, l: 86 }, 0.55);
    let ground = profile.groundColor;
    if (biome === "jungle") ground = shade(ground, -6, 8);
    if (biome === "dry") ground = mixC(ground, { h: 40, s: 48, l: 70 }, 0.55);
    if (biome === "beach") ground = mixC(ground, { h: 44, s: 60, l: 78 }, 0.75);
    if (biome === "highland") ground = shade(ground, -3, -10);
    if (biome === "rock") ground = mixC(ground, { h: 265, s: 14, l: 60 }, 0.55);
    if (biome === "snow") ground = mixC(ground, { h: 215, s: 35, l: 93 }, 0.82);
    const soil = profile.soil ? G.METAS.SOIL_TINT[profile.soil] : null;
    if (soil && biome !== "snow") ground = mixC(ground, soil, 0.42);
    if (profile.dryness === "lush") ground = shade(ground, -4, 10);
    if (profile.dryness === "scrub") ground = mixC(ground, { h: 42, s: 40, l: 62 }, 0.22);
    if (profile.dryness === "dusty") ground = mixC(ground, { h: ground.h, s: 18, l: 74 }, 0.45);
    const plantA = { h: ground.h + 16, s: clamp(ground.s + 26, 44, 84), l: clamp(ground.l - 12, 30, 60) };
    const plantB = { h: ground.h - 24, s: clamp(ground.s + 20, 44, 84), l: clamp(ground.l - 2, 36, 66) };
    const plantC = { h: ground.h + 48, s: 72, l: 52 };
    const accent = profile.accentColor;
    const hill = shade(mixC(ground, plantA, 0.5), -6);
    const mountain = mixC({ h: 262, s: 22, l: 58 }, ground, 0.25);
    return {
      sky0,
      sky1,
      glow,
      ground,
      groundFar: mixC(ground, sky1, 0.42),
      plantA,
      plantB,
      plantC,
      hill,
      mountain,
      trunk: { h: (ground.h + 190) % 360, s: 34, l: 46 },
      rock: mixC({ h: 270, s: 14, l: 62 }, ground, 0.3),
      dirt: biome === "snow" ? { h: 220, s: 18, l: 82 } : mixC(soil ? mixC(profile.pathColor, soil, 0.55) : profile.pathColor, ground, 0.12),
      pop: { h: accent.h + 180, s: 82, l: 66 },
      pop2: { h: ground.h + 150, s: 85, l: 68 },
      density: { lush: 1.25, scrub: 0.7, dusty: 0.4 }[profile.dryness] || 1,
    };
  }

  // ---------- paper ----------

  let paperCanvas = null;
  function paperTexture() {
    if (paperCanvas) return paperCanvas;
    const size = 256;
    paperCanvas = document.createElement("canvas");
    paperCanvas.width = size;
    paperCanvas.height = size;
    const ctx = paperCanvas.getContext("2d");
    const img = ctx.createImageData(size, size);
    const rand = G.mulberry32(77031);
    for (let i = 0; i < size * size; i++) {
      const x = i % size;
      const y = (i - x) / size;
      const fiber = G.valueNoise(x * 0.09, y * 0.02, 991) * 18 + G.valueNoise(x * 0.3, y * 0.3, 313) * 10;
      const v = 255 - rand() * 22 - fiber;
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v - 3;
      img.data[i * 4 + 2] = v - 8;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return paperCanvas;
  }

  // ---------- sky ----------

  function drawSky(ctx, cam, pal, profile, rng, U) {
    const { W, y0 } = cam;
    const g = ctx.createLinearGradient(0, 0, 0, y0);
    g.addColorStop(0, col(pal.sky0));
    g.addColorStop(1, col(pal.sky1));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, y0 + 4);
    void profile;
    void rng;
    void U;
  }

  function crescentPath(ctx, x, y, r, d, rot) {
    const h = Math.sqrt(Math.max(0, r * r - (d * d) / 4));
    const t1 = Math.atan2(h, d / 2);
    const p1 = Math.atan2(-h, -d / 2);
    const p2 = Math.atan2(h, -d / 2);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.moveTo(Math.cos(t1) * r, Math.sin(t1) * r);
    ctx.arc(0, 0, r, t1, TAU - t1, false);
    ctx.arc(d, 0, r, p1, p2, true);
    ctx.closePath();
    ctx.restore();
  }

  function drawMoons(ctx, cam, planet, rng, U) {
    const rand = stableRand(`${planet.seed}|moons`);
    const count = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      const color = { h: rand() * 360, s: 55, l: 86 };
      const r = (18 + rand() * 30) * U;
      const x = cam.W * (0.08 + rng() * 0.84);
      const y = cam.y0 * (0.12 + rng() * 0.45);
      const full = rand() < 0.3;
      const rot = -0.6 + rng() * 1.2;
      if (full) {
        paint(ctx, () => ctx.arc(x, y, r, 0, TAU), col(color, -14, 4), { ink: 1.6 * U });
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.clip();
        ctx.fillStyle = col(color);
        ctx.beginPath();
        ctx.arc(x - r * 0.16, y - r * 0.16, r * 0.92, 0, TAU);
        ctx.fill();
        for (let k = 0; k < 3; k++) {
          const cx = x + (rand() - 0.5) * r;
          const cy = y + (rand() - 0.5) * r;
          const cr = r * (0.12 + rand() * 0.1);
          paint(ctx, () => ctx.arc(cx, cy, cr, 0, TAU), col(color, -12, 0, 0.9), { ink: 0.9 * U });
          paint(ctx, () => ctx.arc(cx + cr * 0.2, cy + cr * 0.2, cr * 0.65, 0, TAU), col(color, -4));
        }
        ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
        ctx.lineWidth = Math.max(1, r * 0.09);
        ctx.beginPath();
        ctx.arc(x, y, r * 0.76, Math.PI * 1.08, Math.PI * 1.42);
        ctx.stroke();
        ctx.restore();
      } else {
        paint(ctx, () => crescentPath(ctx, x, y, r, r * 0.7, rot), col(color), { ink: 1.6 * U, glaze: col(color, -18), edge: r * 0.22 });
        paint(ctx, () => ctx.arc(x - Math.cos(rot) * r * 0.55, y - Math.sin(rot) * r * 0.55, r * 0.08, 0, TAU), "rgba(255, 255, 255, 0.7)");
      }
    }
  }

  function drawClouds(ctx, cam, pal, rng, U) {
    const n = 2 + Math.floor(rng() * 2);
    const color = mixC(pal.sky1, { h: 220, s: 28, l: 96 }, 0.72);
    for (let i = 0; i < n; i++) {
      const cx = cam.W * (0.14 + rng() * 0.72);
      const cy = cam.y0 * (0.16 + rng() * 0.38);
      const w = (110 + rng() * 80) * U * (0.62 + cy / cam.y0);
      const h = w * 0.34;
      cloudShape(ctx, cx, cy, w, h, color, 1.2 * U);
    }
  }

  function cloudShape(ctx, cx, cy, w, h, color, iw) {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.46, cy + h * 0.18);
      ctx.quadraticCurveTo(cx - w * 0.5, cy - h * 0.05, cx - w * 0.26, cy - h * 0.16);
      ctx.quadraticCurveTo(cx - w * 0.18, cy - h * 0.62, cx, cy - h * 0.42);
      ctx.quadraticCurveTo(cx + w * 0.16, cy - h * 0.7, cx + w * 0.28, cy - h * 0.2);
      ctx.quadraticCurveTo(cx + w * 0.5, cy - h * 0.08, cx + w * 0.46, cy + h * 0.16);
      ctx.quadraticCurveTo(cx, cy + h * 0.34, cx - w * 0.46, cy + h * 0.18);
      ctx.closePath();
    };
    paint(ctx, path, col(color), { ink: Math.max(2, iw * 1.8) });
  }

  const STAR_PATTERNS = {
    cross: [[0.5, 0.2], [0.5, 0.3], [0.5, 0.4], [0.4, 0.3], [0.6, 0.3]],
    arc: [[0.25, 0.4], [0.33, 0.28], [0.44, 0.2], [0.56, 0.2], [0.67, 0.28], [0.75, 0.4]],
    cluster: [[0.7, 0.2], [0.73, 0.24], [0.68, 0.27], [0.75, 0.18], [0.71, 0.3], [0.66, 0.22]],
    ring: Array.from({ length: 8 }, (_, i) => [0.3 + Math.cos((i / 8) * TAU) * 0.08, 0.28 + Math.sin((i / 8) * TAU) * 0.1]),
    scatter: [[0.15, 0.15], [0.4, 0.35], [0.62, 0.12], [0.85, 0.3], [0.3, 0.22], [0.75, 0.42]],
  };

  function sparkle(ctx, x, y, r, U) {
    paint(ctx, () => {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU - Math.PI / 2;
        const rr = i % 2 ? r * 0.3 : r;
        if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
    }, "#fffbe0", { ink: 1.1 * U });
    const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
    halo.addColorStop(0, "rgba(255, 252, 220, 0.5)");
    halo.addColorStop(1, "rgba(255, 252, 220, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x - r * 0.08, y - r * 0.08, r * 0.14, 0, TAU);
    ctx.fill();
  }

  function drawStars(ctx, cam, profile, rng, U) {
    const pattern = STAR_PATTERNS[profile.starPattern] || STAR_PATTERNS.scatter;
    const shiftX = (rng() - 0.5) * 0.2;
    pattern.forEach(([px, py], i) => {
      sparkle(ctx, cam.W * clamp(px + shiftX, 0.03, 0.97), cam.y0 * py * 1.4, (7 + (i % 3) * 3) * U, U);
    });
  }

  function drawSkyEvent(ctx, cam, profile, rng, U) {
    const kind = profile.skyEvent;
    const x = cam.W * (0.18 + rng() * 0.64);
    const y = cam.y0 * (0.25 + rng() * 0.25);
    const R = (40 + rng() * 30) * U;
    const c = profile.accentColor;
    const iw = 1.6 * U;
    if (kind === "ring") {
      paint(ctx, () => ctx.ellipse(x, y, R * 2, R * 0.5, -0.25, Math.PI, TAU), "rgba(0,0,0,0)", { ink: iw * 3 });
      paint(ctx, () => ctx.arc(x, y, R, 0, TAU), col(c, 10), { ink: iw, glaze: col(c, -20), edge: R * 0.4 });
      stroke(ctx, () => ctx.ellipse(x, y, R * 2, R * 0.5, -0.25, Math.PI, TAU), col(c, 30), iw * 2);
      stroke(ctx, () => ctx.ellipse(x, y, R * 2, R * 0.5, -0.25, 0, Math.PI), INK, iw * 3);
      stroke(ctx, () => ctx.ellipse(x, y, R * 2, R * 0.5, -0.25, 0, Math.PI), col(c, 30), iw * 2);
    } else if (kind === "eye") {
      paint(ctx, () => {
        ctx.moveTo(x - R * 1.6, y);
        ctx.quadraticCurveTo(x, y - R * 1.4, x + R * 1.6, y);
        ctx.quadraticCurveTo(x, y + R * 1.4, x - R * 1.6, y);
      }, "#fff8fb", { ink: iw * 1.4 });
      paint(ctx, () => ctx.arc(x + R * 0.15, y, R * 0.62, 0, TAU), col(c), { ink: iw });
      paint(ctx, () => ctx.arc(x + R * 0.2, y, R * 0.3, 0, TAU), INK);
      paint(ctx, () => ctx.arc(x, y - R * 0.2, R * 0.13, 0, TAU), "#fff");
      stroke(ctx, () => {
        for (let i = 0; i < 5; i++) {
          const t = -0.8 + i * 0.4;
          ctx.moveTo(x + t * R, y - R * 0.68 + Math.abs(t) * R * 0.25);
          ctx.lineTo(x + t * R * 1.3, y - R * 1.05);
        }
      }, INK, iw);
    } else if (kind === "jelly") {
      for (let i = 0; i < 6; i++) {
        const tx = x - R * 0.7 + (i / 5) * R * 1.4;
        stroke(ctx, () => {
          ctx.moveTo(tx, y);
          ctx.bezierCurveTo(tx - R * 0.3, y + R * 0.8, tx + R * 0.3, y + R * 1.2, tx - R * 0.1, y + R * 1.9);
        }, col(c, 10, 0, 0.8), iw * 1.6);
      }
      paint(ctx, () => {
        ctx.moveTo(x - R, y + R * 0.1);
        ctx.bezierCurveTo(x - R, y - R * 1.2, x + R, y - R * 1.2, x + R, y + R * 0.1);
        for (let i = 0; i < 6; i++) {
          const a = x + R - ((i + 0.5) / 6) * R * 2;
          ctx.quadraticCurveTo(a, y + R * 0.4, a - R / 6, y + R * 0.1);
        }
        ctx.closePath();
      }, col(c, 18, 0, 0.85), { ink: iw, glaze: col(c, -10), edge: R * 0.3 });
    } else if (kind === "shard") {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + rng() * 0.4;
        const d = R * (i === 0 ? 0 : 0.9 + rng() * 0.8);
        const sx = x + Math.cos(a) * d;
        const sy = y + Math.sin(a) * d * 0.7;
        const r = R * (i === 0 ? 0.8 : 0.25 + rng() * 0.25);
        paint(ctx, () => {
          for (let k = 0; k < 5; k++) {
            const b = (k / 5) * TAU + rng() * 0.5;
            const rr = r * (0.7 + rng() * 0.4);
            if (k === 0) ctx.moveTo(sx + Math.cos(b) * rr, sy + Math.sin(b) * rr);
            else ctx.lineTo(sx + Math.cos(b) * rr, sy + Math.sin(b) * rr);
          }
          ctx.closePath();
        }, col(c, (rng() - 0.5) * 14), { ink: iw, glaze: col(c, -24), edge: r * 0.3 });
      }
    } else if (kind === "spiral") {
      const colors = [c, shade(c, 16), { h: (c.h + 60) % 360, s: 70, l: 78 }, { h: (c.h + 180) % 360, s: 60, l: 80 }];
      for (let k = 0; k < 4; k++) {
        stroke(ctx, () => {
          for (let i = 0; i <= 120; i++) {
            const t = i / 120;
            const a = t * TAU * 2.2 + (k * TAU) / 4;
            const r = R * 0.1 + t * R * 3.2;
            const px = x + Math.cos(a) * r * 1.3;
            const py = y + Math.sin(a) * r * 0.6;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
        }, col(colors[k], 0, 0, 0.5), R * 0.28);
      }
      stroke(ctx, () => {
        for (let i = 0; i <= 120; i++) {
          const t = i / 120;
          const a = t * TAU * 2.2;
          const r = R * 0.1 + t * R * 3.2;
          const px = x + Math.cos(a) * r * 1.3;
          const py = y + Math.sin(a) * r * 0.6;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
      }, col(INK === "#1b1033" ? { h: 260, s: 50, l: 20 } : c, 0, 0, 0.5), iw);
    } else {
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        pts.push({ x: x - R * 3 + t * R * 6, y: y + Math.sin(t * TAU * 1.3) * R * 0.6 });
      }
      pts.forEach((p, i) => {
        if (i % 2) return;
        const r = R * (0.28 - Math.abs(i / 40 - 0.5) * 0.3);
        paint(ctx, () => ctx.arc(p.x, p.y, r, 0, TAU), col(c, i % 4 ? 8 : -4), { ink: iw });
      });
      const head = pts[pts.length - 1];
      paint(ctx, () => ctx.arc(head.x + R * 0.2, head.y, R * 0.34, 0, TAU), col(c, 4), { ink: iw });
      paint(ctx, () => ctx.arc(head.x + R * 0.32, head.y - R * 0.08, R * 0.11, 0, TAU), "#fff", { ink: iw * 0.7 });
    }
  }

  // ---------- horizon ----------

  function horizonProfile(cam, planet, loc) {
    const t = planet.terrain;
    const eCam = Math.max(0, G.elevationAt(t, loc.x, loc.y));
    const camH = eCam * VERT + cam.ch + 6;
    const bands = { far: [], mid: [], near: [] };
    const meta = { far: [], mid: [], near: [] };
    const waterY = [];
    const waterD = [];
    for (let i = 0; i <= COLUMNS; i++) {
      const sx = (i / COLUMNS) * cam.W;
      const ang = Math.atan((sx - cam.cx) / cam.f);
      const cosA = Math.cos(ang);
      const dir = loc.heading + ang;
      const dx = Math.cos(dir);
      const dy = Math.sin(dir);
      const top = { far: cam.y0, mid: cam.y0, near: cam.y0 };
      const info = { far: { e: 0, m: 0.5 }, mid: { e: 0, m: 0.5 }, near: { e: 0, m: 0.5 } };
      let wd = 0;
      for (let d = 3; d < 520; d *= 1.045) {
        const mx = loc.x + dx * d;
        const my = loc.y + dy * d;
        const outside = mx < 0 || my < 0 || mx > 1000 || my > 1000;
        const w = outside ? G.WATER.SEA : G.waterAt(t, mx, my);
        if (w === G.WATER.SEA || w === G.WATER.LAKE) {
          if (!wd) wd = d;
          continue;
        }
        const e = Math.max(0, G.elevationAt(t, mx, my));
        const D = d * FAR_M * cosA;
        const y = cam.y0 - ((e * VERT - camH) * cam.f) / D;
        const band = d < 16 ? "near" : d < 75 ? "mid" : "far";
        if (y < top[band]) {
          top[band] = y;
          info[band] = { e, m: G.moistureAt(t, mx, my) };
        }
      }
      const cap = cam.H * 0.3;
      const exaggerate = { far: 2.8, mid: 2.1, near: 1.1 };
      ["far", "mid", "near"].forEach((band) => {
        const rise = Math.max(0, cam.y0 - top[band]) * exaggerate[band];
        bands[band].push(cam.y0 - cap * (1 - Math.exp(-rise / cap)));
        meta[band].push(info[band]);
      });
      waterD.push(wd);
      waterY.push(wd && wd < 300 ? cam.y0 + (camH * cam.f) / (wd * FAR_M * cosA) : null);
    }
    return { bands, meta, waterY, waterD, camH };
  }

  function smoothPath(ctx, xs, ys) {
    ctx.lineTo(xs[0], ys[0]);
    for (let i = 1; i < xs.length - 1; i++) {
      ctx.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[i + 1]) / 2, (ys[i] + ys[i + 1]) / 2);
    }
    ctx.lineTo(xs[xs.length - 1], ys[ys.length - 1]);
  }

  function drawBand(ctx, cam, ys, info, color, haze, opts, rng, U) {
    if (!ys.some((y) => y < cam.y0 - 1)) return;
    const xs = ys.map((_, i) => (i / COLUMNS) * cam.W);
    const minY = Math.min(...ys);
    const build = () => {
      ctx.moveTo(0, cam.y0 + 3);
      smoothPath(ctx, xs, ys);
      ctx.lineTo(cam.W, cam.y0 + 3);
      ctx.closePath();
    };
    paint(ctx, build, col(color));
    void minY;
    void haze;
    void rng;
    if (opts.snow) {
      let run = [];
      const flush = () => {
        if (run.length >= 2) {
          paint(ctx, () => {
            ctx.moveTo(xs[run[0]], ys[run[0]]);
            run.forEach((i) => ctx.lineTo(xs[i], ys[i]));
            for (let k = run.length - 1; k >= 0; k--) {
              const i = run[k];
              const depth = (cam.y0 - ys[i]) * (k % 2 ? 0.22 : 0.34);
              ctx.lineTo(xs[i], ys[i] + depth);
            }
            ctx.closePath();
          }, col(mixC({ h: 220, s: 40, l: 97 }, haze, opts.haze * 0.4)), { ink: 0.8 * U });
        }
        run = [];
      };
      ys.forEach((y, i) => {
        if (info[i].e > 0.7 && y < cam.y0 - 6 * U) run.push(i);
        else flush();
      });
      flush();
    }
    stroke(ctx, () => {
      ctx.moveTo(xs[0], ys[0]);
      smoothPath(ctx, xs, ys);
    }, INK, Math.max(1.6, opts.ink * U));
  }

  function drawSea(ctx, cam, hz, pal, rng, U) {
    if (!hz.waterY.some((y) => y)) return;
    const xs = hz.waterY.map((_, i) => (i / COLUMNS) * cam.W);
    const ys = hz.waterY.map((y) => (y ? Math.min(cam.H, y) : cam.y0));
    const seaColor = mixC({ h: 192, s: 70, l: 62 }, pal.sky1, 0.3);
    const g = ctx.createLinearGradient(0, cam.y0, 0, Math.max(...ys) + 1);
    g.addColorStop(0, col(seaColor, 12));
    g.addColorStop(1, col(seaColor, -8));
    paint(ctx, () => {
      ctx.moveTo(0, cam.y0);
      ctx.lineTo(cam.W, cam.y0);
      for (let i = xs.length - 1; i >= 0; i--) ctx.lineTo(xs[i], ys[i]);
      ctx.closePath();
    }, g);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.lineWidth = 1.2 * U;
    for (let i = 0; i < 40; i++) {
      const k = Math.floor(rng() * xs.length);
      if (!hz.waterY[k]) continue;
      const y = cam.y0 + (ys[k] - cam.y0) * rng();
      const len = (4 + rng() * 14) * U * ((y - cam.y0) / (ys[k] - cam.y0 + 1) + 0.3);
      ctx.beginPath();
      ctx.moveTo(xs[k], y);
      ctx.lineTo(xs[k] + len, y);
      ctx.stroke();
    }
  }

  function drawLandmarks(ctx, cam, profile, pal, rng, U) {
    const kind = profile.terrain;
    const color = mixC(pal.rock, pal.sky1, 0.25);
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const x = cam.W * (i < n / 2 ? 0.04 + rng() * 0.3 : 0.66 + rng() * 0.3);
      const y = cam.y0 + 2;
      const h = (40 + rng() * 70) * U;
      const w = (30 + rng() * 60) * U;
      const c = shade(color, (rng() - 0.5) * 10);
      const build = () => {
        if (kind === "mesa") {
          ctx.moveTo(x - w, y);
          ctx.lineTo(x - w * 0.7, y - h);
          ctx.lineTo(x + w * 0.7, y - h);
          ctx.lineTo(x + w, y);
        } else if (kind === "spire") {
          ctx.moveTo(x - w * 0.3, y);
          ctx.quadraticCurveTo(x - w * 0.15, y - h, x, y - h * 1.8);
          ctx.quadraticCurveTo(x + w * 0.15, y - h, x + w * 0.3, y);
        } else if (kind === "dune") {
          ctx.moveTo(x - w * 2, y);
          ctx.quadraticCurveTo(x - w * 0.5, y - h * 0.8, x + w * 0.2, y - h * 0.55);
          ctx.quadraticCurveTo(x + w, y - h * 0.4, x + w * 2, y);
        } else {
          ctx.moveTo(x - w * 1.4, y);
          for (let k = 0; k <= 6; k++) {
            ctx.lineTo(x - w * 1.4 + (k / 6) * w * 2.8, y - h * (k % 2 ? 1 : 0.55) * (1 - Math.abs(k / 6 - 0.5)));
          }
          ctx.lineTo(x + w * 1.4, y);
        }
        ctx.closePath();
      };
      paint(ctx, build, col(c), { ink: 1.3 * U, glaze: col(c, -18), edge: w * 0.2 });
      if (kind === "mesa") {
        stroke(ctx, () => {
          for (let k = 1; k < 4; k++) {
            const yy = y - h * (k / 4);
            ctx.moveTo(x - w * (1 - 0.3 * (k / 4)) + 3 * U, yy);
            ctx.lineTo(x + w * (1 - 0.3 * (k / 4)) - 3 * U, yy);
          }
        }, col(c, -20, 0, 0.6), U);
      }
    }
  }

  // ---------- ground ----------

  function drawGround(ctx, cam, hz, pal, rng, U) {
    const tops = hz.waterY.map((y) => (y ? Math.min(cam.H, Math.max(y, cam.y0)) : cam.y0));
    const xs = tops.map((_, i) => (i / COLUMNS) * cam.W);
    const build = () => {
      ctx.moveTo(0, cam.H);
      for (let i = 0; i < xs.length; i++) ctx.lineTo(xs[i], tops[i]);
      ctx.lineTo(cam.W, cam.H);
      ctx.closePath();
    };
    paint(ctx, build, col(pal.ground));
    void rng;
    stroke(ctx, () => {
      ctx.moveTo(0, tops[0]);
      for (let i = 1; i < xs.length; i++) ctx.lineTo(xs[i], tops[i]);
    }, INK, Math.max(1.5, 1.6 * U));
  }

  function drawGroundPattern(ctx, cam, road, halfW, profile, pal, rng, U) {
    const kind = profile.groundPattern;
    if (kind === "plain") return;
    ctx.strokeStyle = col(pal.ground, -24, 0, 0.55);
    ctx.lineWidth = 1.1 * U;
    ctx.lineCap = "round";
    [-1, 1].forEach((side) => {
      if (kind === "rippled") {
        for (let z = 3; z < 40; z *= 1.18) {
          ctx.beginPath();
          for (let k = 0; k <= 10; k++) {
            const x = road.x(z) + side * (halfW + 0.5 + k * 1.2);
            const p = cam.p(x, z + Math.sin(k * 0.9) * z * 0.04, 0);
            if (k === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
        }
      } else if (kind === "cracked") {
        for (let i = 0; i < 14; i++) {
          let z = 3 + rng() * 25;
          let x = road.x(z) + side * (halfW + 0.6 + rng() * 9);
          ctx.beginPath();
          let p = cam.p(x, z, 0);
          ctx.moveTo(p.x, p.y);
          for (let k = 0; k < 4; k++) {
            x += (rng() - 0.5) * 1.6;
            z += (rng() - 0.3) * 1.4;
            p = cam.p(x, z, 0);
            ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
        }
      } else if (kind === "hex") {
        for (let row = 0; row < 12; row++) {
          const z = 3 + row * 1.3;
          for (let c = 0; c < 6; c++) {
            const x = road.x(z) + side * (halfW + 0.8 + c * 1.5 + (row % 2) * 0.75);
            ctx.beginPath();
            for (let k = 0; k <= 6; k++) {
              const a = (k / 6) * TAU;
              const p = cam.p(x + Math.cos(a) * 0.62, z + Math.sin(a) * 0.62, 0);
              if (k === 0) ctx.moveTo(p.x, p.y);
              else ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
          }
        }
      }
    });
  }

  // ---------- road ----------

  function roadSamples(cam, zMax) {
    const zNear = ((cam.ch * cam.f) / (cam.H - cam.y0)) * 0.8;
    const zs = [];
    for (let i = 0; i <= 80; i++) zs.push(zNear * Math.pow(zMax / zNear, i / 80));
    return zs;
  }

  function strip(ctx, cam, road, zs, a, b, y) {
    zs.forEach((z, i) => {
      const p = cam.p(road.x(z) + a, z, y || 0);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    for (let i = zs.length - 1; i >= 0; i--) {
      const p = cam.p(road.x(zs[i]) + b, zs[i], y || 0);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
  }

  function edgeLine(ctx, cam, road, zs, off, wob) {
    zs.forEach((z, i) => {
      const p = cam.p(road.x(z) + off + (wob ? wob[i] : 0), z, 0);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
  }

  function groundPoly(ctx, cam, road, pts) {
    pts.forEach(([x, z], i) => {
      const p = cam.p(road.x(z) + x, z, 0);
      if (i) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    });
    ctx.closePath();
  }

  function dryBrush(ctx, cam, road, z0, z1, a, b, color, rng, alpha) {
    const A = alpha || 0.9;
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = A * 0.5;
    ctx.beginPath();
    groundPoly(ctx, cam, road, [[a, z0], [b, z0], [b, z1], [a, z1]]);
    ctx.fill();
    const n = 5;
    for (let k = 0; k < n; k++) {
      const t0 = a + ((b - a) * k) / n;
      const t1 = t0 + ((b - a) / n) * (0.7 + rng() * 0.5);
      const s0 = z0 + rng() * (z1 - z0) * 0.12;
      const s1 = z1 - rng() * (z1 - z0) * 0.22;
      ctx.globalAlpha = A * (0.45 + rng() * 0.55);
      ctx.beginPath();
      groundPoly(ctx, cam, road, [[t0, s0], [t1, s0], [t1, s1], [t0, s1]]);
      ctx.fill();
    }
    ctx.restore();
  }

  const GOOFY_HUES = [330, 48, 190, 280, 18, 140, 210];

  function flatEllipse(ctx, cam, p, z, rx, k) {
    ctx.ellipse(p.x, p.y, rx, rx * (k || 1) * (cam.ch / z), 0, 0, TAU);
  }

  function drawRoadDetail(ctx, cam, road, halfW, kind, roadCls, profile, pal, rng, U, zMax, zs, base) {
    const city = kind === "city";
    if (city) {
      const near = zs.filter((z) => z < 60);
      ctx.fillStyle = col(base, -18, 0, 0.26);
      ctx.beginPath();
      [-0.5, 0.5].forEach((lane) => [-0.38, 0.38].forEach((t) => strip(ctx, cam, road, near, lane * halfW + t - 0.14, lane * halfW + t + 0.14)));
      ctx.fill();
      ctx.fillStyle = col(base, -24, 0, 0.18);
      ctx.beginPath();
      [-0.5, 0.5].forEach((lane) => [-0.38, 0.38].forEach((t) => strip(ctx, cam, road, near, lane * halfW + t - 0.05, lane * halfW + t + 0.05)));
      ctx.fill();
      const own = (profile.drivingSide === "left" ? -1 : 1) * halfW * 0.5;
      for (let z = 9 + rng() * 4; z < 26; z += 14) {
        const pts = [[-0.09, z], [0.09, z], [0.09, z + 2.2], [0.3, z + 2.2], [0, z + 3.4], [-0.3, z + 2.2], [-0.09, z + 2.2]].map(([x, zz]) => [own + x, zz]);
        ctx.save();
        ctx.fillStyle = "rgba(255, 250, 240, 0.8)";
        ctx.beginPath();
        groundPoly(ctx, cam, road, pts);
        ctx.fill();
        ctx.globalCompositeOperation = "destination-out";
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = G.wc.patternFor(ctx, "mottle");
        ctx.fill();
        ctx.restore();
      }
      [-1, 1].forEach((side) => {
        ctx.fillStyle = col({ h: 240, s: 8, l: 62 }, 0, 0, 0.85);
        ctx.beginPath();
        for (let z = zs[0] + (side > 0 ? 0.6 : 0); z < 50; z += 2.4) {
          groundPoly(ctx, cam, road, [[side * halfW, z], [side * (halfW + 0.22), z], [side * (halfW + 0.22), z + 1.2], [side * halfW, z + 1.2]]);
        }
        ctx.fill();
        const gz = 5 + rng() * 10;
        const gx0 = side * (halfW - 0.55);
        const gx1 = side * (halfW - 0.05);
        paint(ctx, () => groundPoly(ctx, cam, road, [[gx0, gz], [gx1, gz], [gx1, gz + 0.9], [gx0, gz + 0.9]]), col(base, -22), { ink: inkW(cam.p(0, gz, 0).s, U) * 0.7 });
        stroke(ctx, () => {
          for (let k = 1; k < 5; k++) {
            const a = cam.p(road.x(gz) + gx0 + ((gx1 - gx0) * k) / 5, gz, 0);
            const b = cam.p(road.x(gz + 0.9) + gx0 + ((gx1 - gx0) * k) / 5, gz + 0.9, 0);
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
          }
        }, col(base, -30), Math.max(0.6, U * 0.9));
      });
      for (let i = 0; i < 2; i++) {
        const side = rng() < 0.5 ? -1 : 1;
        let z = 3.5 + rng() * 18;
        let x = side * (halfW - 0.1);
        const start = cam.p(road.x(z) + x, z, 0);
        stroke(ctx, () => {
          ctx.moveTo(start.x, start.y);
          for (let k = 0; k < 4; k++) {
            x -= side * (0.12 + rng() * 0.2);
            z += 0.35 + rng() * 0.35;
            const p = cam.p(road.x(z) + x, z, 0);
            ctx.lineTo(p.x, p.y);
          }
        }, col(base, -24, 0, 0.8), Math.max(0.6, U * 0.9));
      }
    } else {
      if (roadCls === "minor") {
        for (let z = 4; z < 22; z += 4) {
          const p = cam.p(road.x(z), z, 0);
          P.tuft(ctx, p.x, p.y, p.s, 0.22, pal.plantA, rng, U);
        }
      }
      const odd = rng();
      if (odd < 0.2) {
        const z = 4 + rng() * 6;
        const p = cam.p(road.x(z) + (rng() - 0.5) * halfW, z, 0);
        const r = p.s * 0.22;
        const ry = cam.ch / z;
        if (odd < 0.12) {
          paint(ctx, () => {
            ctx.moveTo(p.x, p.y);
            [0.3, 2.3, 4.3].forEach((a) => {
              ctx.quadraticCurveTo(p.x + Math.cos(a - 0.5) * r * 1.2, p.y + Math.sin(a - 0.5) * r * ry * 1.2, p.x + Math.cos(a) * r * 1.6, p.y + Math.sin(a) * r * ry * 1.6);
              ctx.quadraticCurveTo(p.x + Math.cos(a + 0.5) * r * 1.2, p.y + Math.sin(a + 0.5) * r * ry * 1.2, p.x, p.y);
            });
          }, "#ffd84a", { ink: inkW(p.s, U) * 0.8 });
          paint(ctx, () => ctx.ellipse(p.x, p.y, r * 0.35, r * 0.35 * ry, 0, 0, TAU), "#7a4a1f", { ink: inkW(p.s, U) * 0.6 });
        } else {
          const sock = () => {
            ctx.moveTo(p.x - r, p.y - r * ry * 0.4);
            ctx.lineTo(p.x + r * 0.4, p.y - r * ry * 0.5);
            ctx.quadraticCurveTo(p.x + r * 0.9, p.y - r * ry * 0.4, p.x + r * 1.3, p.y + r * ry * 0.5);
            ctx.quadraticCurveTo(p.x + r * 0.9, p.y + r * ry * 1.1, p.x + r * 0.1, p.y + r * ry * 0.4);
            ctx.lineTo(p.x - r, p.y + r * ry * 0.4);
            ctx.closePath();
          };
          paint(ctx, sock, "#fff4e6", { ink: inkW(p.s, U) * 0.8 });
          ctx.save();
          ctx.beginPath();
          sock();
          ctx.clip();
          ctx.fillStyle = "rgba(255, 79, 154, 0.85)";
          for (let k = 0; k < 3; k++) ctx.fillRect(p.x - r + k * r * 0.5, p.y - r * 2, r * 0.22, r * 4);
          ctx.restore();
        }
      }
    }
  }

  function centerLine(ctx, cam, road, zs, profile, drng, zMax) {
    const pattern = profile.linePattern;
    if (pattern === "none") return;
    if (!pattern || pattern === "dashed") {
      const dash = pattern ? G.metaColors.LINE.dashed : col(profile.pathLineColor, 10);
      for (let z = 3; z < zMax * 0.6; z += 6) {
        if (z < 30) dryBrush(ctx, cam, road, z, z + 3, -0.08, 0.08, dash, drng, 1);
        else {
          ctx.fillStyle = dash;
          ctx.beginPath();
          strip(ctx, cam, road, [z, z + 1.5, z + 3], -0.08, 0.08);
          ctx.fill();
        }
      }
      return;
    }
    const near = zs.filter((z) => z < zMax * 0.7);
    const offsets = pattern === "double" ? [-0.15, 0.15] : [0];
    ctx.save();
    ctx.fillStyle = G.metaColors.LINE[pattern];
    ctx.globalAlpha = 0.92;
    offsets.forEach((o) => {
      ctx.beginPath();
      strip(ctx, cam, road, near, o - 0.07, o + 0.07);
      ctx.fill();
    });
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = G.wc.patternFor(ctx, "mottle");
    offsets.forEach((o) => {
      ctx.beginPath();
      strip(ctx, cam, road, near, o - 0.07, o + 0.07);
      ctx.fill();
    });
    ctx.restore();
  }

  function edgeBlades() {}

  function drawPavedRural(ctx, cam, road, zs, halfW, profile, pal, drng, U, zMax, farY, build) {
    const asphalt = { h: 255, s: 12, l: 50 };
    ctx.fillStyle = col(pal.dirt, -6, 0, 0.7);
    ctx.beginPath();
    strip(ctx, cam, road, zs, -halfW - 0.55, -halfW + 0.05);
    strip(ctx, cam, road, zs, halfW - 0.05, halfW + 0.55);
    ctx.fill();
    const g = ctx.createLinearGradient(0, farY, 0, cam.H);
    g.addColorStop(0, col(mixC(asphalt, pal.sky1, 0.4)));
    g.addColorStop(1, col(asphalt, -6));
    paint(ctx, build, g, { glaze: col(asphalt, -14), edge: 10 * U });
    ctx.fillStyle = "rgba(255, 250, 242, 0.85)";
    ctx.beginPath();
    strip(ctx, cam, road, zs.filter((z) => z < zMax * 0.7), -halfW + 0.22, -halfW + 0.34);
    strip(ctx, cam, road, zs.filter((z) => z < zMax * 0.7), halfW - 0.34, halfW - 0.22);
    ctx.fill();
    centerLine(ctx, cam, road, zs, profile, drng, zMax);
    stroke(ctx, () => edgeLine(ctx, cam, road, zs, -halfW), INK, 1.6 * U);
    stroke(ctx, () => edgeLine(ctx, cam, road, zs, halfW), INK, 1.6 * U);
    edgeBlades(ctx, cam, road, zs, halfW + 0.5, pal, U);
  }

  function drawRoad(ctx, cam, road, halfW, kind, roadCls, profile, pal, rng, U, zMax) {
    const zs = roadSamples(cam, zMax);
    const drng = G.mulberry32(Math.floor(rng() * 4294967296));
    const city = kind === "city";
    const paved = !city && roadCls === "major" && !!profile.linePattern;
    const build = () => {
      zs.forEach((z, i) => {
        const p = cam.p(road.x(z) - halfW, z, 0);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      for (let i = zs.length - 1; i >= 0; i--) {
        const p = cam.p(road.x(zs[i]) + halfW, zs[i], 0);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
    };
    const farY = cam.p(0, zMax, 0).y;
    if (city) {
      [-1, 1].forEach((side) => {
        const walk = { h: 18 + side * 8, s: 26, l: 80 };
        paint(ctx, () => strip(ctx, cam, road, zs, side * halfW, side * (halfW + 3.2), 0.15), col(walk), { glaze: col(walk, -16), edge: 6 * U });
        ctx.strokeStyle = col(walk, -22, 0, 0.6);
        ctx.lineWidth = 0.8 * U;
        ctx.beginPath();
        for (let z = zs[0]; z < 60; z += 1.6) {
          const a = cam.p(road.x(z) + side * halfW, z, 0.15);
          const b = cam.p(road.x(z) + side * (halfW + 3.2), z, 0.15);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
      });
      const asphalt = { h: 255, s: 14, l: 44 };
      const g = ctx.createLinearGradient(0, farY, 0, cam.H);
      g.addColorStop(0, col(mixC(asphalt, pal.sky1, 0.4)));
      g.addColorStop(1, col(asphalt, -6));
      paint(ctx, build, g, { glaze: col(asphalt, -14), edge: 10 * U });
      ctx.fillStyle = col(asphalt, -10, 0, 0.5);
      ctx.beginPath();
      strip(ctx, cam, road, zs, -halfW, -halfW + 0.45);
      strip(ctx, cam, road, zs, halfW - 0.45, halfW);
      ctx.fill();
      ctx.strokeStyle = col(asphalt, -18, 0, 0.75);
      ctx.lineWidth = Math.max(0.6, 0.9 * U);
      for (let i = 0; i < 2; i++) {
        let z = 3.5 + rng() * 22;
        let x = road.x(z) + (rng() - 0.5) * halfW * 1.6;
        ctx.beginPath();
        let p = cam.p(x, z, 0);
        ctx.moveTo(p.x, p.y);
        for (let k = 0; k < 4; k++) {
          x += (rng() - 0.5) * 0.9;
          z += 0.3 + rng() * 0.7;
          p = cam.p(x, z, 0);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
      {
        const z = 6 + rng() * 8;
        const p = cam.p(road.x(z) + (rng() < 0.5 ? -1 : 1) * halfW * 0.45, z, 0);
        const rx = p.s * 0.55;
        const ry = rx * (cam.ch / z);
        paint(ctx, () => ctx.ellipse(p.x, p.y, rx, ry, 0, 0, TAU), col(asphalt, -16), { ink: inkW(p.s, U) });
        paint(ctx, () => ctx.ellipse(p.x, p.y, rx * 0.78, ry * 0.78, 0, 0, TAU), col(asphalt, -6), { ink: inkW(p.s, U) * 0.5 });
        stroke(ctx, () => {
          for (let k = -2; k <= 2; k++) {
            ctx.moveTo(p.x + k * rx * 0.25, p.y - ry * 0.7 * Math.sqrt(1 - (k * 0.25) ** 2 / 0.6));
            ctx.lineTo(p.x + k * rx * 0.25, p.y + ry * 0.7 * Math.sqrt(1 - (k * 0.25) ** 2 / 0.6));
          }
        }, col(asphalt, -22), Math.max(0.6, U * 0.8));
      }
      if (rng() < 0.6) {
        const z = 4 + rng() * 14;
        const p = cam.p(road.x(z) + (rng() - 0.5) * halfW, z, 0);
        const rx = p.s * (0.5 + rng() * 0.5);
        const ry = rx * (cam.ch / z);
        paint(ctx, () => ctx.ellipse(p.x, p.y, rx, ry, 0, 0, TAU), col(mixC(pal.sky1, pal.sky0, 0.4), 6), { ink: inkW(p.s, U) * 0.6 });
        paint(ctx, () => ctx.ellipse(p.x - rx * 0.3, p.y - ry * 0.2, rx * 0.3, ry * 0.2, 0, 0, TAU), "rgba(255,255,255,0.65)");
      }
      const curbPaint = profile.curb && G.metaColors.CURB[profile.curb];
      [-1, 1].forEach((side) => {
        const curb = { h: 240, s: 10, l: 86 };
        paint(ctx, () => strip(ctx, cam, road, zs, side * halfW, side * (halfW + 0.22), 0.15), col(curb), { ink: 1.1 * U });
        if (curbPaint) {
          for (let z = zs[0], k = 0; z < 70; z += 1.2, k++) {
            ctx.fillStyle = curbPaint[k % 2];
            ctx.beginPath();
            strip(ctx, cam, road, [z, z + 0.6, z + 1.2], side * halfW, side * (halfW + 0.22), 0.15);
            ctx.fill();
          }
        }
        stroke(ctx, () => edgeLine(ctx, cam, road, zs, side * halfW), INK, 1.8 * U);
      });
      centerLine(ctx, cam, road, zs, profile, drng, zMax);
      if (rng() < 0.5) {
        const z0 = 7 + rng() * 6;
        for (let k = -halfW + 0.4; k < halfW - 0.4; k += 0.9) {
          dryBrush(ctx, cam, road, z0, z0 + 2.4, k, k + 0.45, "rgb(255, 250, 245)", drng, 0.9);
        }
      }
    } else if (paved) {
      drawPavedRural(ctx, cam, road, zs, halfW, profile, pal, drng, U, zMax, farY, build);
    } else {
      const dirt = pal.dirt;
      const g = ctx.createLinearGradient(0, farY, 0, cam.H);
      g.addColorStop(0, col(mixC(dirt, pal.sky1, 0.35), 6));
      g.addColorStop(1, col(dirt, -4));
      paint(ctx, build, g, { glaze: col(dirt, -22), glazeAlpha: 0.4, edge: 14 * U });
      ctx.fillStyle = col(dirt, -12, 4, 0.55);
      ctx.beginPath();
      strip(ctx, cam, road, zs, -halfW - 0.1, -halfW + 0.38);
      strip(ctx, cam, road, zs, halfW - 0.38, halfW + 0.1);
      ctx.fill();
      ctx.fillStyle = col(dirt, 12, -6, 0.35);
      ctx.beginPath();
      strip(ctx, cam, road, zs, -0.12 * halfW - 0.3, -0.12 * halfW + 0.3);
      ctx.fill();
      [-0.45, 0.45].forEach((k) => {
        ctx.fillStyle = col(dirt, -16, 0, 0.42);
        ctx.beginPath();
        strip(ctx, cam, road, zs, k * halfW - 0.2, k * halfW + 0.2);
        ctx.fill();
      });
      if (roadCls === "minor") {
        ctx.fillStyle = col(pal.plantA, 6, 0, 0.5);
        ctx.beginPath();
        strip(ctx, cam, road, zs, -0.25, 0.25);
        ctx.fill();
      }
      ctx.strokeStyle = col(dirt, -20, 0, 0.7);
      ctx.lineWidth = Math.max(0.7, U);
      for (let i = 0; i < 2; i++) {
        let z = 6 + rng() * 14;
        let x = road.x(z) + (rng() - 0.5) * halfW * 0.6;
        ctx.beginPath();
        let p = cam.p(x, z, 0);
        ctx.moveTo(p.x, p.y);
        for (let k = 0; k < 3; k++) {
          x += (rng() - 0.5) * 0.35;
          z += 0.6 + rng() * 0.5;
          p = cam.p(x, z, 0);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
      stroke(ctx, () => edgeLine(ctx, cam, road, zs, -halfW), INK, 1.6 * U);
      stroke(ctx, () => edgeLine(ctx, cam, road, zs, halfW), INK, 1.6 * U);
      edgeBlades(ctx, cam, road, zs, halfW, pal, U);
    }
    drawRoadDetail(ctx, cam, road, halfW, paved ? "paved" : kind, roadCls, profile, pal, drng, U, zMax, zs, city || paved ? { h: 255, s: 14, l: 46 } : pal.dirt);
    drawPathStyle(ctx, cam, road, halfW, profile, zs, U, zMax);
    if (!city) {
      for (let z = 4; z < 26; z += 4.5) {
        const side = z % 2 ? -1 : 1;
        const p = cam.p(road.x(z) + side * (halfW + 0.4), z, 0);
        P.tuft(ctx, p.x, p.y, p.s, 0.42, pal.plantA, rng, U);
      }
    }
  }

  function drawPathStyle(ctx, cam, road, halfW, profile, zs, U, zMax) {
    const style = profile.pathStyle;
    const c = profile.pathLineColor;
    if (style === "plates") {
      ctx.save();
      ctx.globalAlpha = 0.6;
      G.wc.withLine("pencil", () => G.wc.line(ctx, () => {
        for (let z = zs[0]; z < Math.min(80, zMax); z += 2.4) {
          const a = cam.p(road.x(z) - halfW, z, 0);
          const b = cam.p(road.x(z) + halfW, z, 0);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
      }, 1.6 * U));
      ctx.restore();
      ctx.fillStyle = col(c, 10, -30, 0.18);
      for (let z = zs[0]; z < Math.min(80, zMax); z += 4.8) {
        ctx.beginPath();
        strip(ctx, cam, road, [z, z + 1.2, z + 2.4], -halfW, halfW);
        ctx.fill();
      }
    } else if (style === "glow") {
      ctx.save();
      ctx.shadowColor = col(c, 10);
      ctx.shadowBlur = 10 * U;
      ctx.fillStyle = col(c, 14);
      for (let z = 3; z < zMax * 0.5; z += 5) {
        ctx.beginPath();
        strip(ctx, cam, road, [z, z + 1, z + 2.2], -0.12, 0.12);
        ctx.fill();
      }
      ctx.restore();
    } else if (style === "rails") {
      ctx.strokeStyle = col({ h: 30, s: 30, l: 40 }, 0, 0, 0.7);
      ctx.lineWidth = 1.2 * U;
      ctx.beginPath();
      for (let z = zs[0]; z < 40; z += 1.1) {
        const a = cam.p(road.x(z) - halfW * 0.7, z, 0);
        const b = cam.p(road.x(z) + halfW * 0.7, z, 0);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
      [-0.5, 0.5].forEach((k) => {
        stroke(ctx, () => edgeLine(ctx, cam, road, zs, k * halfW), INK, 3.4 * U);
        stroke(ctx, () => edgeLine(ctx, cam, road, zs, k * halfW), col(c, 18, -30), 1.8 * U);
      });
    }
  }

  // ---------- population ----------

  function wallPalette(profile, rng, shownBuilding) {
    if (shownBuilding) return shade(profile.wallColor, (rng() - 0.5) * 12);
    return { h: rng() * 360, s: 45 + rng() * 25, l: 66 + rng() * 14 };
  }

  function glyphRun(rng, n) {
    return Array.from({ length: n }, () => Math.floor(rng() * G.GLYPH_COUNT));
  }

  function pickColor(profile, rng) {
    const colors = profile.alienColors || ["pink"];
    return colors.length > 1 ? colors[rng() < 0.5 ? 0 : 1] : colors[0];
  }

  function makeLayout() {
    const boxes = [];
    const hits = (b) => boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.z0 < o.z1 && b.z1 > o.z0);
    return {
      take(x, z, rx, rz) {
        const b = { x0: x - rx, x1: x + rx, z0: z - rz, z1: z + rz };
        if (hits(b)) return false;
        boxes.push(b);
        return true;
      },
      block(x0, x1, z0, z1) {
        boxes.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });
      },
      free(x, z, rx, rz) {
        return !hits({ x0: x - rx, x1: x + rx, z0: z - rz, z1: z + rz });
      },
    };
  }

  function curveInfo(road) {
    let best = { z: 24, c: 0 };
    for (let z = 12; z <= 40; z += 2) {
      const c = road.x(z + 3) - 2 * road.x(z) + road.x(z - 3);
      if (Math.abs(c) > Math.abs(best.c)) best = { z, c };
    }
    return { z: best.z, dir: Math.abs(best.c) > 0.04 ? Math.sign(best.c) : 0 };
  }

  function addAlien(queue, cam, road, halfW, profile, rng, U, z0, x0, L) {
    let z = Math.max(5, z0);
    let x = x0;
    if (L) {
      let ok = false;
      for (let t = 0; t < 6 && !ok; t++) {
        if (t) {
          z = Math.max(5, z0 + (rng() - 0.5) * 4);
          x = x0 + (rng() - 0.5) * 2.6;
        }
        ok = L.take(x, z, 0.42, 0.45);
      }
      if (!ok) return false;
    }
    queue.push({
      z,
      draw: (ctx) => {
        const p = cam.p(x, z, 0);
        P.alien(ctx, p.x, p.y, p.s, {
          profile,
          color: pickColor(profile, rng),
          variant: Math.floor(rng() * 3),
          pose: rng() < 0.3 ? 1 : 0,
          flip: rng() < 0.5,
          tilt: (rng() - 0.5) * 0.12,
          scale: 0.9 + rng() * 0.2,
        }, U);
      },
    });
    return true;
  }

  function metaPlant(ctx, x, y, s, kind, vc, pal, rng, U) {
    if (kind === "mushroom") P.mushroom(ctx, x, y, s, 2.4 + rng() * 4.5, vc, rng, U);
    else if (kind === "palm") P.palm(ctx, x, y, s, 6 + rng() * 5, vc, pal.trunk, rng, U);
    else if (kind === "tentacle") P.tentacle(ctx, x, y, s, 3 + rng() * 4, vc, rng, U);
    else if (kind === "eyestalk") P.eyestalk(ctx, x, y, s, 1.6 + rng() * 2, vc, rng, U);
    else if (kind === "bulb") P.bulb(ctx, x, y, s, 2 + rng() * 2.5, vc, rng, U);
    else if (kind === "spiralfern") P.spiralFern(ctx, x, y, s, 1.6 + rng() * 1.8, vc, rng, U);
    else if (kind === "balloon") P.balloonPod(ctx, x, y, s, 3 + rng() * 3.5, vc, rng, U);
    else P.crystal(ctx, x, y, s, 1.4 + rng() * 2.6, vc, rng, U);
  }

  function addPlant(queue, cam, profile, pal, biome, rng, U, z, x, shown, allowMeta, L, edgeOff) {
    const meta = shown.vegetation && allowMeta && rng() < 0.45;
    const r = rng();
    const lush = biome === "jungle" || biome === "meadow" || biome === "beach";
    const rocky = biome === "rock" || biome === "snow" || (biome === "highland" && r < 0.5);
    const big = meta || (!rocky && r < (lush ? 0.3 : 0.15));
    if (L && z < 70) {
      const off = edgeOff === undefined ? 99 : edgeOff;
      if (big && (z < 6.5 || off < 2)) return false;
      if (!L.take(x, z, big ? 1.5 : 0.55, big ? 1.3 : 0.5)) return false;
    }
    queue.push({
      z,
      pencil: !meta,
      draw: (ctx) => {
        const p = cam.p(x, z, 0);
        if (p.x < -p.s * 8 || p.x > cam.W + p.s * 8) return;
        const vc = shade(profile.vegetationColor, (rng() - 0.5) * 10);
        if (meta) {
          metaPlant(ctx, p.x, p.y, p.s, profile.vegetation, vc, pal, rng, U);
          return;
        }
        const lush = biome === "jungle" || biome === "meadow" || biome === "beach";
        const plant = [pal.plantA, pal.plantB, pal.plantC][Math.floor(rng() * 3)];
        if (biome === "rock" || biome === "snow" || (biome === "highland" && r < 0.5)) {
          P.boulder(ctx, p.x, p.y, p.s, 0.4 + rng() * 1.4, pal.rock, rng, U);
        } else if ((biome === "beach" && r < 0.12) || (biome === "dry" && r < 0.1)) {
          P.tubeCoral(ctx, p.x, p.y, p.s, 0.8 + rng() * 1.3, { h: 5 + rng() * 40, s: 75, l: 66 }, rng, U);
        } else if (r < (lush ? 0.3 : 0.15)) {
          const t = rng();
          if (t < 0.44) P.tree(ctx, p.x, p.y, p.s, 4.5 + rng() * 5, plant, pal.trunk, rng, U);
          else if (t < 0.54) P.lollipopTree(ctx, p.x, p.y, p.s, 3.5 + rng() * 3, plant, pal.trunk, rng() < 0.5 ? pal.pop : pal.pop2, rng, U);
          else if (t < 0.62) P.noodleTree(ctx, p.x, p.y, p.s, 4 + rng() * 4, plant, pal.trunk, rng() < 0.5 ? pal.pop : pal.pop2, rng, U);
          else if (t < 0.82) P.cottonTree(ctx, p.x, p.y, p.s, 4 + rng() * 3, { h: [320, 200, 270][Math.floor(rng() * 3)], s: 60, l: 76 }, pal.trunk, rng, U);
          else P.jellyTree(ctx, p.x, p.y, p.s, 4.5 + rng() * 3.5, { h: 180 + rng() * 40, s: 70, l: 72 }, pal.trunk, rng, U);
        } else if (biome === "jungle" && r < 0.38) {
          P.pitcher(ctx, p.x, p.y, p.s, 0.9 + rng() * 1.1, { h: rng() < 0.5 ? 340 : 95, s: 55, l: 52 }, rng, U);
        } else if (r < 0.62) {
          P.bush(ctx, p.x, p.y, p.s, 0.6 + rng() * 1.1, plant, rng, U);
        } else if (r < 0.86) {
          P.fern(ctx, p.x, p.y, p.s, 0.8 + rng() * 1.2, plant, rng, U);
        } else if (r < 0.94) {
          P.boulder(ctx, p.x, p.y, p.s, 0.3 + rng() * 0.7, pal.rock, rng, U);
        } else {
          P.flower(ctx, p.x, p.y, p.s, 0.5 + rng() * 0.4, { h: rng() * 360, s: 80, l: 70 }, rng, U);
        }
      },
    });
  }

  function addPoles(queue, cam, road, halfW, profile, rng, U, side, offset, L) {
    const anchors = [];
    const zs = [];
    for (let z = 5 + rng() * 6; z < 220; z += 26) {
      if (!L || z > 70 || L.take(road.x(z) + side * (halfW + offset), z, 0.3, 0.35)) zs.push(z);
    }
    if (!zs.length) return;
    zs.forEach((z) => {
      const x = road.x(z) + side * (halfW + offset);
      queue.push({
        z,
        draw: (ctx) => {
          const p = cam.p(x, z, 0);
          if (p.x < -200 || p.x > cam.W + 200) return;
          anchors.push({ z, pts: P.pole(ctx, cam, x, z, profile, U, true) });
        },
      });
    });
    queue.push({
      z: zs[0] - 0.01,
      draw: (ctx) => {
        anchors.sort((a, b) => a.z - b.z);
        if (anchors.length > 1) P.wires(ctx, anchors.map((a) => a.pts), U);
      },
    });
  }

  const AD_WORDS = ["ZORP", "BLIP", "GLORB", "SNAX", "WUBBO", "FIZZ", "MOOP", "YUMZ", "GOOP", "ZAP!"];
  let photoHits = [];

  function noteHit(cam, x, y, w, h, kind, spec) {
    if (w < 4 || h < 4) return;
    if (x + w < 0 || y + h < 0 || x > cam.W || y > cam.H) return;
    photoHits.push({ x, y, w, h, kind, spec });
  }

  function plateFor(profile, rng) {
    if (!profile.plate) return null;
    const digits = String(100 + Math.floor(rng() * 900));
    return { style: profile.plate, text: profile.plateLetter ? `${profile.plateLetter}·${digits}` : digits };
  }

  function addCommon(queue, cam, road, halfW, profile, pal, rng, U, shown, kind, L, loc) {
    const city = kind === "city";
    const at = (z, x, y, draw) => queue.push({ z, draw: (ctx) => {
      const p = cam.p(x, z, y || 0);
      if (p.x < -p.s * 6 || p.x > cam.W + p.s * 6) return;
      draw(ctx, p);
    } });
    const curve = curveInfo(road);
    const own = profile.drivingSide === "left" ? -1 : 1;
    let railSide = 0;
    if (shown.guardrail) {
      railSide = curve.dir ? -curve.dir : rng() < 0.5 ? -1 : 1;
      const off = halfW + 0.4;
      const xAt = (z) => road.x(z) + railSide * off;
      const z0 = 3 + rng() * 3;
      const z1 = z0 + 28 + rng() * 22;
      for (let z = z0; z < z1; z += 5) {
        const za = z;
        const zb = Math.min(z + 5, z1);
        L.block(xAt(za) - 0.3, xAt(za) + 0.3, za, zb);
        queue.push({ z: (za + zb) / 2, draw: (ctx) => P.guardrail(ctx, cam, xAt, za, zb, profile.guardrail, U) });
      }
    }
    if (shown.chevron) {
      const dir = curve.dir || (rng() < 0.5 ? -1 : 1);
      const side = -dir;
      [-4.5, 0, 4.5].forEach((dz) => {
        const z = curve.z + dz;
        const x = road.x(z) + side * (halfW + 1.1);
        if (L.take(x, z, 0.45, 0.4)) at(z, x, 0, (ctx, p) => P.chevron(ctx, p.x, p.y, p.s, profile.chevron, dir, U));
      });
    }
    if (shown.bollard) {
      [-1, 1].forEach((side) => {
        if (side === railSide) return;
        for (let z = 5 + rng() * 5; z < 75; z += 12 + rng() * 4) {
          const x = road.x(z) + side * (halfW + 0.45);
          if (L.take(x, z, 0.22, 0.35)) at(z, x, 0, (ctx, p) => P.bollard(ctx, p.x, p.y, p.s, profile.bollard, U));
        }
      });
    }
    if (shown.kmMarker) {
      const number = 1 + (Math.floor((loc.along || 0) / 9) + (loc.road || 0) * 13) % 240;
      for (let t = 0; t < 4; t++) {
        const z = 6 + rng() * 10;
        const side = t < 2 ? own : -own;
        const x = road.x(z) + side * (halfW + 0.75);
        if (L.take(x, z, 0.3, 0.35)) {
          at(z, x, 0, (ctx, p) => {
            P.kmMarker(ctx, p.x, p.y, p.s, profile.kmMarker, number, U);
            noteHit(cam, p.x - p.s * 0.4, p.y - p.s * 1.4, p.s * 0.8, p.s * 1.4, "km", { style: profile.kmMarker, number });
          });
          break;
        }
      }
    }
    if (shown.pole) addPoles(queue, cam, road, halfW, profile, rng, U, rng() < 0.5 ? -1 : 1, city ? 0.5 : 1.25, L);
    if (shown.sign) {
      for (let t = 0; t < 4; t++) {
        const z = 7 + rng() * 9;
        const x = road.x(z) + (rng() < 0.5 ? -1 : 1) * (halfW + (city ? 0.6 : 0.9));
        if (L.take(x, z, 0.5, 0.4)) {
          queue.push({ z, draw: (ctx) => {
            P.sign(ctx, cam, x, z, profile, U);
            const top = cam.p(x, z, 2.5);
            const r = cam.p(x, z, 0).s * 0.7;
            noteHit(cam, top.x - r, top.y - r, r * 2, r * 2, "sign", profile);
          } });
          break;
        }
      }
    }
    if (shown.billboard) {
      const phone = profile.areaCode ? `${profile.areaCode}-${100 + Math.floor(rng() * 900)}` : null;
      const word = AD_WORDS[Math.floor(rng() * AD_WORDS.length)];
      const domain = profile.domain ? `${word.replace(/[^A-Z]/g, "").toLowerCase()}${profile.domain}` : null;
      const spec = {
        small: city,
        phone,
        domain,
        word,
        bg: { h: rng() * 360, s: 70, l: 80 },
        accent: { h: rng() * 360, s: 80, l: 58 },
      };
      for (let t = 0; t < 6; t++) {
        const z = city ? 6 + rng() * 8 : 11 + rng() * 14;
        const side = rng() < 0.5 ? -1 : 1;
        const x = road.x(z) + side * (halfW + (city ? 1.4 : 2.8 + rng() * 2));
        if (L.take(x, z, city ? 0.9 : 1.8, 0.6)) {
          at(z, x, 0, (ctx, p) => {
            P.billboard(ctx, p.x, p.y, p.s, spec, U);
            const bw = p.s * (spec.small ? 1.6 : 3.3);
            const boardTop = p.y - p.s * (spec.small ? 1.6 : 3.9);
            noteHit(cam, p.x - bw / 2, boardTop, bw, p.y - boardTop, "billboard", spec);
          });
          break;
        }
      }
    }
    if (shown.plate) addCar(queue, cam, road, halfW, profile, rng, U, 9 + rng() * 8, L);
    if (shown.fence && !city) {
      const side = railSide ? -railSide : rng() < 0.5 ? -1 : 1;
      for (let z = 3.2; z < 46; z += 7) {
        const z0 = z;
        const x = road.x(z0) + side * (halfW + 0.7);
        L.block(x - 0.25, x + 0.25, z0, z0 + 7);
        queue.push({ z: z0 + 3.5, draw: (ctx) => P.fencePiece(ctx, cam, x, z0, z0 + 7, profile, U) });
      }
    }
    if (shown.banner && kind !== "wild") {
      for (let t = 0; t < 4; t++) {
        const z = 8 + rng() * 10;
        const side = rng() < 0.5 ? -1 : 1;
        const x = road.x(z) + side * (halfW + 1.7);
        if (L.take(x, z, 0.5, 0.5)) {
          const flip = side < 0;
          at(z, x, 0, (ctx, p) => P.flagpole(ctx, p.x, p.y, p.s, profile.flag, profile.provinceFlag, U, flip));
          break;
        }
      }
    }
    if (shown.banner) {
      const z = 13 + rng() * 10;
      const h = kind === "city" ? 7 : 4.6;
      const xl = road.x(z) - halfW - 0.6;
      const xr = road.x(z) + halfW + 0.6;
      L.take(xl, z, 0.3, 0.3);
      L.take(xr, z, 0.3, 0.3);
      queue.push({
        z,
        draw: (ctx) => {
          [xl, xr].forEach((x) => {
            const b = cam.p(x, z, 0);
            const t = cam.p(x, z, h);
            stroke(ctx, () => {
              ctx.moveTo(b.x, b.y);
              ctx.lineTo(t.x, t.y);
            }, INK, Math.max(1.6, b.s * 0.1) + U);
            stroke(ctx, () => {
              ctx.moveTo(b.x, b.y);
              ctx.lineTo(t.x, t.y);
            }, col(profile.poleColor, -10), Math.max(1, b.s * 0.1));
          });
          P.bunting(ctx, cam.p(xl, z, h - 0.2), cam.p(xr, z, h - 0.2), profile, U, rng);
        },
      });
    }
  }

  function addOddities(queue, cam, road, halfW, profile, pal, biome, rng, U, shown, kind, L) {
    const side = () => (rng() < 0.5 ? -1 : 1);
    const at = (z, x, y, draw) => {
      if (!y && z < 70 && !L.take(x, z, 0.6, 0.6)) return;
      queue.push({ z, draw: (ctx) => {
        const p = cam.p(x, z, y || 0);
        if (p.x < -p.s * 12 || p.x > cam.W + p.s * 12) return;
        draw(ctx, p);
      } });
    };
    if (rng() < 0.3) {
      const z = 3.5 + rng() * 6;
      const color = { h: rng() * 360, s: 65, l: 60 };
      at(z, road.x(z) + side() * (halfW + 0.6 + rng() * 2), 0, (ctx, p) => P.snail(ctx, p.x, p.y, p.s, color, U, rng));
    }
    if (kind === "wild" && rng() < 0.2) {
      const z = 70 + rng() * 70;
      at(z, road.x(z) + side() * (halfW + 15 + rng() * 40), 10 + rng() * 12, (ctx, p) => P.floatingRock(ctx, p.x, p.y, p.s, pal.rock, pal.plantA, U, rng));
    }
    if (rng() < (kind === "village" ? 0.3 : 0.14)) {
      const z = 8 + rng() * 10;
      at(z, road.x(z) + side() * (halfW + 2 + rng() * 4), 0, (ctx, p) => P.totem(ctx, p.x, p.y, p.s, U, rng));
    }
    if (rng() < (kind === "village" ? 0.55 : 0.15)) {
      const z = 4 + rng() * 4;
      const color = shown.sign ? profile.accentColor : { h: 220, s: 18, l: 70 };
      const glyph = shown.sign ? profile.signGlyph : null;
      at(z, road.x(z) + side() * (halfW + 0.7), 0, (ctx, p) => P.mailbox(ctx, p.x, p.y, p.s, U, color, glyph));
    }
    if ((biome === "jungle" || biome === "meadow") && rng() < 0.45) {
      const n = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const z = 3.5 + rng() * 10;
        at(z, road.x(z) + side() * (halfW + 0.8 + rng() * 4), 0, (ctx, p) => P.glowCaps(ctx, p.x, p.y, p.s, U, rng));
      }
    }
    if (rng() < 0.16) {
      const n = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const z = 90 + rng() * 110;
        at(z, road.x(z) + (rng() - 0.5) * 120, 25 + rng() * 20, (ctx, p) => P.skyJelly(ctx, p.x, p.y, p.s, U, rng));
      }
    }
  }

  function populateWild(queue, cam, road, halfW, profile, pal, biome, rng, U, shown, L) {
    if (shown.building) {
      const z = 10 + rng() * 14;
      const side = rng() < 0.5 ? -1 : 1;
      addShack(queue, cam, road, halfW, profile, rng, U, z, side, true, L);
    }
    if (shown.aliens) {
      const n = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const z = 5 + rng() * 16;
        const x = road.x(z) + (rng() - 0.5) * (halfW * 2 + 3);
        addAlien(queue, cam, road, halfW, profile, rng, U, z, x, L);
      }
    } else if (rng() < 0.4) {
      const z = 40 + rng() * 30;
      addAlien(queue, cam, road, halfW, profile, rng, U, z, road.x(z) + (rng() - 0.5) * halfW * 3, L);
    }
    if (rng() < 0.15) addCar(queue, cam, road, halfW, profile, rng, U, 20 + rng() * 40, L);
    if (rng() < 0.25) {
      const z = 6 + rng() * 10;
      const x = road.x(z) + (rng() < 0.5 ? -1 : 1) * (halfW + 1.6);
      if (L.take(x, z, 0.9, 0.4)) {
        queue.push({ z, draw: (ctx) => {
          const p = cam.p(x, z, 0);
          P.bench(ctx, p.x, p.y, p.s, { h: rng() * 360, s: 50, l: 62 }, U);
        } });
      }
    }
    addOddities(queue, cam, road, halfW, profile, pal, biome, rng, U, shown, "wild", L);
    const base = { jungle: 46, meadow: 26, beach: 18, dry: 10, highland: 16, rock: 10, snow: 8, sea: 14, lake: 14 }[biome] || 20;
    const density = Math.round(base * pal.density);
    for (let i = 0; i < density; i++) {
      const z = 3.2 + Math.pow(rng(), 1.5) * 90;
      const side = rng() < 0.5 ? -1 : 1;
      const off = 1.2 + Math.pow(rng(), 1.4) * 16;
      addPlant(queue, cam, profile, pal, biome, rng, U, z, road.x(z) + side * (halfW + off), shown, true, L, off);
    }
    for (let i = 0; i < density * 0.8; i++) {
      const z = 70 + rng() * 220;
      const side = rng() < 0.5 ? -1 : 1;
      const x = road.x(z) + side * (halfW + 2 + rng() * 60);
      addPlant(queue, cam, profile, pal, biome, rng, U, z, x, shown, false);
    }
  }

  function addShack(queue, cam, road, halfW, profile, rng, U, z, side, shownBuilding, L) {
    const width = 4 + rng() * 2.2;
    const depth = 3.5 + rng() * 1.8;
    const off = 1.7 + rng() * 2.4;
    const xa = road.x(z) + side * (halfW + off);
    if (L) {
      if (!L.free((xa + xa + side * width) / 2, z + depth / 2, width / 2 + 0.3, depth / 2 + 0.3)) return false;
      L.block(xa - side * 0.9, xa + side * (width + 0.3), z - 3.5, z + depth + 0.3);
    }
    const spec = {
      xa,
      side,
      z0: z,
      width,
      depth,
      height: 2.7 + rng() * 0.8,
      wall: wallPalette(profile, rng, shownBuilding),
      roof: shownBuilding ? profile.roofColor : { h: 20, s: 30, l: 50 },
      roofShape: shownBuilding ? profile.roofShape : null,
      windowStyle: shownBuilding ? profile.windowStyle : "plain",
      glyphs: rng() < 0.75 ? glyphRun(rng, 2 + Math.floor(rng() * 3)) : null,
      board: { h: rng() * 360, s: 60, l: 80 },
      awning: rng() < 0.4 ? { h: rng() * 360, s: 75, l: 62 } : null,
      rand: rng,
    };
    queue.push({ z: z + depth * 0.5, draw: (ctx) => P.shack(ctx, cam, spec, U) });
    if (rng() < 0.6) {
      const pz = z - 0.6;
      const px = xa - side * (0.4 + rng() * 0.6);
      queue.push({ z: pz, draw: (ctx) => {
        const p = cam.p(px, pz, 0);
        if (rng() < 0.5) P.barrel(ctx, p.x, p.y, p.s, { h: rng() * 360, s: 55, l: 58 }, U);
        else P.crate(ctx, p.x, p.y, p.s, U);
      } });
    }
  }

  function addCar(queue, cam, road, halfW, profile, rng, U, z, L) {
    const own = profile.drivingSide === "left" ? -1 : 1;
    const lane = rng() < 0.7 ? own : -own;
    const x = road.x(z) + lane * halfW * 0.48;
    if (L && !L.take(x, z, 1.1, 2.2)) return;
    const color = { h: rng() * 360, s: 70, l: 64 };
    const plateSpec = plateFor(profile, rng);
    queue.push({ z, draw: (ctx) => {
      const p = cam.p(x, z, 0);
      P.hoverCar(ctx, p.x, p.y, p.s, color, U, rng, plateSpec);
      if (!plateSpec) return;
      const pw = p.s * 1.9 * 0.34;
      const ph = pw * 0.42;
      const cy = p.y - p.s * 0.38 - p.s * 0.85 * 0.3;
      noteHit(cam, p.x - pw / 2, cy - ph / 2, pw, ph, "plate", plateSpec);
    } });
  }

  function populateVillage(queue, cam, road, halfW, profile, pal, biome, rng, U, shown, L) {
    let z = 6 + rng() * 5;
    const count = 2 + Math.floor(rng() * 4);
    for (let i = 0; i < count; i++) {
      addShack(queue, cam, road, halfW, profile, rng, U, z, i % 2 ? 1 : -1, shown.building, L);
      z += 5 + rng() * 9;
    }
    if (rng() < 0.45) {
      const sz = 5 + rng() * 6;
      const sx = road.x(sz) + (rng() < 0.5 ? -1 : 1) * (halfW + 1.9);
      const color = { h: rng() * 360, s: 75, l: 62 };
      if (L.take(sx, sz, 1.4, 0.6)) {
        queue.push({ z: sz, draw: (ctx) => {
          const p = cam.p(sx, sz, 0);
          P.stall(ctx, p.x, p.y, p.s, color, U, rng);
        } });
      }
    }
    const near = shown.aliens;
    const n = near ? 2 + Math.floor(rng() * 4) : 1 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const az = near ? 5 + rng() * 18 : 26 + rng() * 34;
      addAlien(queue, cam, road, halfW, profile, rng, U, az, road.x(az) + (rng() - 0.5) * (halfW * 2 + 4), L);
    }
    if (rng() < 0.3) addCar(queue, cam, road, halfW, profile, rng, U, 14 + rng() * 30, L);
    addOddities(queue, cam, road, halfW, profile, pal, biome, rng, U, shown, "village", L);
    for (let i = 0; i < Math.round(26 * pal.density); i++) {
      const pz = 3.2 + Math.pow(rng(), 1.3) * 80;
      const side = rng() < 0.5 ? -1 : 1;
      const off = 1.2 + rng() * 14;
      addPlant(queue, cam, profile, pal, biome, rng, U, pz, road.x(pz) + side * (halfW + off), shown, true, L, off);
    }
    for (let i = 0; i < 18; i++) {
      const pz = 60 + rng() * 200;
      addPlant(queue, cam, profile, pal, biome, rng, U, pz, road.x(pz) + (rng() < 0.5 ? -1 : 1) * (halfW + 3 + rng() * 50), shown, false);
    }
  }

  function populateCity(queue, cam, road, halfW, profile, pal, rng, U, shown, L) {
    let wired = false;
    [-1, 1].forEach((side) => {
      L.block(road.x(3) + side * (halfW + 3.2), road.x(3) + side * (halfW + 40), 0, 250);
      let z = 3 + rng() * 3;
      let neonUsed = false;
      while (z < 140) {
        const depth = 12 + rng() * 8;
        const z0 = z;
        const neon = !neonUsed && z0 < 36
          ? { h: profile.accentColor.h, s: 90, l: 62 }
          : null;
        if (neon) neonUsed = true;
        const spec = {
          xa: road.x(z0) + side * (halfW + 3.2),
          side,
          z0,
          width: 14 + rng() * 8,
          depth,
          height: 12 + rng() * 16 + (z0 > 70 ? rng() * 10 : 0),
          wall: wallPalette(profile, rng, shown.building),
          roof: shown.building ? profile.roofColor : { h: 260, s: 12, l: 50 },
          roofShape: shown.building ? profile.roofShape : null,
          windowStyle: shown.building ? profile.windowStyle : "plain",
          awning: profile.accentColor,
          balconies: rng() < 0.45,
          pipe: rng() < 0.5,
          neon,
          glyphs: glyphRun(rng, 3),
          rand: rng,
        };
        queue.push({ z: z0 + depth, draw: (ctx) => P.building(ctx, cam, spec, U) });
        if (!wired && z0 > 10 && z0 < 28) {
          wired = true;
          const cz = z0 + depth * 0.5;
          const other = road.x(cz) - side * (halfW + 3.2);
          const mine = road.x(cz) + side * (halfW + 3.2);
          const h1 = 8;
          const h2 = 8;
          queue.push({ z: cz - 0.05, draw: (ctx) => {
            const a = cam.p(mine, cz, h1);
            const b = cam.p(other, cz, h2);
            stroke(ctx, () => {
              ctx.moveTo(a.x, a.y);
              ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + a.s * 1.2, b.x, b.y);
            }, INK, Math.max(1.4, 1.6 * U));
          } });
        }
        z += depth + 12 + rng() * 10;
      }
    });
    if (rng() < 0.6) {
      const cz = 6 + rng() * 8;
      const side = rng() < 0.5 ? -1 : 1;
      const cx = road.x(cz) + side * (halfW + 1.9);
      const color = { h: rng() * 360, s: 75, l: 64 };
      if (L.take(cx, cz, 1.1, 0.8)) {
        queue.push({ z: cz, draw: (ctx) => {
          const p = cam.p(cx, cz, 0);
          P.cafe(ctx, p.x, p.y, p.s, color, U);
        } });
        if (shown.aliens) {
          addAlien(queue, cam, road, halfW, profile, rng, U, cz - 1, cx - 1.1 * side, L);
          addAlien(queue, cam, road, halfW, profile, rng, U, cz + 1.2, cx, L);
        }
      }
    }
    if (rng() < 0.35) {
      const sz = 8 + rng() * 10;
      const sx = road.x(sz) + (rng() < 0.5 ? -1 : 1) * (halfW + 1.9);
      const color = { h: rng() * 360, s: 75, l: 62 };
      if (L.take(sx, sz, 1.3, 0.6)) {
        queue.push({ z: sz, draw: (ctx) => {
          const p = cam.p(sx, sz, 0);
          P.stall(ctx, p.x, p.y, p.s, color, U, rng);
        } });
      }
    }
    const near = shown.aliens;
    const n = near ? 4 + Math.floor(rng() * 5) : 2 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
      const az = near ? 5 + rng() * 22 : 30 + rng() * 40;
      const side = rng() < 0.5 ? -1 : 1;
      addAlien(queue, cam, road, halfW, profile, rng, U, az, road.x(az) + side * (halfW + 0.7 + rng() * 2.2), L);
    }
    const cars = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < cars; i++) addCar(queue, cam, road, halfW, profile, rng, U, 12 + rng() * 60, L);
    for (let i = 0, planted = 0; i < 6 && planted < 3; i++) {
      const tz = 7 + rng() * 30;
      const side = rng() < 0.5 ? -1 : 1;
      const tx = road.x(tz) + side * (halfW + 1.1);
      if (!L.take(tx, tz, 0.9, 1)) continue;
      planted += 1;
      if (shown.vegetation) addPlant(queue, cam, profile, pal, "meadow", rng, U, tz, tx, { vegetation: true }, true);
      else {
        const plant = pal.plantA;
        queue.push({ z: tz, draw: (ctx) => {
          const p = cam.p(tx, tz, 0);
          P.tree(ctx, p.x, p.y, p.s, 4 + rng() * 2, plant, pal.trunk, rng, U);
        } });
      }
    }
  }

  function drawSkyline(ctx, cam, road, pal, rng, U) {
    const vx = cam.p(road.x(400), 400, 0).x;
    const color = mixC({ h: pal.sky0.h + 30, s: 30, l: 72 }, pal.sky1, 0.3);
    for (let i = 0; i < 9; i++) {
      const x = vx + (rng() - 0.5) * cam.W * 0.7;
      const h = (60 + rng() * 150) * U;
      const w = (12 + rng() * 18) * U;
      P.tower(ctx, x, cam.y0 + 2, h, w, shade(color, (rng() - 0.5) * 12), rng, U);
    }
  }

  function drawShips(ctx, cam, rng, U, count) {
    for (let i = 0; i < count; i++) {
      const name = ["shipPink", "shipBlue", "shipPink_manned", "shipBlue_manned"][Math.floor(rng() * 4)];
      const size = (40 + rng() * 60) * U;
      P.ship(ctx, cam.W * (0.08 + rng() * 0.84), cam.y0 * (0.15 + rng() * 0.6), size, name, (rng() - 0.5) * 0.4);
    }
  }

  function drawForeground(ctx, cam, pal, biome, rng, U) {
    const lush = biome === "jungle" || biome === "meadow" || biome === "beach";
    if (!lush) return;
    [-1, 1].forEach((side) => {
      if (rng() < (biome === "jungle" ? 0.25 : 0.55)) return;
      const x = side < 0 ? -cam.W * 0.02 : cam.W * 1.02;
      const plant = shade(pal.plantA, -6);
      P.fern(ctx, x, cam.H + 20 * U, 100 * U, 2.2 + rng() * 1.4, plant, rng, U);
      if (rng() < 0.5) P.fern(ctx, x + side * -cam.W * 0.06, cam.H + 30 * U, 100 * U, 1.4 + rng(), pal.plantB, rng, U);
    });
  }

  function drawWeather(ctx, cam, profile, pal, rng, U) {
    const { W, H, y0 } = cam;
    if (profile.weather === "mist") {
      for (let i = 0; i < 4; i++) {
        const y = y0 - 20 * U + i * 26 * U;
        const g = ctx.createLinearGradient(0, y - 30 * U, 0, y + 30 * U);
        g.addColorStop(0, "rgba(255, 255, 255, 0)");
        g.addColorStop(0.5, "rgba(255, 250, 255, 0.4)");
        g.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, y - 30 * U, W, 60 * U);
      }
    } else if (profile.weather === "dust") {
      ctx.fillStyle = "rgba(240, 200, 140, 0.18)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(160, 110, 60, 0.5)";
      for (let i = 0; i < 160; i++) {
        ctx.beginPath();
        ctx.arc(rng() * W, rng() * H, (0.6 + rng() * 1.6) * U, 0, TAU);
        ctx.fill();
      }
    } else if (profile.weather === "spores") {
      for (let i = 0; i < 70; i++) {
        const x = rng() * W;
        const y = rng() * H * 0.9;
        const r = (1.5 + rng() * 3.5) * U;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
        g.addColorStop(0, col(profile.accentColor, 30, 0, 0.9));
        g.addColorStop(1, col(profile.accentColor, 30, 0, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * 3, 0, TAU);
        ctx.fill();
      }
    }
    void pal;
  }

  function finish() {}

  function drawLoupe(ctx, W, H, hit) {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#fffaf2");
    g.addColorStop(1, "#ffe7c4");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const U = H / 360;
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    G.wc.begin(1, U);
    G.wc.setLine("pen");
    try {
      if (hit.kind === "billboard") P.billboard(ctx, W * 0.5, H * 0.96, H * 0.26, hit.spec, U);
      else if (hit.kind === "km") P.kmMarker(ctx, W * 0.5, H * 0.94, H * 0.62, hit.spec.style, hit.spec.number, U * 1.4);
      else if (hit.kind === "plate") P.plate(ctx, W * 0.5, H * 0.5, W * 0.72, hit.spec, U * 2);
      else if (hit.kind === "sign") {
        const S = H / 4.2;
        const view = { p: (x, z, y) => ({ x: W * 0.5 + x * S, y: H * 0.92 - (y || 0) * S, s: S }) };
        P.sign(ctx, view, 0, 0, hit.spec, U);
      }
    } finally {
      G.wc.end();
      ctx.restore();
    }
  }

  function drawScene(ctx, W, H, opts) {
    photoHits = [];
    const { planet, location: loc, profile, rng } = opts;
    const U = H / 720;
    let biome = G.biomeAt(planet.terrain, loc.x, loc.y);
    if (biome === "sea" || biome === "lake") biome = "beach";
    const place = G.settlementAt(planet, loc.x, loc.y);
    const kind = place.kind;
    const shown = shownFeatures(profile, rng, kind);
    const pal = palette(profile, biome);
    const roadInfo = planet.roads[loc.road];
    const roadCls = roadInfo ? roadInfo.cls : "minor";
    const halfW = kind === "city" ? 4.6 : roadCls === "major" ? 3.1 : 2.3;
    const lane = (profile.drivingSide === "left" ? -1 : 1) * halfW * 0.4;
    const cam = camera(W, H, lane);
    const road = roadModel(planet, loc, rng, kind);
    const hz = horizonProfile(cam, planet, loc);
    const centerWater = hz.waterD[Math.floor(COLUMNS / 2)];
    const zMax = centerWater ? clamp(centerWater * FAR_M * 0.9, 60, 600) : 600;

    G.wc.begin(Math.floor(rng() * 4294967296), U);
    try {
      paintScene(ctx, { planet, loc, profile, rng, U, kind, shown, pal, roadCls, halfW, cam, road, hz, zMax, biome });
    } finally {
      G.wc.end();
    }
    G.photoHits = photoHits;
  }

  let depthLayer = null;

  function drawQueue(ctx, cam, items) {
    const bands = [[90, Infinity], [35, 90]];
    bands.forEach(([z0, z1]) => {
      const group = items.filter((item) => item.z >= z0 && item.z < z1);
      if (!group.length) return;
      depthLayer = depthLayer || document.createElement("canvas");
      if (depthLayer.width !== cam.W || depthLayer.height !== cam.H) {
        depthLayer.width = cam.W;
        depthLayer.height = cam.H;
      }
      const dc = depthLayer.getContext("2d");
      dc.setTransform(1, 0, 0, 1, 0, 0);
      dc.globalCompositeOperation = "source-over";
      dc.globalAlpha = 1;
      dc.clearRect(0, 0, cam.W, cam.H);
      dc.lineJoin = "round";
      dc.lineCap = "round";
      group.forEach((item) => {
        G.wc.setLine(item.pencil ? "pencil" : "pen");
        item.draw(dc);
      });
      ctx.drawImage(depthLayer, 0, 0);
    });
    items.filter((item) => item.z < 35).forEach((item) => {
      G.wc.setLine(item.pencil ? "pencil" : "pen");
      item.draw(ctx);
    });
  }

  function sunAngle(planet, profile, loc) {
    const bearing = ((((loc.heading * 180) / Math.PI + 90) % 360) + 360) % 360;
    const wobble = stableRand(`${planet.seed}|sun`)() * 50 - 25;
    const az = (profile.hemisphere === "south" ? 0 : 180) + wobble;
    return ((((az - bearing) % 360) + 540) % 360) - 180;
  }

  function drawSunSide(ctx, cam, rel, rng, U) {
    const halfFov = 40;
    if (Math.abs(rel) < halfFov + 4) {
      const x = cam.cx + Math.tan((rel * Math.PI) / 180) * cam.f;
      P.sun(ctx, x, cam.y0 * (0.24 + rng() * 0.12), 24 * U, U);
    } else if (Math.abs(rel) < 118) {
      P.sunGlow(ctx, cam.W, cam.H, Math.sign(rel), 1 - (Math.abs(rel) - halfFov) / 80);
    }
  }

  function paintScene(ctx, o) {
    const { planet, loc, profile, rng, U, kind, shown, pal, roadCls, halfW, cam, road, hz, zMax, biome } = o;
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    G.wc.setLine("pencil");
    const rel = sunAngle(planet, profile, loc);
    G.light = { dx: -Math.sin((rel * Math.PI) / 180), dy: Math.cos((rel * Math.PI) / 180) };
    drawSky(ctx, cam, pal, profile, rng, U);
    drawSunSide(ctx, cam, rel, rng, U);
    if (shown.stars) drawStars(ctx, cam, profile, rng, U);
    drawMoons(ctx, cam, planet, rng, U);
    if (shown.skyEvent) drawSkyEvent(ctx, cam, profile, rng, U);
    drawClouds(ctx, cam, pal, rng, U);
    const shipCount = kind === "city" ? 1 + Math.floor(rng() * 3) : rng() < (kind === "village" ? 0.3 : 0.12) ? 1 : 0;
    drawShips(ctx, cam, rng, U, shipCount);

    const haze = mixC(pal.sky1, pal.glow, 0.5);
    drawBand(ctx, cam, hz.bands.far, hz.meta.far, pal.mountain, haze, { haze: 0.4, snow: true, ink: 1, inkAlpha: 0.55, trees: 0 }, rng, U);
    if (kind === "city") drawSkyline(ctx, cam, road, pal, rng, U);
    drawSea(ctx, cam, hz, pal, rng, U);
    if (shown.landmark) drawLandmarks(ctx, cam, profile, pal, rng, U);
    drawBand(ctx, cam, hz.bands.mid, hz.meta.mid, pal.hill, haze, { haze: 0.32, snow: true, ink: 1.1, inkAlpha: 0.6, trees: 7 }, rng, U);
    drawBand(ctx, cam, hz.bands.near, hz.meta.near, shade(pal.hill, -6), haze, { haze: 0.12, snow: false, ink: 1.4, inkAlpha: 0.8, trees: 12 }, rng, U);
    drawGround(ctx, cam, hz, pal, rng, U);
    if (shown.groundPattern && kind !== "city") drawGroundPattern(ctx, cam, road, halfW, profile, pal, rng, U);
    drawRoad(ctx, cam, road, halfW, kind, roadCls, profile, pal, rng, U, zMax);

    const queue = [];
    const L = makeLayout();
    addCommon(queue, cam, road, halfW, profile, pal, rng, U, shown, kind, L, o.loc);
    if (kind === "city") populateCity(queue, cam, road, halfW, profile, pal, rng, U, shown, L);
    else if (kind === "village") populateVillage(queue, cam, road, halfW, profile, pal, biome, rng, U, shown, L);
    else populateWild(queue, cam, road, halfW, profile, pal, biome, rng, U, shown, L);
    drawQueue(ctx, cam, queue.filter((item) => item.z < zMax).sort((a, b) => b.z - a.z), haze);
    G.wc.setLine("pencil");

    if (kind !== "city") drawForeground(ctx, cam, pal, biome, rng, U);
    if (shown.probeCar) {
      G.wc.setLine("pen");
      P.probeCar(ctx, cam.W, cam.H, profile.probeCar, pal.sky1, U);
      G.wc.setLine("pencil");
    }
    if (shown.weather) drawWeather(ctx, cam, profile, pal, rng, U);
    finish(ctx, cam, U, pal, profile, rng);
    ctx.restore();
  }

  G.drawScene = drawScene;
  G.drawLoupe = drawLoupe;
  G.sceneKit = { camera, palette, drawSky, drawStars, drawSkyEvent, drawLandmarks, wallPalette, plateFor, metaPlant };
  G.paperTexture = paperTexture;
})(window.ProbeDrop = window.ProbeDrop || {});
