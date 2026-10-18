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
    const cap = [8, 9, 10][tier];
    const shown = { probeCar: !!profile.probeCar && rng() < M.FEATURE_CHANCE.probeCar };
    let count = 0;
    keys.forEach((key) => {
      shown[key] = count < cap && rng() < M.FEATURE_CHANCE[key];
      if (shown[key]) count += 1;
    });
    ["aliens", "vegetation"].forEach((key) => {
      if (!available[key] || shown[key]) return;
      shown[key] = true;
      count += 1;
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
    const glow = { h: pal.sky1.h, s: Math.max(18, pal.sky1.s * 0.45), l: Math.min(94, pal.sky1.l + 16) };
    g.addColorStop(0, col(pal.sky0));
    g.addColorStop(0.55, col(pal.sky1));
    g.addColorStop(1, col(mixC(pal.sky1, glow, 0.7)));
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
    const count = 2 + Math.floor(rand() * 2);
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
      const cx = cam.W * (0.16 + rng() * 0.68);
      const cy = cam.y0 * (0.2 + rng() * 0.28);
      const w = cam.W * (0.28 + rng() * 0.12);
      const h = w * 0.36;
      cloudShape(ctx, cx, cy, w, h, color, 2.2 * U);
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
    paint(ctx, () => {
      ctx.moveTo(cx - w * 0.32, cy + h * 0.02);
      ctx.quadraticCurveTo(cx - w * 0.1, cy + h * 0.22, cx + w * 0.08, cy + h * 0.06);
      ctx.quadraticCurveTo(cx + w * 0.28, cy + h * 0.2, cx + w * 0.34, cy + h * 0.02);
      ctx.quadraticCurveTo(cx, cy - h * 0.08, cx - w * 0.32, cy + h * 0.02);
      ctx.closePath();
    }, col(shade(color, -12)), { ink: Math.max(1.4, iw) });
    paint(ctx, () => ctx.ellipse(cx - w * 0.12, cy - h * 0.22, w * 0.1, h * 0.16, -0.4, 0, TAU), col(shade(color, 8)), { ink: Math.max(1.2, iw * 0.8) });
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
    if (opts.trees) ridgeTrees(ctx, cam, xs, ys, color, opts.trees, U);
  }

  function ridgeTrees(ctx, cam, xs, ys, color, count, U) {
    const n = Math.max(4, Math.min(7, Math.round(count / 2)));
    const leaf = { h: (color.h + 48) % 360, s: Math.min(82, color.s + 24), l: Math.max(34, color.l - 6) };
    const trunk = { h: 26, s: 46, l: 32 };
    for (let i = 0; i < n; i++) {
      const idx = Math.floor((0.06 + ((i + 0.5) / n) * 0.88) * (xs.length - 1));
      const y = ys[idx];
      if (y > cam.y0 - 12 * U) continue;
      const h = (28 + (i % 4) * 11) * U;
      let k = i * 19 + idx * 3 + 7;
      const rand = () => {
        k = (k * 16807 + 11) % 2147483647;
        return k / 2147483647;
      };
      P.tree(ctx, xs[idx], y + 4 * U, h / 5.4, 5.4, leaf, trunk, rand, U);
    }
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

  function drawMounds(ctx, cam, pal) {
    const y = cam.y0 + 6;
    const bumps = [
      { x: cam.W * 0.16, w: cam.W * 0.22, h: cam.y0 * 0.28, c: shade(pal.ground, -14) },
      { x: cam.W * 0.78, w: cam.W * 0.3, h: cam.y0 * 0.2, c: shade(pal.ground, -8) },
      { x: cam.W * 0.48, w: cam.W * 0.16, h: cam.y0 * 0.12, c: shade(pal.ground, -4) },
    ];
    bumps.forEach((b) => {
      paint(ctx, () => {
        ctx.moveTo(b.x - b.w, y);
        ctx.quadraticCurveTo(b.x - b.w * 0.45, y - b.h * 0.92, b.x, y - b.h);
        ctx.quadraticCurveTo(b.x + b.w * 0.5, y - b.h * 0.88, b.x + b.w, y);
        ctx.closePath();
      }, col(b.c), { ink: Math.max(2, cam.H * 0.0035) });
    });
  }

  function drawGround(ctx, cam, hz, pal, rng, U) {
    const tops = hz.waterY.map((y) => (y ? Math.min(cam.H, Math.max(y, cam.y0)) : cam.y0));
    const xs = tops.map((_, i) => (i / COLUMNS) * cam.W);
    const flat = tops.every((t) => Math.abs(t - cam.y0) < 14);
    if (flat) drawMounds(ctx, cam, pal);
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
      const own = (profile.drivingSide === "left" ? -1 : 1) * halfW * 0.48;
      const z = 12;
      const pts = [[-0.12, z], [0.12, z], [0.12, z + 2.6], [0.38, z + 2.6], [0, z + 4.1], [-0.38, z + 2.6], [-0.12, z + 2.6]].map(([x, zz]) => [own + x, zz]);
      paint(ctx, () => groundPoly(ctx, cam, road, pts), "#fff6ea", { ink: Math.max(1.6, 1.8 * U) });
      void rng;
      void zs;
      void base;
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

  function centerLine(ctx, cam, road, zs, profile, drng, zMax, U) {
    const pattern = profile.linePattern;
    if (pattern === "none") return;
    if (!pattern || pattern === "dashed") {
      const dash = pattern ? G.metaColors.LINE.dashed : col(profile.pathLineColor, 10);
      for (let z = 4; z < Math.min(72, zMax * 0.55); z += 9) {
        paint(ctx, () => strip(ctx, cam, road, [z, z + 0.2, z + 3.6], -0.12, 0.12), dash, { ink: Math.max(1.2, 1.3 * (U || 1)) });
      }
      return;
    }
    const near = zs.filter((z) => z < zMax * 0.7);
    const offsets = pattern === "double" ? [-0.22, 0.22] : [0];
    const ink = Math.max(1.4, 1.5 * (U || 1));
    offsets.forEach((o) => {
      paint(ctx, () => strip(ctx, cam, road, near, o - 0.16, o + 0.16), G.metaColors.LINE[pattern], { ink });
    });
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
    centerLine(ctx, cam, road, zs, profile, drng, zMax, U);
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
        const walk = { h: 28, s: 16, l: 86 };
        let i = 0;
        for (let z = zs[0]; z < 52; z += 8) {
          paint(ctx, () => strip(ctx, cam, road, [z, z + 0.2, z + 7.6], side * halfW, side * (halfW + 3.2), 0.15), i % 2 ? col(walk, -14) : col(walk), { ink: Math.max(1.5, 1.6 * U) });
          i += 1;
        }
      });
      const asphalt = { h: 255, s: 14, l: 44 };
      const g = ctx.createLinearGradient(0, farY, 0, cam.H);
      g.addColorStop(0, col(mixC(asphalt, pal.sky1, 0.4)));
      g.addColorStop(1, col(asphalt, -6));
      paint(ctx, build, g, { ink: Math.max(2, 2.2 * U) });
      for (let i = 0; i < 2; i++) {
        rng();
        rng();
        for (let k = 0; k < 4; k++) {
          rng();
          rng();
        }
      }
      rng();
      rng();
      if (rng() < 0.6) {
        rng();
        rng();
        rng();
      }
      const curbPaint = profile.curb && G.metaColors.CURB[profile.curb];
      [-1, 1].forEach((side) => {
        const curb = { h: 240, s: 10, l: 86 };
        paint(ctx, () => strip(ctx, cam, road, zs, side * halfW, side * (halfW + 0.22), 0.15), col(curb), { ink: 1.1 * U });
        if (curbPaint) {
          let k = 0;
          for (let z = zs[0]; z < 48; z += 6.5) {
            ctx.fillStyle = curbPaint[k % 2];
            ctx.beginPath();
            strip(ctx, cam, road, [z, z + 0.15, z + 6.1], side * halfW, side * (halfW + 0.28), 0.16);
            ctx.fill();
            k += 1;
          }
        }
        stroke(ctx, () => edgeLine(ctx, cam, road, zs, side * halfW), INK, 1.8 * U);
      });
      centerLine(ctx, cam, road, zs, profile, drng, zMax, U);
      if (rng() < 0.5) rng();
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
      let i = 0;
      for (let z = zs[0]; z < Math.min(64, zMax); z += 8) {
        const pale = { h: c.h, s: Math.max(8, c.s * 0.3), l: Math.min(94, c.l + 30) };
        const fill = i % 2 ? col(c, -8) : col(pale);
        paint(ctx, () => strip(ctx, cam, road, [z, z + 0.15, z + 7.7], -halfW * 0.92, halfW * 0.92), fill, { ink: Math.max(1.4, 1.6 * U) });
        i += 1;
      }
    } else if (style === "glow") {
      ctx.save();
      ctx.shadowColor = col(c, 10);
      ctx.shadowBlur = 10 * U;
      ctx.fillStyle = col(c, 14);
      for (let z = 5; z < Math.min(48, zMax * 0.4); z += 11) {
        ctx.beginPath();
        strip(ctx, cam, road, [z, z + 0.4, z + 4.2], -0.22, 0.22);
        ctx.fill();
      }
      ctx.restore();
    } else if (style === "rails") {
      ctx.strokeStyle = col({ h: 30, s: 30, l: 40 }, 0, 0, 0.7);
      ctx.lineWidth = 2.4 * U;
      ctx.beginPath();
      for (let z = zs[0]; z < 36; z += 3.4) {
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

  function addAlien(queue, cam, road, halfW, profile, rng, U, z0, x0, L, opts) {
    const o = opts || {};
    let z = Math.max(o.near ? 4.2 : 5, z0);
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
          pose: o.pose === undefined ? (rng() < 0.3 ? 1 : 0) : o.pose,
          flip: o.flip === undefined ? rng() < 0.5 : o.flip,
          tilt: o.tilt === undefined ? (rng() - 0.5) * 0.28 : o.tilt,
          scale: o.scale === undefined ? 1.2 + rng() * 0.35 : o.scale,
        }, U);
      },
    });
    return true;
  }

  const CANDY = [
    { h: 186, s: 78, l: 56 },
    { h: 322, s: 80, l: 62 },
    { h: 108, s: 74, l: 50 },
    { h: 276, s: 72, l: 62 },
    { h: 48, s: 88, l: 58 },
  ];

  function candyPlant(ctx, x, y, s, biome, rng, U, roll) {
    const color = CANDY[Math.floor(rng() * CANDY.length)];
    const trunk = { h: 28, s: 36, l: 32 };
    const r = roll === undefined ? rng() : roll;
    if (biome === "dry") {
      if (r < 0.62) P.kitTree(ctx, x, y, s, 3.6 + rng() * 2.4, color, trunk, "cactus", U);
      else P.bulb(ctx, x, y, s, 1.5 + rng() * 1.6, color, rng, U);
      return;
    }
    if (biome === "snow") {
      if (r < 0.55) P.crystal(ctx, x, y, s, 1.8 + rng() * 2.4, color, rng, U);
      else P.balloonPod(ctx, x, y, s, 2.4 + rng() * 2.2, color, rng, U);
      return;
    }
    if (biome === "rock" || biome === "highland") {
      if (r < 0.28) P.bulb(ctx, x, y, s, 1.2 + rng() * 1.1, color, rng, U);
      else P.boulder(ctx, x, y, s, 0.5 + rng() * 1.5, { h: 262, s: 22, l: 48 }, rng, U);
      return;
    }
    if (biome === "jungle") {
      const h = 3.6 + rng() * 4.4;
      if (r < 0.22) P.mushroom(ctx, x, y, s, 2.8 + rng() * 3.2, color, rng, U);
      else if (r < 0.44) P.palm(ctx, x, y, s, 5 + rng() * 4, color, trunk, rng, U);
      else if (r < 0.62) P.tentacle(ctx, x, y, s, h, color, rng, U);
      else if (r < 0.8) P.balloonPod(ctx, x, y, s, h, color, rng, U);
      else P.spiralFern(ctx, x, y, s, 2 + rng() * 2.2, color, rng, U);
      return;
    }
    if (r < 0.4) P.mushroom(ctx, x, y, s, 1.6 + rng() * 1.6, color, rng, U);
    else if (r < 0.7) P.palm(ctx, x, y, s, 3.2 + rng() * 2, color, trunk, rng, U);
    else P.eyestalk(ctx, x, y, s, 1.2 + rng() * 1.2, color, rng, U);
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
      if (z < 4.6 && off < 2.2) return false;
      if (big && (z < 6.5 || off < 2)) return false;
      if (!L.take(x, z, big ? 1.5 : 0.55, big ? 1.3 : 0.5)) return false;
    }
    queue.push({
      z,
      pencil: !meta,
      draw: (ctx) => {
        const p = cam.p(x, z, 0);
        if (p.x < -p.s * 8 || p.x > cam.W + p.s * 8) return;
        candyPlant(ctx, p.x, p.y, p.s, biome, rng, U, r);
      },
    });
  }

  function addPoles(queue, cam, road, halfW, profile, rng, U, side, offset, L) {
    const anchors = [];
    const zs = [];
    for (let z = 10 + rng() * 6; z < 220; z += 26) {
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

  function placeBand(loc, difficulty) {
    const roll = (G.hashSeed(`${loc.x}|${loc.y}|clue`) % 1000) / 1000;
    if (difficulty === "easy") return 3.6 + roll * 1.6;
    if (difficulty === "medium") return roll < 0.4 ? 3.6 + roll * 2.2 : 14 + roll * 26;
    return 22 + roll * 24;
  }

  function addCommon(queue, cam, road, halfW, profile, pal, rng, U, shown, kind, L, loc, difficulty) {
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
    if (shown.sign && difficulty !== "hard") {
      const band = placeBand(loc, difficulty || "easy");
      for (let t = 0; t < 4; t++) {
        const z = band + t * 1.4;
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
    if (shown.plate) addCar(queue, cam, road, halfW, profile, rng, U, 4.6 + rng() * 1.5, L);
    if (shown.fence && !city) {
      const side = railSide ? -railSide : rng() < 0.5 ? -1 : 1;
      for (let z = 3.2; z < 46; z += 7) {
        const z0 = z;
        const x = road.x(z0) + side * (halfW + 0.7);
        L.block(x - 0.25, x + 0.25, z0, z0 + 7);
        queue.push({ z: z0 + 3.5, draw: (ctx) => P.fencePiece(ctx, cam, x, z0, z0 + 7, profile, U) });
      }
    }
    if (shown.banner && kind !== "wild" && difficulty !== "hard") {
      const band = placeBand(loc, difficulty || "easy");
      for (let t = 0; t < 4; t++) {
        const z = band + t * 1.2;
        const side = rng() < 0.5 ? -1 : 1;
        const x = road.x(z) + side * (halfW + 1.7);
        if (L.take(x, z, 0.5, 0.5)) {
          const flip = side < 0;
          at(z, x, 0, (ctx, p) => P.flagpole(ctx, p.x, p.y, p.s, profile.flag, profile.provinceFlag, U, flip));
          break;
        }
      }
    }
    if (difficulty !== "hard" && !shown.sign && !shown.banner) {
      const z = 3.5 + ((G.hashSeed(`${loc.x}|${loc.y}|near-flag`) % 1000) / 1000) * 1.1;
      const x = road.x(z) + halfW + 1.15;
      at(z, x, 0, (ctx, p) => P.flagpole(ctx, p.x, p.y, p.s, profile.flag, profile.provinceFlag, U, false));
    }
    if (difficulty === "hard") {
      const code = profile.code || "00";
      const z = 3.4 + ((G.hashSeed(`${loc.x}|${loc.y}|code`) % 1000) / 1000) * 1.2;
      const side = G.hashSeed(`${loc.x}|code-side`) % 2 ? 1 : -1;
      const x = road.x(z) + side * (halfW + 0.85);
      queue.push({
        z,
        draw: (ctx) => {
          const p = cam.p(x, z, 0);
          P.codePost(ctx, p.x, p.y, p.s, code, U);
          noteHit(cam, p.x - p.s * 0.7, p.y - p.s * 1.7, p.s * 1.4, p.s * 1.7, "code", { code });
        },
      });
    }
    if (shown.banner && difficulty !== "hard") {
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
    const base = { jungle: 28, meadow: 18, beach: 14, dry: 10, highland: 12, rock: 9, snow: 7, sea: 10, lake: 10 }[biome] || 14;
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
    const width = 5.6 + rng() * 2.4;
    const depth = 4.2 + rng() * 1.6;
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
      const scale = p.s * 1.55;
      P.hoverCar(ctx, p.x, p.y, scale, color, U, rng, plateSpec);
      if (!plateSpec) return;
      const pw = scale * 0.6;
      const ph = pw * 0.42;
      const cy = p.y - scale * 0.52;
      noteHit(cam, p.x - pw / 2, cy - ph / 2, pw, ph, "plate", plateSpec);
    } });
  }

  function populateVillage(queue, cam, road, halfW, profile, pal, biome, rng, U, shown, L) {
    let z = 4.2 + rng() * 2.2;
    const count = 3 + Math.floor(rng() * 2);
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
    for (let i = 0; i < Math.round(16 * pal.density); i++) {
      const pz = 3.2 + Math.pow(rng(), 1.3) * 80;
      const side = rng() < 0.5 ? -1 : 1;
      const off = 1.2 + rng() * 14;
      addPlant(queue, cam, profile, pal, biome, rng, U, pz, road.x(pz) + side * (halfW + off), shown, true, L, off);
    }
    for (let i = 0; i < 10; i++) {
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
    for (let i = 0; i < 4; i++) {
      const z = 4 + rng() * 18;
      const side = i % 2 ? 1 : -1;
      const x = road.x(z) + side * (halfW + 0.7);
      if (!L.take(x, z, 0.45, 0.4)) continue;
      const hue = { h: rng() * 360, s: 55, l: 58 };
      queue.push({ z, draw: (ctx) => {
        const p = cam.p(x, z, 0);
        if (i % 2) P.barrel(ctx, p.x, p.y, p.s, hue, U);
        else P.crate(ctx, p.x, p.y, p.s, U);
      } });
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

  function drawFramePlants(ctx, cam, pal, U) {
    const spots = [
      { x: cam.W * 0.0, y: cam.H * 1.02, s: 26 * U, plant: pal.plantA, hue: 330 },
      { x: cam.W * 1.0, y: cam.H * 1.0, s: 30 * U, plant: pal.plantB, hue: 18 },
    ];
    spots.forEach((sp, i) => {
      let k = 80 + i * 13;
      const rand = () => {
        k = (k * 48271 + 7) % 2147483647;
        return k / 2147483647;
      };
      P.bush(ctx, sp.x, sp.y, sp.s, 1.7, sp.plant, rand, U);
      P.flower(ctx, sp.x + (i ? -34 : 34) * U, sp.y - 8 * U, sp.s * 0.42, 1.15, { h: sp.hue, s: 82, l: 66 }, rand, U);
      P.flower(ctx, sp.x + (i ? -16 : 16) * U, sp.y + 2 * U, sp.s * 0.28, 0.9, { h: (sp.hue + 50) % 360, s: 78, l: 70 }, rand, U);
    });
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
      ctx.fillStyle = "rgba(176, 120, 64, 0.55)";
      for (let i = 0; i < 14; i++) {
        ctx.beginPath();
        ctx.arc(rng() * W, rng() * H, (3 + rng() * 5) * U, 0, TAU);
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
      else if (hit.kind === "code") P.codePost(ctx, W * 0.5, H * 0.92, H * 0.42, hit.spec.code, U * 1.6);
      else if (hit.kind === "plaque") {
        const view = { p: (x, z, y) => ({ x: W * 0.5 + x * 18, y: H * 0.78 - (y || 0) * 18, s: 70 }), W, H };
        P.wonder(ctx, view, 0, 0, hit.spec.id, U);
      }
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

  function kitOf(planet) {
    return (planet && planet.kit) || (G.PLANETS ? G.PLANETS.get("candy") : null);
  }

  function wavyBand(ctx, y0, y1, amp, phase, W, H) {
    ctx.moveTo(0, H);
    ctx.lineTo(0, y0);
    for (let x = 0; x <= W; x += 28) {
      ctx.lineTo(x, y0 + Math.sin(x * 0.012 + phase) * amp);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    void y1;
  }

  function drawBandedSky(ctx, cam, pal, kit) {
    void pal;
    void kit;
    const lemon = { h: 50, s: 58, l: 90 };
    const mint = { h: 162, s: 36, l: 84 };
    const blush = { h: 348, s: 42, l: 88 };
    const g = ctx.createLinearGradient(0, 0, 0, cam.y0 + 48);
    g.addColorStop(0, col(lemon));
    g.addColorStop(0.46, col(mint));
    g.addColorStop(1, col(blush));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cam.W, cam.y0 + 48);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cam.W, cam.y0 + 40);
    ctx.clip();
    [
      [0.18, 0.22, 0.42, lemon],
      [0.52, 0.34, 0.5, mint],
      [0.82, 0.18, 0.34, blush],
      [0.32, 0.62, 0.46, blush],
      [0.7, 0.5, 0.38, mint],
      [0.08, 0.48, 0.28, lemon],
    ].forEach(([x, y, r, c]) => {
      G.wc.bloom(ctx, cam.W * x, cam.y0 * y, cam.W * r * 0.34, col(c), 0.28);
    });
    ctx.restore();
  }

  function hillY(x, y, amp, phase) {
    const wave = Math.sin(x * 0.0062 + phase) * amp + Math.sin(x * 0.014 + phase * 1.4) * amp * 0.22;
    const lump = Math.sin(x * 0.031 + phase * 2.2) * amp * 0.2;
    const bump = Math.sin(x * 0.084 + phase * 0.7) > 0.74 ? amp * 0.26 : 0;
    return y - (wave + lump + bump);
  }

  function drawWaveHill(ctx, cam, y, amp, color, phase) {
    const ink = Math.max(3, cam.H * 0.006);
    paint(ctx, () => {
      ctx.moveTo(0, cam.H);
      ctx.lineTo(0, hillY(0, y, amp, phase));
      for (let x = 6; x <= cam.W; x += 6) ctx.lineTo(x, hillY(x, y, amp, phase));
      ctx.lineTo(cam.W, cam.H);
      ctx.closePath();
    }, col(color));
    stroke(ctx, () => {
      ctx.moveTo(0, hillY(0, y, amp, phase));
      for (let x = 6; x <= cam.W; x += 6) ctx.lineTo(x, hillY(x, y, amp, phase));
    }, INK, ink);
  }

  function drawFlatOrb(ctx, cam, kit, U) {
    if (!kit || kit.orb === "none") return;
    const x = cam.W * (kit.orb === "moon" ? 0.72 : 0.22);
    const y = cam.y0 * 0.28;
    const r = 28 * U;
    const fill = kit.orb === "moon" ? { h: 48, s: 20, l: 90 } : { h: 48, s: 80, l: 70 };
    paint(ctx, () => ctx.arc(x, y, r, 0, TAU), col(fill), { ink: Math.max(3, 2.4 * U) });
  }

  function drawTowers(ctx, cam, U) {
    const baseY = cam.y0 + 6;
    [[0.42, 0.3, 0.012], [0.52, 0.22, 0.01]].forEach(([x, h, w]) => {
      const cx = cam.W * x;
      const top = baseY - cam.H * h;
      paint(ctx, () => {
        ctx.moveTo(cx - cam.W * w, baseY);
        ctx.lineTo(cx - cam.W * w * 0.62, top);
        ctx.lineTo(cx + cam.W * w * 0.62, top);
        ctx.lineTo(cx + cam.W * w, baseY);
        ctx.closePath();
      }, col({ h: 258, s: 16, l: 64 }), { ink: Math.max(1.2, 1.3 * U) });
    });
  }

  function drawSpiral(ctx, cam, U) {
    const cx = cam.W * 0.5;
    const cy = cam.y0 * 0.46;
    const maxR = Math.max(70, cam.y0 * 0.78);
    stroke(ctx, () => {
      for (let i = 0; i < 72; i++) {
        const t = i / 72;
        const a = t * Math.PI * 5.4;
        const rr = 5 * U + t * maxR;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr * 0.55;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }, "#f4e4ff", Math.max(3.2, 3.4 * U));
  }

  function drawChunkCloud(ctx, cx, cy, w, h) {
    const ink = Math.max(2.8, h * 0.09);
    [
      [-0.36, -0.04, 0.38, 0.52],
      [-0.08, -0.18, 0.28, 0.4],
      [0.16, -0.04, 0.24, 0.34],
      [0.34, 0.12, 0.18, 0.26],
      [-0.02, 0.16, 0.2, 0.2],
      [0.14, 0.2, 0.16, 0.16],
    ].forEach(([ox, oy, rx, ry]) => {
      paint(ctx, () => ctx.ellipse(cx + ox * w, cy + oy * h, rx * w, ry * h, 0, 0, TAU), "#f7f8fb");
    });
    paint(ctx, () => ctx.ellipse(cx + w * 0.02, cy + h * 0.18, w * 0.34, h * 0.14, 0, 0, TAU), "#c5ceda");
    G.wc.bloom(ctx, cx + w * 0.04, cy - h * 0.08, w * 0.28, "rgba(255,255,255,0.9)", 0.5);
    paint(ctx, () => {
      ctx.moveTo(cx - w * 0.5, cy + h * 0.16);
      ctx.bezierCurveTo(cx - w * 0.54, cy - h * 0.4, cx - w * 0.14, cy - h * 0.78, cx + w * 0.02, cy - h * 0.5);
      ctx.bezierCurveTo(cx + w * 0.18, cy - h * 0.9, cx + w * 0.5, cy - h * 0.22, cx + w * 0.5, cy + h * 0.14);
      ctx.bezierCurveTo(cx + w * 0.36, cy + h * 0.5, cx - w * 0.18, cy + h * 0.52, cx - w * 0.5, cy + h * 0.16);
      ctx.closePath();
    }, "rgba(0,0,0,0)", { ink });
  }

  function drawCleanRoad(ctx, cam, road, halfW, profile, kit, pal, U, zMax, biome, kind) {
    const far = Math.min(70, zMax);
    const zs = roadSamples(cam, far);
    const shoulder = !kit ? 0.85 : kit.shoulder === "lawn" ? 1.25 : kit.shoulder === "pier" ? 1.35 : 0.8;
    let shoulderColor = !kit ? pal.ground
      : kit.shoulder === "lawn" ? shade(pal.plantA, 6)
      : kit.shoulder === "dust" ? shade(pal.ground, 8)
      : kit.shoulder === "pier" ? { h: 28, s: 36, l: 58 }
      : { h: 36, s: 16, l: 84 };
    if (biome === "dry") shoulderColor = { h: 34, s: 48, l: 58 };
    else if (biome === "snow") shoulderColor = { h: 206, s: 12, l: 90 };
    else if (biome === "jungle") shoulderColor = { h: 118, s: 42, l: 30 };
    else if (biome === "rock" || biome === "highland") shoulderColor = { h: 26, s: 16, l: 50 };
    const ink = Math.max(2.6, 2.2 * U);
    [-1, 1].forEach((side) => {
      paint(ctx, () => strip(ctx, cam, road, zs, side * halfW, side * (halfW + shoulder), 0.04), col(shoulderColor), { ink });
    });
    if (kit && kit.shoulder === "pier") {
      const water = { h: 196, s: 48, l: 52 };
      [-1, 1].forEach((side) => {
        paint(ctx, () => strip(ctx, cam, road, zs, side * (halfW + shoulder), side * (halfW + shoulder + 14), 0.02), col(water), { ink });
      });
      for (let z = zs[0], i = 0; z < 40; z += 6.5, i += 1) {
        [-1, 1].forEach((side) => {
          paint(ctx, () => strip(ctx, cam, road, [z, z + 0.2, z + 6], side * halfW, side * (halfW + shoulder), 0.05), i % 2 ? col(shoulderColor, -10) : col(shoulderColor, 6), { ink: Math.max(1.6, 1.4 * U) });
        });
      }
    }
    const asphalt = kind === "city"
      ? mixC(profile.pathColor || { h: 228, s: 10, l: 64 }, { h: 226, s: 8, l: 72 }, 0.5)
      : { h: 16, s: 48, l: 58 };
    paint(ctx, () => strip(ctx, cam, road, zs, -halfW, halfW), col(asphalt), { ink: ink + 0.6 });
    if (kind !== "city") {
      paint(ctx, () => strip(ctx, cam, road, zs.filter((z) => z < 60), -halfW * 0.22, halfW * 0.22), col({ h: 28, s: 40, l: 74 }));
    }
    const mark = profile.pathLineColor || { h: 50, s: 80, l: 62 };
    const pattern = profile.linePattern;
    if (pattern !== "none") {
      if (pattern === "double") {
        [-0.22, 0.22].forEach((o) => {
          paint(ctx, () => strip(ctx, cam, road, zs.filter((z) => z < 55), o - 0.08, o + 0.08), col(mark), { ink: Math.max(1.5, 1.3 * U) });
        });
      } else if (!pattern || pattern === "dashed") {
        for (let z = 5; z < 55; z += 8) {
          paint(ctx, () => strip(ctx, cam, road, [z, z + 0.15, z + 3.2], -0.1, 0.1), col(mark), { ink: Math.max(1.5, 1.3 * U) });
        }
      } else {
        paint(ctx, () => strip(ctx, cam, road, zs.filter((z) => z < 55), -0.1, 0.1), col(mark), { ink: Math.max(1.6, 1.4 * U) });
      }
    }
    if (biome !== "dry" && biome !== "snow" && biome !== "rock") for (let z = 9; z < 32; z += 7) {
      [-1, 1].forEach((side) => {
        const p = cam.p(road.x(z) + side * (halfW + shoulder * 0.55), z, 0);
        if (p.s > 22) return;
        let t = z * 1.7 + side;
        const rand = () => {
          t = (t * 12.9898) % 7.1;
          return t / 7.1;
        };
        P.tuft(ctx, p.x, p.y, p.s, 0.42, pal.plantA, rand, U);
      });
    }
  }

  function houseMaterial(kind, biome, index) {
    if (kind === "city") return index % 3 === 2 ? "stone" : "metal";
    if (biome === "dry") return "metal";
    if (biome === "rock" || biome === "highland") return "stone";
    if (biome === "beach") return index % 2 ? "wood" : "metal";
    return "wood";
  }

  function materialColor(material, tint) {
    const base = material === "metal" ? { h: 205, s: 16, l: 46 }
      : material === "stone" ? { h: 28, s: 18, l: 58 }
      : { h: 26, s: 46, l: 40 };
    return tint ? mixC(base, tint, 0.28) : base;
  }

  function populateExoticPlants(queue, cam, road, halfW, rng, U, L, loc, difficulty, kind) {
    const family = P.exoticFamily(loc.y);
    let codeSide = 0;
    if (difficulty === "hard") {
      const zc = 3.4 + ((G.hashSeed(`${loc.x}|${loc.y}|code`) % 1000) / 1000) * 1.2;
      codeSide = G.hashSeed(`${loc.x}|code-side`) % 2 ? 1 : -1;
      const xc = road.x(zc) + codeSide * (halfW + 0.85);
      L.block(xc - 1.6, xc + 1.6, zc - 0.9, zc + 1.6);
    }
    const city = kind === "city";
    const bag = family.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const swap = bag[i];
      bag[i] = bag[j];
      bag[j] = swap;
    }
    const spots = [];
    for (let i = 0; i < 14; i++) {
      spots.push({
        z: 4.7 + i * 2.15,
        side: i % 2 ? 1 : -1,
        h: i < 3 ? 2.7 + (i % 2) * 0.7 : i < 8 ? 1.85 : 1.15,
      });
    }
    spots.forEach((spot, i) => {
      const name = bag[i % bag.length];
      const z0 = Math.max(4.9, spot.z + (rng() - 0.5) * 0.7);
      const hh = spot.h * (0.9 + rng() * 0.2);
      let side = spot.side;
      if (codeSide && z0 < 9 && side === codeSide) side = -side;
      const offs = city ? [1.55, 1.85, 2.1] : [1.85, 2.7, 4.1, 5.6];
      const sides = [side, -side];
      const zs = [z0, z0 + 1.6, z0 + 3.2];
      let placed = null;
      for (let zi = 0; zi < zs.length && !placed; zi++) {
        const zz = zs[zi];
        for (let si = 0; si < sides.length && !placed; si++) {
          const sd = sides[si];
          if (codeSide && zz < 9 && sd === codeSide) continue;
          for (let oi = 0; oi < offs.length && !placed; oi++) {
            const xx = road.x(zz) + sd * (halfW + offs[oi]);
            const p = cam.p(xx, zz, 0);
            if (p.x < 42 || p.x > cam.W - 42) continue;
            if (L.take(xx, zz, city ? 0.34 : 0.58, city ? 0.32 : 0.46)) placed = { x: xx, z: zz };
          }
        }
      }
      if (!placed) return;
      const shapeSeed = G.hashSeed(`${name}|${i}|${placed.z.toFixed(2)}|${placed.x.toFixed(2)}|${Number(loc.y).toFixed(1)}`);
      const z = placed.z;
      const x = placed.x;
      queue.push({
        z,
        pencil: true,
        draw: (ctx) => {
          const p = cam.p(x, z, 0);
          if (p.x < -p.s * 14 || p.x > cam.W + p.s * 14) return;
          P.drawExotic(ctx, name, p.x, p.y, p.s, hh, G.mulberry32(shapeSeed || 1), U);
        },
      });
    });
  }

  function populateBiomePlants(queue, cam, road, halfW, profile, pal, rng, U, shown, L, biome) {
    const budget = biome === "jungle" ? 20
      : biome === "meadow" || biome === "beach" ? 12
      : biome === "dry" ? 9
      : biome === "snow" ? 7
      : biome === "rock" || biome === "highland" ? 8
      : 6;
    for (let i = 0; i < budget; i++) {
      const z = 6.2 + Math.pow(rng(), 1.25) * (biome === "jungle" ? 54 : 38);
      const side = i % 2 ? 1 : -1;
      const off = 0.9 + Math.pow(rng(), 1.15) * (biome === "jungle" ? 11 : 7);
      addPlant(queue, cam, profile, pal, biome, rng, U, z, road.x(z) + side * (halfW + off), shown, true, L, off);
    }
    if (biome === "jungle" || biome === "meadow" || biome === "beach") {
      for (let i = 0; i < 12; i++) {
        const z = 4.5 + (i % 6) * 0.55;
        const side = i % 2 ? 1 : -1;
        const x = road.x(z) + side * (halfW + 1.15 + (i % 3) * 0.65);
        const color = CANDY[i % CANDY.length];
        queue.push({
          z,
          draw: (ctx) => {
            const p = cam.p(x, z, 0);
            if (p.x < -20 || p.x > cam.W + 20) return;
            if (i % 2) P.mushroom(ctx, p.x, p.y, p.s * 0.72, 1.3 + (i % 3) * 0.3, color, rng, U);
            else P.eyestalk(ctx, p.x, p.y, p.s * 0.6, 1.05, color, rng, U);
          },
        });
      }
    }
  }

  function drawCritter(ctx, x, y, s, color) {
    paint(ctx, () => ctx.ellipse(x, y - s * 0.32, s * 0.5, s * 0.28, 0, 0, TAU), col(color), { ink: Math.max(1.6, s * 0.12) });
    paint(ctx, () => ctx.arc(x + s * 0.16, y - s * 0.4, Math.max(1.2, s * 0.1), 0, TAU), "#1b1033");
    paint(ctx, () => ctx.arc(x + s * 0.2, y - s * 0.42, Math.max(0.5, s * 0.035), 0, TAU), "#fff");
  }

  function populateKitStreet(queue, cam, road, halfW, profile, pal, rng, U, kind, L, kit, biome, loc) {
    const roofs = ["flat", "gable", "dome", "spike"];
    if (kind === "wild") {
      const z = 5.4;
      const side = -1;
      const spec = {
        xa: road.x(z) + (halfW + 2.4),
        side,
        z0: z,
        width: 3.6,
        depth: 2.6,
        height: 3.6,
        wall: materialColor("wood", profile.wallColor),
        roof: { h: 14, s: 46, l: 30 },
        awning: profile.accentColor,
        windowStyle: profile.windowStyle,
        glyphs: [profile.signGlyph],
        board: profile.accentColor,
        rand: rng,
        roofShape: "spike",
      };
      queue.push({ z, draw: (ctx) => P.shack(ctx, cam, spec, U) });
      const bz = 4.7;
      const bx = road.x(bz) + halfW * 0.55;
      queue.push({
        z: bz,
        draw: (ctx) => {
          const p = cam.p(bx, bz, 0);
          P.bench(ctx, p.x, p.y, p.s * 1.2, { h: 22, s: 42, l: 34 }, U);
        },
      });
    }
    if (kind === "city") {
      [
        { side: -1, z: 4.8, height: 9.4, balcony: true, roofKind: "flat" },
        { side: -1, z: 8.6, height: 6.2, balcony: false, roofKind: "gable" },
        { side: 1, z: 6.8, height: 7.6, balcony: true, roofKind: "dome" },
        { side: 1, z: 10.4, height: 5.6, balcony: false, roofKind: "spike" },
      ].forEach((shop, i) => {
        const material = houseMaterial(kind, biome, i);
        const spec = {
          xa: road.x(shop.z) + shop.side * (halfW + 0.2),
          side: shop.side,
          z0: shop.z,
          width: 4.2 + (i % 2) * 0.8,
          depth: 5.4,
          height: shop.height,
          panes: 2 + (i % 3),
          chimney: false,
          material,
          style: "siding",
          wall: mixC(materialColor(material, profile.wallColor), { h: profile.wallColor.h, s: 36, l: 26 + (i % 3) * 16 }, 0.2),
          roof: material === "metal" ? { h: 220, s: 22, l: 32 } : material === "stone" ? { h: 18, s: 22, l: 36 } : { h: 12, s: 48, l: 28 },
          roofKind: shop.roofKind,
          balcony: shop.balcony,
          awning: shop.balcony ? null : profile.accentColor,
          windowStyle: profile.windowStyle,
        };
        queue.push({ z: shop.z, draw: (ctx) => P.kitHouse(ctx, cam, spec, U) });
      });
      const stallZ = 4.45;
      const stallX = cam.lane + (cam.W * 0.84 - cam.cx) * stallZ / cam.f;
      queue.push({
        z: stallZ,
        draw: (ctx) => {
          const p = cam.p(stallX, stallZ, 0);
          P.stall(ctx, p.x, p.y, p.s * 1.15, profile.accentColor, U, rng);
        },
      });
      const carZ = 7;
      const carX = road.x(carZ);
      queue.push({
        z: carZ,
        draw: (ctx) => {
          const p = cam.p(carX, carZ, 0);
          P.hoverCar(ctx, p.x, p.y, p.s * 0.85, profile.accentColor, U, rng, plateFor(profile, rng));
        },
      });
    }
    if (kind === "village") {
      const n = 2;
      let z = 7.6;
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        const material = "wood";
        const width = 3.6 + rng() * 0.6;
        const depth = 5.2;
        const spec = {
          xa: road.x(z) + side * (halfW + (i === 0 ? 1.05 : 2.2)),
          side,
          z0: z,
          width,
          depth,
          height: 3.1 + rng() * 0.7,
          panes: 2 + (i % 3),
          chimney: kind === "village",
          material,
          style: "siding",
          wall: mixC(materialColor(material, profile.wallColor), { h: profile.wallColor.h, s: 36, l: 26 + (i % 3) * 16 }, 0.2),
          roof: material === "metal" ? { h: 220, s: 22, l: 32 } : material === "stone" ? { h: 18, s: 22, l: 36 } : { h: 12, s: 48, l: 28 },
          roofKind: roofs[i % roofs.length],
          balcony: kind === "city" && i % 2 === 0,
          awning: kind === "village" || kind === "city" ? profile.accentColor : null,
          windowStyle: profile.windowStyle,
        };
        queue.push({ z, draw: (ctx) => P.kitHouse(ctx, cam, spec, U) });
        z += kind === "city" ? 8.5 + rng() * 2.5 : 7;
      }
    }
    if (kit && kit.id === "suburb") {
      const z = 4.6;
      const x = road.x(z) + (halfW + 1.15);
      if (!L || L.take(x, z, 0.4, 0.4)) {
        queue.push({ z, draw: (ctx) => {
          const p = cam.p(x, z, 0);
          P.mailbox(ctx, p.x, p.y, p.s, U, profile.accentColor, profile.signGlyph);
        } });
      }
    }
    if (kind === "city" || (kit && kit.id === "suburb")) {
      addPoles(queue, cam, road, halfW, profile, rng, U, -1, 1.15, L);
    }
    if (kit && kit.id === "dust") {
      const z = 6.5;
      const x = road.x(z) - (halfW + 1.4);
      if (!L || L.take(x, z, 1.4, 0.8)) {
        queue.push({ z, draw: (ctx) => {
          const p = cam.p(x, z, 0);
          P.kitWreck(ctx, p.x, p.y, p.s, profile.wallColor, U);
        } });
      }
    }
    function onShoulder(z, side, extra) {
      const center = road.x(z);
      const reach = Math.min(halfW, 2.15) + extra;
      let x = center + side * reach;
      let p = cam.p(x, z, 0);
      const margin = 78;
      if (p.x < margin || p.x > cam.W - margin) {
        side = -side;
        x = center + side * reach;
        p = cam.p(x, z, 0);
      }
      let guard = 0;
      while ((p.x < margin || p.x > cam.W - margin) && guard < 6) {
        x = center + (x - center) * 0.62;
        p = cam.p(x, z, 0);
        guard += 1;
      }
      return x;
    }
    function atPixel(z, px) {
      return cam.lane + (px - cam.cx) * z / cam.f;
    }
    const lush = biome === "jungle" || biome === "meadow" || biome === "beach";
    if (kind !== "city" && lush) {
      const still = () => 0.46;
      queue.push({
        z: 5.8,
        draw: (ctx) => {
          P.mushroom(ctx, cam.W * 0.02, cam.H * 0.86, 42 * U, 4.6, CANDY[1], still, U);
          P.mushroom(ctx, cam.W * 0.16, cam.H * 0.94, 34 * U, 3.8, CANDY[3], () => 0.72, U);
        },
      });
      queue.push({
        z: 8.4,
        draw: (ctx) => {
          P.spiralFern(ctx, cam.W * 0.08, cam.H * 0.34, 28 * U, 4.2, CANDY[0], still, U);
        },
      });
      queue.push({
        z: 8.8,
        draw: (ctx) => {
          P.palm(ctx, cam.W * 0.9, cam.H * 0.4, 32 * U, 5.2, CANDY[1], { h: 28, s: 36, l: 32 }, still, U);
        },
      });
    }
    const spotKey = G.hashSeed(`${loc ? loc.x : 0}|${loc ? loc.y : 0}|crowd`);
    const layout = kind === "city" ? 3 : spotKey % 3;
    const roll = G.mulberry32(spotKey || 1);
    const placeOne = (z, px, scale, pose, flip) => {
      addAlien(queue, cam, road, halfW, profile, rng, U, z, atPixel(z, cam.W * px), null, {
        scale,
        pose,
        near: z < 5.2,
        flip: !!flip,
        tilt: (roll() - 0.5) * 0.36,
      });
    };
    if (layout === 0) {
      placeOne(4.35, 0.4, 2.15, 1, false);
      placeOne(4.62, 0.76, 0.82, 2, false);
      [[4.42, 0.9, 0.5, 0, false], [4.7, 0.8, 0.68, 4, false], [4.95, 0.7, 0.58, 0, true]].forEach(([z, px, scale, pose, flip]) => placeOne(z, px, scale, pose, flip));
      [[4.5, 0.14, 0.55, 1, true], [4.95, 0.24, 0.48, 3, true]].forEach(([z, px, scale, pose, flip]) => placeOne(z, px, scale, pose, flip));
    } else if (layout === 1) {
      placeOne(4.5, 0.38, 1.35, 4, false);
      placeOne(4.55, 0.62, 1.2, 1, true);
      [[6.2, 0.3, 0.5, 3, true], [7.1, 0.7, 0.46, 0, false], [8.4, 0.48, 0.45, 2, false]].forEach(([z, px, scale, pose, flip]) => placeOne(z, px, scale, pose, flip));
    } else if (layout === 2) {
      placeOne(4.25, 0.5, 2.3, 1, roll() < 0.5);
      [[5.4, 0.18, 0.62, 3, true], [5.8, 0.82, 0.55, 3, false], [6.6, 0.28, 0.48, 0, true], [7.4, 0.72, 0.5, 4, false]].forEach(([z, px, scale, pose, flip]) => placeOne(z, px, scale, pose, flip));
    } else {
      placeOne(4.4, 0.5, 1.7, 1, false);
      placeOne(4.7, 0.82, 0.9, 2, false);
      [[5.3, 0.16, 0.7, 4, true], [6.0, 0.24, 0.52, 0, true], [5.5, 0.7, 0.64, 3, false], [6.4, 0.62, 0.48, 1, false]].forEach(([z, px, scale, pose, flip]) => placeOne(z, px, scale, pose, flip));
    }
    for (let i = 0; i < 5; i++) {
      const z = 4.4 + i * 0.35;
      const px = i % 2 ? cam.W * (0.08 + (i % 3) * 0.05) : cam.W * (0.92 - (i % 3) * 0.04);
      const x = kind === "city" ? onShoulder(z, i % 2 ? -1 : 1, 1.6) : atPixel(z, px);
      const color = CANDY[(i + 2) % CANDY.length];
      queue.push({
        z,
        draw: (ctx) => {
          const p = cam.p(x, z, 0);
          if (p.x < 8 || p.x > cam.W - 8) return;
          drawCritter(ctx, p.x, p.y, p.s * 0.55, color);
        },
      });
    }
  }

  function paintScene(ctx, o) {
    const { planet, loc, profile, rng, U, kind, shown, pal, halfW, cam, road, zMax, biome } = o;
    const kit = kitOf(planet);
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    G.wc.setLine("pen");
    G.light = { dx: -0.2, dy: 0.4 };
    drawBandedSky(ctx, cam, pal, kit);
    drawFlatOrb(ctx, cam, kit, U);
    drawMoons(ctx, cam, planet, rng, U);
    if (kind === "city") {
      drawSpiral(ctx, cam, U);
      drawTowers(ctx, cam, U);
    }
    drawChunkCloud(ctx, cam.W * 0.3, cam.y0 * 0.22, cam.W * 0.22, cam.y0 * 0.16);
    drawChunkCloud(ctx, cam.W * 0.68, cam.y0 * 0.34, cam.W * 0.16, cam.y0 * 0.12);
    void kit;
    void pal;
    let hillFar = { h: 338, s: 28, l: 76 };
    let hillMid = { h: 272, s: 24, l: 78 };
    if (biome === "dry") {
      hillFar = { h: 22, s: 36, l: 76 };
      hillMid = { h: 16, s: 34, l: 68 };
    } else if (biome === "snow") {
      hillFar = { h: 206, s: 14, l: 94 };
      hillMid = { h: 214, s: 12, l: 88 };
    }
    drawWaveHill(ctx, cam, cam.y0 - 18, 26, hillFar, 0.4);
    drawWaveHill(ctx, cam, cam.y0 + 8, 34, hillMid, 1.7);
    if (biome === "rock" || biome === "highland") {
      drawWaveHill(ctx, cam, cam.y0 + 16, 50, mixC(pal.hill, { h: 22, s: 32, l: 44 }, 0.4), 0.85);
    }
    const groundTone = biome === "snow" ? { h: 206, s: 14, l: 92 }
      : biome === "dry" ? { h: 36, s: 48, l: 64 }
      : biome === "jungle" ? mixC(pal.ground, { h: 118, s: 44, l: 30 }, 0.62)
      : biome === "rock" || biome === "highland" ? { h: 26, s: 16, l: 50 }
      : pal.ground;
    drawWaveHill(ctx, cam, cam.y0 + 36, 42, groundTone, 2.5);
    const ridge = biome === "jungle"
      ? [[0.08, 2, 11], [0.22, -8, 8], [0.4, 6, 7], [0.72, -2, 9], [0.9, 8, 8]]
      : biome === "snow" ? [[0.16, 8, 6], [0.78, 12, 5]]
      : biome === "dry" ? [[0.14, 10, 7], [0.8, 14, 6]]
      : biome === "meadow" || biome === "beach" ? [[0.12, 4, 7], [0.78, 8, 6]]
      : [[0.16, 2, 6], [0.82, 10, 5]];
    ridge.forEach(([x, dy, sc], i) => {
      candyPlant(ctx, cam.W * x, cam.y0 + dy, sc * U, biome, rng, U, (i * 0.37) % 1);
    });
    drawCleanRoad(ctx, cam, road, halfW, profile, kit, pal, U, zMax, biome, kind);

    const queue = [];
    const L = makeLayout();
    addCommon(queue, cam, road, halfW, profile, pal, rng, U, shown, kind, L, loc, planet.difficulty);
    populateKitStreet(queue, cam, road, halfW, profile, pal, rng, U, kind, L, kit, biome, loc);
    populateBiomePlants(queue, cam, road, halfW, profile, pal, rng, U, shown, L, biome);
    populateExoticPlants(queue, cam, road, halfW, rng, U, L, loc, planet.difficulty, kind);
    (planet.wonders || []).forEach((wonder) => {
      const fx = Math.cos(loc.heading);
      const fy = Math.sin(loc.heading);
      const dx = wonder.x - loc.x;
      const dy = wonder.y - loc.y;
      const ahead = dx * fx + dy * fy;
      const side = dx * -fy + dy * fx;
      const dist = Math.hypot(dx, dy);
      if (ahead < 0.4 || dist > 26) return;
      const z = 7.5 + Math.min(dist, 20) * 0.12;
      const x = (side >= 0 ? 1 : -1) * (halfW + 3.2);
      queue.push({
        z,
        draw: (ctx) => {
          P.wonder(ctx, cam, x, z, wonder.id, U);
          const p = cam.p(x, z, 0);
          noteHit(cam, p.x - p.s * 1.2, p.y - p.s * 2.4, p.s * 2.4, p.s * 1.1, "plaque", { id: wonder.id });
        },
      });
    });
    drawQueue(ctx, cam, queue.filter((item) => item.z < zMax).sort((a, b) => b.z - a.z));
    if (shown.probeCar) {
      P.probeCar(ctx, cam.W, cam.H, profile.probeCar, pal.sky1, U);
    }
    G.wc.grainFrame(ctx, cam.W, cam.H, 0.1);
    ctx.restore();
  }

  G.drawScene = drawScene;
  G.drawLoupe = drawLoupe;
  G.sceneKit = { camera, palette, drawSky, drawStars, drawSkyEvent, drawLandmarks, wallPalette, plateFor, metaPlant };
  G.paperTexture = paperTexture;
})(window.ProbeDrop = window.ProbeDrop || {});
