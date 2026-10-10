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

  function shownFeatures(profile, rng) {
    const keys = ["skyEvent", "stars", "building", "vegetation", "aliens", "fence", "banner", "sign", "pole", "groundPattern", "weather", "landmark"];
    const shown = {};
    keys.forEach((key) => {
      shown[key] = rng() < 0.34;
    });
    if (profile.fence === "none") shown.fence = false;
    if (profile.banner === "none") shown.banner = false;
    if (profile.weather === "clear") shown.weather = false;
    let count = keys.filter((key) => shown[key]).length;
    ["sign", "aliens", "building", "vegetation", "skyEvent"].forEach((key) => {
      if (count >= 2 || shown[key]) return;
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
    const amp = kind === "city" ? 0 : (1.2 + rng() * 3.2) * (rng() < 0.5 ? -1 : 1);
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
    const plantA = { h: ground.h + 16, s: clamp(ground.s + 14, 30, 70), l: clamp(ground.l - 12, 28, 60) };
    const plantB = { h: ground.h - 24, s: clamp(ground.s + 6, 30, 70), l: clamp(ground.l - 2, 34, 66) };
    const plantC = { h: ground.h + 48, s: 52, l: 48 };
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
      dirt: biome === "snow" ? { h: 220, s: 18, l: 82 } : mixC(profile.pathColor, ground, 0.12),
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
    g.addColorStop(0, col(pal.sky0, -6));
    g.addColorStop(0.25, col(mixC(pal.sky0, pal.sky1, 0.45), -2));
    g.addColorStop(0.55, col(pal.sky1));
    g.addColorStop(0.82, col(mixC(pal.sky1, pal.glow, 0.6)));
    g.addColorStop(1, col(pal.glow, 4));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, y0 + 4);
    const glowY = y0 + 10 * U;
    const glow = ctx.createRadialGradient(W * 0.5, glowY, 0, W * 0.5, glowY, W * 0.6);
    glow.addColorStop(0, col(pal.glow, 14, 0, 0.6));
    glow.addColorStop(0.45, col(pal.glow, 10, 0, 0.22));
    glow.addColorStop(1, col(pal.glow, 10, 0, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, y0 + 4);
    for (let i = 0; i < 10; i++) {
      const x = rng() * W;
      const y = rng() * y0;
      const r = (80 + rng() * 200) * U;
      const tint = [pal.sky0, pal.sky1, profile.accentColor, pal.glow][i % 4];
      const bloom = ctx.createRadialGradient(x, y, 0, x, y, r);
      bloom.addColorStop(0, col(tint, 8, 0, 0.3));
      bloom.addColorStop(0.7, col(tint, 8, 0, 0.12));
      bloom.addColorStop(1, col(tint, 8, 0, 0));
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.4 + rng() * 0.4), (rng() - 0.5) * 0.6, 0, TAU);
      ctx.fill();
    }
    ctx.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      const y = y0 * (0.1 + rng() * 0.75);
      const x = rng() * W * 0.7;
      ctx.strokeStyle = col(mixC(pal.sky1, { h: 0, s: 0, l: 100 }, 0.5), 0, 0, 0.22);
      ctx.lineWidth = (6 + rng() * 14) * U;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + W * 0.1, y - 12 * U, x + W * 0.22, y + 10 * U, x + W * (0.3 + rng() * 0.2), y - 4 * U);
      ctx.stroke();
    }
    if (rng() < 0.4) {
      const tone = col(mixC(pal.sky1, pal.sky0, 0.5), -10, -10, 0.45);
      const n = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const x = W * (0.1 + rng() * 0.8);
        const y = y0 * (0.35 + rng() * 0.35);
        const w = (24 + rng() * 40) * U;
        ctx.fillStyle = tone;
        ctx.beginPath();
        ctx.moveTo(x - w, y);
        ctx.quadraticCurveTo(x - w * 0.9, y - w * 0.28, x - w * 0.4, y - w * 0.3);
        ctx.quadraticCurveTo(x, y - w * 0.55, x + w * 0.45, y - w * 0.3);
        ctx.quadraticCurveTo(x + w, y - w * 0.25, x + w, y);
        ctx.quadraticCurveTo(x + w * 0.3, y + w * 0.15, x + w * 0.05, y + w * 0.7);
        ctx.quadraticCurveTo(x - w * 0.3, y + w * 0.2, x - w, y);
        ctx.fill();
      }
    }
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
    const n = 2 + Math.floor(rng() * 4);
    const color = mixC(pal.sky1, { h: 330, s: 60, l: 98 }, 0.78);
    for (let i = 0; i < n; i++) {
      const cx = rng() * cam.W;
      const cy = cam.y0 * (0.12 + rng() * 0.55);
      const size = (26 + rng() * 46) * U * (cy / cam.y0 + 0.4);
      const blobs = [];
      const parts = 4 + Math.floor(rng() * 4);
      for (let k = 0; k < parts; k++) {
        const t = k / (parts - 1) - 0.5;
        blobs.push({
          x: cx + t * size * 3.2,
          y: cy - Math.cos(t * Math.PI) * size * 0.55 + rng() * size * 0.2,
          r: size * (0.5 + Math.cos(t * Math.PI) * 0.45 + rng() * 0.15),
        });
      }
      flatCloud(ctx, blobs, cy + size * 0.32, color, 1.4 * U);
    }
  }

  function flatCloud(ctx, blobs, baseY, color, iw) {
    const l = blobs[0].x;
    const r = blobs[blobs.length - 1].x;
    const shape = (grow) => {
      ctx.beginPath();
      blobs.forEach((b) => {
        ctx.moveTo(b.x + b.r + grow, b.y);
        ctx.arc(b.x, b.y, b.r + grow, 0, TAU);
      });
      ctx.rect(l, baseY - blobs[0].r, r - l, blobs[0].r);
    };
    const top = Math.min(...blobs.map((b) => b.y - b.r)) - iw * 2;
    const left = Math.min(...blobs.map((b) => b.x - b.r)) - iw * 2;
    const right = Math.max(...blobs.map((b) => b.x + b.r)) + iw * 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, right - left, baseY + iw - top);
    ctx.clip();
    ctx.fillStyle = INK;
    shape(iw);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, right - left, baseY - top);
    ctx.clip();
    shape(0);
    ctx.clip();
    ctx.fillStyle = col(color);
    ctx.fillRect(left, top, right - left, baseY - top);
    const span = baseY - top;
    ctx.fillStyle = col(color, -10, 6);
    ctx.beginPath();
    ctx.moveTo(left, baseY);
    for (let x = left; x <= right; x += span * 0.3) {
      ctx.lineTo(x, baseY - span * (0.24 + 0.05 * Math.sin(x * 0.07)));
    }
    ctx.lineTo(right, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    blobs.forEach((b) => {
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.32, 0, TAU);
      ctx.fill();
    });
    ctx.restore();
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
    const top = opts.snow && info.some((m) => m.e > 0.74) ? mixC(color, { h: 220, s: 30, l: 97 }, 0.65) : shade(color, 8);
    const g = ctx.createLinearGradient(0, minY, 0, cam.y0);
    g.addColorStop(0, col(mixC(top, haze, opts.haze * 0.6)));
    g.addColorStop(1, col(mixC(color, haze, opts.haze)));
    paint(ctx, build, g, { glaze: col(color, -16, 0), glazeAlpha: 0.25, edge: 8 * U });
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
    }, `rgba(27, 16, 51, ${opts.inkAlpha})`, opts.ink * U);
    if (opts.trees) {
      const treeColor = mixC(shade(color, -10), haze, opts.haze * 0.7);
      for (let i = 1; i < ys.length - 1; i += 2) {
        const y = ys[i];
        if (y > cam.y0 - 2 || info[i].e > 0.6 || info[i].m < 0.42 || rng() < 0.35) continue;
        const x = xs[i] + (rng() - 0.5) * (cam.W / COLUMNS);
        const size = opts.trees * U * (0.7 + rng() * 0.6);
        if (rng() < 0.5) {
          stroke(ctx, () => {
            ctx.moveTo(x, y + size * 0.3);
            ctx.lineTo(x, y - size);
          }, `rgba(27, 16, 51, ${opts.inkAlpha})`, Math.max(1, U));
          paint(ctx, () => ctx.arc(x, y - size, size * 0.55, 0, TAU), col(treeColor), { ink: opts.ink * U * 0.8 });
        } else {
          paint(ctx, () => {
            ctx.moveTo(x - size * 0.5, y + 1);
            ctx.lineTo(x, y - size * 1.5);
            ctx.lineTo(x + size * 0.5, y + 1);
            ctx.closePath();
          }, col(treeColor), { ink: opts.ink * U * 0.8 });
        }
      }
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

  function drawGround(ctx, cam, hz, pal, rng, U) {
    const tops = hz.waterY.map((y) => (y ? Math.min(cam.H, Math.max(y, cam.y0)) : cam.y0));
    const xs = tops.map((_, i) => (i / COLUMNS) * cam.W);
    const build = () => {
      ctx.moveTo(0, cam.H);
      for (let i = 0; i < xs.length; i++) ctx.lineTo(xs[i], tops[i]);
      ctx.lineTo(cam.W, cam.H);
      ctx.closePath();
    };
    const g = ctx.createLinearGradient(0, cam.y0, 0, cam.H);
    g.addColorStop(0, col(pal.groundFar, 6));
    g.addColorStop(0.18, col(mixC(pal.groundFar, pal.ground, 0.7)));
    g.addColorStop(1, col(pal.ground, -6));
    paint(ctx, build, g);
    ctx.save();
    ctx.beginPath();
    build();
    ctx.clip();
    for (let i = 0; i < 22; i++) {
      const y = cam.y0 + Math.pow(rng(), 0.7) * (cam.H - cam.y0);
      const x = rng() * cam.W;
      const r = (40 + rng() * 160) * U * ((y - cam.y0) / (cam.H - cam.y0) + 0.25);
      const tint = [pal.plantA, pal.plantB, shade(pal.ground, 10), shade(pal.ground, -12)][i % 4];
      const bloom = ctx.createRadialGradient(x, y, 0, x, y, r);
      bloom.addColorStop(0, col(tint, 0, 0, 0.3));
      bloom.addColorStop(1, col(tint, 0, 0, 0));
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.6, r * 0.5, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    stroke(ctx, () => {
      ctx.moveTo(0, tops[0]);
      for (let i = 1; i < xs.length; i++) ctx.lineTo(xs[i], tops[i]);
    }, "rgba(27, 16, 51, 0.45)", 1.1 * U);
  }

  function drawHatching(ctx, cam, road, halfW, pal, rng, U, count) {
    ctx.lineCap = "round";
    for (let i = 0; i < count; i++) {
      const z = 2.6 + Math.pow(rng(), 2.2) * 90;
      const spread = (z * cam.W) / cam.f;
      const x = cam.lane + (rng() - 0.5) * spread * 1.1;
      if (Math.abs(x - road.x(z)) < halfW + 0.3) continue;
      const p = cam.p(x, z, 0);
      const len = Math.max(1.5 * U, p.s * 0.18);
      ctx.strokeStyle = col(rng() < 0.5 ? pal.plantA : shade(pal.ground, -18), 0, 0, 0.55);
      ctx.lineWidth = Math.max(0.6 * U, p.s * 0.025);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - len * 0.2, p.y - len);
      ctx.moveTo(p.x + len * 0.3, p.y);
      ctx.lineTo(p.x + len * 0.5, p.y - len * 0.8);
      ctx.stroke();
    }
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

  function drawRoad(ctx, cam, road, halfW, kind, roadCls, profile, pal, rng, U, zMax) {
    const zs = roadSamples(cam, zMax);
    const wobL = zs.map(() => (rng() - 0.5) * 0.25);
    const wobR = zs.map(() => (rng() - 0.5) * 0.25);
    const city = kind === "city";
    const build = () => {
      zs.forEach((z, i) => {
        const p = cam.p(road.x(z) - halfW + (city ? 0 : wobL[i]), z, 0);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      for (let i = zs.length - 1; i >= 0; i--) {
        const p = cam.p(road.x(zs[i]) + halfW + (city ? 0 : wobR[i]), zs[i], 0);
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
      for (let i = 0; i < 5; i++) {
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
      [-1, 1].forEach((side) => {
        const curb = { h: 240, s: 10, l: 86 };
        paint(ctx, () => strip(ctx, cam, road, zs, side * halfW, side * (halfW + 0.22), 0.15), col(curb), { ink: 1.1 * U });
        stroke(ctx, () => edgeLine(ctx, cam, road, zs, side * halfW), INK, 1.8 * U);
      });
      ctx.fillStyle = col(profile.pathLineColor, 10);
      for (let z = 3; z < zMax * 0.6; z += 6) {
        ctx.beginPath();
        strip(ctx, cam, road, [z, z + 1.5, z + 3], -0.08, 0.08);
        ctx.fill();
      }
      if (rng() < 0.5) {
        const z0 = 7 + rng() * 6;
        ctx.fillStyle = "rgba(255, 250, 245, 0.85)";
        for (let k = -halfW + 0.4; k < halfW - 0.4; k += 0.9) {
          ctx.beginPath();
          const a = cam.p(road.x(z0) + k, z0, 0);
          const b = cam.p(road.x(z0) + k + 0.45, z0, 0);
          const c = cam.p(road.x(z0 + 2.4) + k + 0.45, z0 + 2.4, 0);
          const d = cam.p(road.x(z0 + 2.4) + k, z0 + 2.4, 0);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.lineTo(c.x, c.y);
          ctx.lineTo(d.x, d.y);
          ctx.closePath();
          ctx.fill();
        }
      }
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
      for (let i = 0; i < 3; i++) {
        const z = 4 + rng() * 22;
        const x = road.x(z) + (rng() < 0.5 ? -0.45 : 0.45) * halfW;
        const p = cam.p(x, z, 0);
        const rx = p.s * (0.4 + rng() * 0.5);
        const ry = rx * (cam.ch / z);
        paint(ctx, () => ctx.ellipse(p.x, p.y, rx, ry, 0, 0, TAU), col(mixC(pal.sky1, { h: 200, s: 60, l: 80 }, 0.4)), { ink: inkW(p.s, U) * 0.7 });
        paint(ctx, () => ctx.ellipse(p.x - rx * 0.25, p.y - ry * 0.2, rx * 0.35, ry * 0.25, 0, 0, TAU), "rgba(255,255,255,0.6)");
      }
      for (let i = 0; i < 40; i++) {
        const z = 2.6 + Math.pow(rng(), 2) * 30;
        const x = road.x(z) + (rng() - 0.5) * halfW * 1.9;
        const p = cam.p(x, z, 0);
        const r = Math.max(0.6 * U, p.s * (0.04 + rng() * 0.05));
        paint(ctx, () => ctx.ellipse(p.x, p.y, r * 1.3, r, 0, 0, TAU), col(dirt, -18 + rng() * 30), { ink: Math.max(0.5, U * 0.6) });
      }
      for (let i = 0; i < 26; i++) {
        const z = 2.6 + Math.pow(rng(), 1.6) * 24;
        const side = rng() < 0.5 ? -1 : 1;
        const p = cam.p(road.x(z) + side * (halfW - 0.15 - rng() * 0.3), z, 0);
        const r = Math.max(0.8 * U, p.s * (0.07 + rng() * 0.06));
        paint(ctx, () => ctx.ellipse(p.x, p.y, r * 1.4, r, 0, 0, TAU), col(pal.rock || dirt, 6 + rng() * 14, -10), { ink: Math.max(0.6, U * 0.8) });
        paint(ctx, () => ctx.ellipse(p.x - r * 0.4, p.y - r * 0.35, r * 0.45, r * 0.25, 0, 0, TAU), "rgba(255,255,255,0.55)");
      }
      stroke(ctx, () => edgeLine(ctx, cam, road, zs, -halfW, wobL), INK, 1.6 * U);
      stroke(ctx, () => edgeLine(ctx, cam, road, zs, halfW, wobR), INK, 1.6 * U);
      const blade = col(pal.plantA, -4);
      [-1, 1].forEach((side) => {
        const wob = side < 0 ? wobL : wobR;
        ctx.fillStyle = blade;
        ctx.strokeStyle = INK;
        ctx.lineWidth = Math.max(0.6, 0.8 * U);
        ctx.beginPath();
        for (let i = 0; i < zs.length && zs[i] < 34; i++) {
          if (i % 2) continue;
          const z = zs[i];
          const p = cam.p(road.x(z) + side * halfW + wob[i], z, 0);
          const h = p.s * (0.16 + ((i * 7) % 5) * 0.03);
          const w = p.s * 0.08;
          ctx.moveTo(p.x - w, p.y + h * 0.1);
          ctx.lineTo(p.x - side * w * 0.6, p.y - h);
          ctx.lineTo(p.x + w * 0.2, p.y + h * 0.05);
          ctx.lineTo(p.x - side * w * 1.6, p.y - h * 0.7);
          ctx.lineTo(p.x + w, p.y + h * 0.1);
          ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();
      });
    }
    drawPathStyle(ctx, cam, road, halfW, profile, zs, U, zMax);
    if (!city) {
      for (let i = 0; i < 46; i++) {
        const z = 2.6 + Math.pow(rng(), 1.8) * 40;
        const side = rng() < 0.5 ? -1 : 1;
        const p = cam.p(road.x(z) + side * (halfW + (rng() - 0.3) * 0.5), z, 0);
        P.tuft(ctx, p.x, p.y, p.s, 0.35 + rng() * 0.3, pal.plantA, rng, U);
      }
    }
  }

  function drawPathStyle(ctx, cam, road, halfW, profile, zs, U, zMax) {
    const style = profile.pathStyle;
    const c = profile.pathLineColor;
    if (style === "plates") {
      ctx.strokeStyle = "rgba(27, 16, 51, 0.4)";
      ctx.lineWidth = 1 * U;
      ctx.beginPath();
      for (let z = zs[0]; z < Math.min(80, zMax); z += 2.4) {
        const a = cam.p(road.x(z) - halfW, z, 0);
        const b = cam.p(road.x(z) + halfW, z, 0);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
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
    if (profile.alienMix === "mixed") return rng() < 0.5 ? "pink" : "blue";
    return profile.alienMix;
  }

  function addAlien(queue, cam, road, halfW, profile, rng, U, z, x) {
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
  }

  function addPlant(queue, cam, profile, pal, biome, rng, U, z, x, shown, allowMeta) {
    const meta = shown.vegetation && allowMeta && rng() < 0.45;
    const r = rng();
    queue.push({
      z,
      draw: (ctx) => {
        const p = cam.p(x, z, 0);
        if (p.x < -p.s * 8 || p.x > cam.W + p.s * 8) return;
        const vc = shade(profile.vegetationColor, (rng() - 0.5) * 10);
        if (meta) {
          const kind = profile.vegetation;
          if (kind === "mushroom") P.mushroom(ctx, p.x, p.y, p.s, 2.4 + rng() * 4.5, vc, rng, U);
          else if (kind === "palm") P.palm(ctx, p.x, p.y, p.s, 6 + rng() * 5, vc, pal.trunk, rng, U);
          else if (kind === "tentacle") P.tentacle(ctx, p.x, p.y, p.s, 3 + rng() * 4, vc, rng, U);
          else if (kind === "eyestalk") P.eyestalk(ctx, p.x, p.y, p.s, 1.6 + rng() * 2, vc, rng, U);
          else if (kind === "bulb") P.bulb(ctx, p.x, p.y, p.s, 2 + rng() * 2.5, vc, rng, U);
          else if (kind === "spiralfern") P.spiralFern(ctx, p.x, p.y, p.s, 1.6 + rng() * 1.8, vc, rng, U);
          else if (kind === "balloon") P.balloonPod(ctx, p.x, p.y, p.s, 3 + rng() * 3.5, vc, rng, U);
          else P.crystal(ctx, p.x, p.y, p.s, 1.4 + rng() * 2.6, vc, rng, U);
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
          if (t < 0.62) P.tree(ctx, p.x, p.y, p.s, 4.5 + rng() * 5, plant, pal.trunk, rng, U);
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

  function addPoles(queue, cam, road, halfW, profile, rng, U, side, offset) {
    const anchors = [];
    const zs = [];
    for (let z = 5 + rng() * 6; z < 220; z += 26) zs.push(z);
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

  function addCommon(queue, cam, road, halfW, profile, pal, rng, U, shown, kind) {
    if (shown.pole) addPoles(queue, cam, road, halfW, profile, rng, U, rng() < 0.5 ? -1 : 1, kind === "city" ? 0.5 : 1.4);
    if (shown.sign) {
      const z = 7 + rng() * 9;
      const x = road.x(z) + (rng() < 0.5 ? -1 : 1) * (halfW + (kind === "city" ? 0.6 : 0.9));
      queue.push({ z, draw: (ctx) => P.sign(ctx, cam, x, z, profile, U) });
    }
    if (shown.fence && kind !== "city") {
      const side = rng() < 0.5 ? -1 : 1;
      for (let z = 3.2; z < 46; z += 7) {
        const z0 = z;
        queue.push({ z: z0 + 3.5, draw: (ctx) => P.fencePiece(ctx, cam, road.x(z0) + side * (halfW + 0.7), z0, z0 + 7, profile, U) });
      }
    }
    if (shown.banner) {
      const z = 13 + rng() * 10;
      const h = kind === "city" ? 7 : 4.6;
      const xl = road.x(z) - halfW - 0.6;
      const xr = road.x(z) + halfW + 0.6;
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

  function addOddities(queue, cam, road, halfW, profile, pal, biome, rng, U, shown, kind) {
    const side = () => (rng() < 0.5 ? -1 : 1);
    const at = (z, x, y, draw) => queue.push({ z, draw: (ctx) => {
      const p = cam.p(x, z, y || 0);
      if (p.x < -p.s * 12 || p.x > cam.W + p.s * 12) return;
      draw(ctx, p);
    } });
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

  function populateWild(queue, cam, road, halfW, profile, pal, biome, rng, U, shown) {
    addOddities(queue, cam, road, halfW, profile, pal, biome, rng, U, shown, "wild");
    const density = { jungle: 46, meadow: 26, beach: 18, dry: 10, highland: 16, rock: 10, snow: 8, sea: 14, lake: 14 }[biome] || 20;
    for (let i = 0; i < density; i++) {
      const z = 3.2 + Math.pow(rng(), 1.5) * 90;
      const side = rng() < 0.5 ? -1 : 1;
      const x = road.x(z) + side * (halfW + 0.9 + Math.pow(rng(), 1.4) * 16);
      addPlant(queue, cam, profile, pal, biome, rng, U, z, x, shown, true);
    }
    for (let i = 0; i < density * 0.8; i++) {
      const z = 70 + rng() * 220;
      const side = rng() < 0.5 ? -1 : 1;
      const x = road.x(z) + side * (halfW + 2 + rng() * 60);
      addPlant(queue, cam, profile, pal, biome, rng, U, z, x, shown, false);
    }
    if (shown.building) {
      const z = 10 + rng() * 14;
      const side = rng() < 0.5 ? -1 : 1;
      addShack(queue, cam, road, halfW, profile, rng, U, z, side, true);
    }
    if (shown.aliens) {
      const n = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const z = 4.5 + rng() * 16;
        const x = road.x(z) + (rng() - 0.5) * (halfW * 2 + 3);
        addAlien(queue, cam, road, halfW, profile, rng, U, z, x);
      }
    } else if (rng() < 0.4) {
      const z = 40 + rng() * 30;
      addAlien(queue, cam, road, halfW, profile, rng, U, z, road.x(z) + (rng() - 0.5) * halfW * 3);
    }
    if (rng() < 0.15) addCar(queue, cam, road, halfW, profile, rng, U, 20 + rng() * 40);
    if (rng() < 0.25) {
      const z = 6 + rng() * 10;
      const x = road.x(z) + (rng() < 0.5 ? -1 : 1) * (halfW + 1.2);
      queue.push({ z, draw: (ctx) => {
        const p = cam.p(x, z, 0);
        P.bench(ctx, p.x, p.y, p.s, { h: rng() * 360, s: 50, l: 62 }, U);
      } });
    }
  }

  function addShack(queue, cam, road, halfW, profile, rng, U, z, side, shownBuilding) {
    const width = 4 + rng() * 2.2;
    const depth = 3.5 + rng() * 1.8;
    const off = 1.4 + rng() * 2.4;
    const xa = road.x(z) + side * (halfW + off);
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

  function addCar(queue, cam, road, halfW, profile, rng, U, z) {
    const lane = profile.drivingSide === "left" ? -1 : 1;
    const x = road.x(z) + lane * halfW * 0.48;
    const color = { h: rng() * 360, s: 70, l: 64 };
    queue.push({ z, draw: (ctx) => {
      const p = cam.p(x, z, 0);
      P.hoverCar(ctx, p.x, p.y, p.s, color, U, rng);
    } });
  }

  function populateVillage(queue, cam, road, halfW, profile, pal, biome, rng, U, shown) {
    addOddities(queue, cam, road, halfW, profile, pal, biome, rng, U, shown, "village");
    let z = 6 + rng() * 5;
    const count = 2 + Math.floor(rng() * 4);
    for (let i = 0; i < count; i++) {
      addShack(queue, cam, road, halfW, profile, rng, U, z, i % 2 ? 1 : -1, shown.building);
      z += 5 + rng() * 9;
    }
    for (let i = 0; i < 26; i++) {
      const pz = 3.2 + Math.pow(rng(), 1.3) * 80;
      const side = rng() < 0.5 ? -1 : 1;
      addPlant(queue, cam, profile, pal, biome, rng, U, pz, road.x(pz) + side * (halfW + 1 + rng() * 14), shown, true);
    }
    for (let i = 0; i < 18; i++) {
      const pz = 60 + rng() * 200;
      addPlant(queue, cam, profile, pal, biome, rng, U, pz, road.x(pz) + (rng() < 0.5 ? -1 : 1) * (halfW + 3 + rng() * 50), shown, false);
    }
    if (rng() < 0.45) {
      const sz = 5 + rng() * 6;
      const sx = road.x(sz) + (rng() < 0.5 ? -1 : 1) * (halfW + 1.6);
      const color = { h: rng() * 360, s: 75, l: 62 };
      queue.push({ z: sz, draw: (ctx) => {
        const p = cam.p(sx, sz, 0);
        P.stall(ctx, p.x, p.y, p.s, color, U, rng);
      } });
    }
    const near = shown.aliens;
    const n = near ? 2 + Math.floor(rng() * 4) : 1 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const az = near ? 4 + rng() * 18 : 26 + rng() * 34;
      addAlien(queue, cam, road, halfW, profile, rng, U, az, road.x(az) + (rng() - 0.5) * (halfW * 2 + 4));
    }
    if (rng() < 0.3) addCar(queue, cam, road, halfW, profile, rng, U, 14 + rng() * 30);
  }

  function populateCity(queue, cam, road, halfW, profile, pal, rng, U, shown) {
    [-1, 1].forEach((side) => {
      let z = 3 + rng() * 3;
      while (z < 240) {
        const depth = 8 + rng() * 8;
        const z0 = z;
        const spec = {
          xa: road.x(z0) + side * (halfW + 3.2),
          side,
          z0,
          width: 10 + rng() * 6,
          depth,
          height: 9 + rng() * 22 + (z0 > 80 ? rng() * 14 : 0),
          wall: wallPalette(profile, rng, shown.building),
          roof: shown.building ? profile.roofColor : { h: 260, s: 12, l: 50 },
          roofShape: shown.building ? profile.roofShape : null,
          windowStyle: shown.building ? profile.windowStyle : "plain",
          awning: { h: rng() * 360, s: 75, l: 62 },
          balconies: rng() < 0.45,
          pipe: rng() < 0.5,
          neon: rng() < 0.55 ? { h: [320, 190, 50, 280][Math.floor(rng() * 4)], s: 95, l: 62 } : null,
          glyphs: glyphRun(rng, 3),
          rand: rng,
        };
        queue.push({ z: z0 + depth, draw: (ctx) => P.building(ctx, cam, spec, U) });
        if (rng() < 0.35 && z0 < 70) {
          const cz = z0 + depth * 0.5;
          const other = road.x(cz) - side * (halfW + 3.2);
          const mine = road.x(cz) + side * (halfW + 3.2);
          const h1 = 6 + rng() * 3;
          const h2 = 6 + rng() * 3;
          queue.push({ z: cz - 0.05, draw: (ctx) => {
            const a = cam.p(mine, cz, h1);
            const b = cam.p(other, cz, h2);
            stroke(ctx, () => {
              ctx.moveTo(a.x, a.y);
              ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + a.s * 1.2, b.x, b.y);
            }, INK, Math.max(0.8, U));
          } });
        }
        z += depth + (rng() < 0.25 ? 1.5 + rng() * 2 : 0);
      }
    });
    for (let i = 0; i < 3; i++) {
      const tz = 5 + rng() * 30;
      const side = rng() < 0.5 ? -1 : 1;
      const tx = road.x(tz) + side * (halfW + 0.9);
      if (shown.vegetation) addPlant(queue, cam, profile, pal, "meadow", rng, U, tz, tx, { vegetation: true }, true);
      else {
        const plant = pal.plantA;
        queue.push({ z: tz, draw: (ctx) => {
          const p = cam.p(tx, tz, 0);
          P.tree(ctx, p.x, p.y, p.s, 4 + rng() * 2, plant, pal.trunk, rng, U);
        } });
      }
    }
    if (rng() < 0.6) {
      const cz = 5 + rng() * 8;
      const side = rng() < 0.5 ? -1 : 1;
      const cx = road.x(cz) + side * (halfW + 1.8);
      const color = { h: rng() * 360, s: 75, l: 64 };
      queue.push({ z: cz, draw: (ctx) => {
        const p = cam.p(cx, cz, 0);
        P.cafe(ctx, p.x, p.y, p.s, color, U);
      } });
      if (shown.aliens) {
        addAlien(queue, cam, road, halfW, profile, rng, U, cz - 0.4, cx - 0.9);
        addAlien(queue, cam, road, halfW, profile, rng, U, cz - 0.4, cx + 0.9);
      }
    }
    if (rng() < 0.35) {
      const sz = 8 + rng() * 10;
      const sx = road.x(sz) + (rng() < 0.5 ? -1 : 1) * (halfW + 1.7);
      const color = { h: rng() * 360, s: 75, l: 62 };
      queue.push({ z: sz, draw: (ctx) => {
        const p = cam.p(sx, sz, 0);
        P.stall(ctx, p.x, p.y, p.s, color, U, rng);
      } });
    }
    const near = shown.aliens;
    const n = near ? 4 + Math.floor(rng() * 5) : 2 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
      const az = near ? 4 + rng() * 22 : 30 + rng() * 40;
      const side = rng() < 0.5 ? -1 : 1;
      addAlien(queue, cam, road, halfW, profile, rng, U, az, road.x(az) + side * (halfW + 0.5 + rng() * 2.4));
    }
    const cars = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < cars; i++) addCar(queue, cam, road, halfW, profile, rng, U, 12 + rng() * 60);
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

  function finish(ctx, cam, U) {
    const { W, H } = cam;
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    const grade = ctx.createLinearGradient(0, 0, 0, H);
    grade.addColorStop(0, "rgba(255, 150, 210, 0.35)");
    grade.addColorStop(0.55, "rgba(255, 236, 200, 0.2)");
    grade.addColorStop(1, "rgba(90, 120, 255, 0.3)");
    ctx.fillStyle = grade;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.68;
    ctx.fillStyle = ctx.createPattern(paperTexture(), "repeat");
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    const v = ctx.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, "rgba(40, 10, 60, 0)");
    v.addColorStop(1, "rgba(40, 10, 60, 0.28)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    void U;
  }

  function drawScene(ctx, W, H, opts) {
    const { planet, location: loc, profile, rng } = opts;
    const U = H / 720;
    let biome = G.biomeAt(planet.terrain, loc.x, loc.y);
    if (biome === "sea" || biome === "lake") biome = "beach";
    const place = G.settlementAt(planet, loc.x, loc.y);
    const kind = place.kind;
    const shown = shownFeatures(profile, rng);
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

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    drawSky(ctx, cam, pal, profile, rng, U);
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
    drawHatching(ctx, cam, road, halfW, pal, rng, U, kind === "city" ? 0 : 420);
    if (shown.groundPattern && kind !== "city") drawGroundPattern(ctx, cam, road, halfW, profile, pal, rng, U);
    drawRoad(ctx, cam, road, halfW, kind, roadCls, profile, pal, rng, U, zMax);

    const queue = [];
    if (kind === "city") populateCity(queue, cam, road, halfW, profile, pal, rng, U, shown);
    else if (kind === "village") populateVillage(queue, cam, road, halfW, profile, pal, biome, rng, U, shown);
    else populateWild(queue, cam, road, halfW, profile, pal, biome, rng, U, shown);
    addCommon(queue, cam, road, halfW, profile, pal, rng, U, shown, kind);
    queue.filter((item) => item.z < zMax).sort((a, b) => b.z - a.z).forEach((item) => item.draw(ctx));

    if (kind !== "city") drawForeground(ctx, cam, pal, biome, rng, U);
    if (shown.weather) drawWeather(ctx, cam, profile, pal, rng, U);
    finish(ctx, cam, U);
    ctx.restore();
  }

  G.drawScene = drawScene;
  G.paperTexture = paperTexture;
})(window.AlienGuessr = window.AlienGuessr || {});
