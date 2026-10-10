(function (G) {
  const A = 2048;
  const K = A / 1000;
  const BASE = 512;
  const INK = "#1b1033";
  const TAU = Math.PI * 2;

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function mix(a, b, t) {
    const k = clamp(t, 0, 1);
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  }

  function rgb(c, a) {
    return `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a === undefined ? 1 : a})`;
  }

  function layer() {
    const canvas = document.createElement("canvas");
    canvas.width = A;
    canvas.height = A;
    return canvas;
  }

  const SEA_DEEP = [86, 128, 210];
  const SEA_SHALLOW = [140, 206, 236];
  const SEA_SHORE = [190, 236, 240];
  const LAKE = [120, 192, 232];

  function landColor(e, moist) {
    const wet = mix([178, 224, 128], [112, 198, 128], (moist - 0.45) * 4);
    const ground = mix(wet, [232, 210, 142], (0.42 - moist) * 4.5);
    let c = mix([250, 228, 168], ground, e / 0.045);
    c = mix(c, [200, 204, 134], (e - 0.38) / 0.12);
    c = mix(c, [196, 168, 172], (e - 0.55) / 0.14);
    c = mix(c, [250, 248, 255], (e - 0.8) / 0.05);
    return c;
  }

  // ---------- base wash ----------

  function baseWash(planet, ns) {
    const t = planet.terrain;
    const n = BASE;
    const canvas = document.createElement("canvas");
    canvas.width = n;
    canvas.height = n;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(n, n);
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = n;
    maskCanvas.height = n;
    const mctx = maskCanvas.getContext("2d");
    const mask = mctx.createImageData(n, n);
    const elev = new Float32Array(n * n);
    const wet = new Uint8Array(n * n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const mx = ((x + 0.5) / n) * 1000;
        const my = ((y + 0.5) / n) * 1000;
        const i = y * n + x;
        elev[i] = G.elevationAt(t, mx, my);
        const w = G.waterAt(t, mx, my);
        wet[i] = w === G.WATER.SEA ? 1 : w === G.WATER.LAKE ? 2 : 0;
      }
    }
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        const e = elev[i];
        const mx = ((x + 0.5) / n) * 1000;
        const my = ((y + 0.5) / n) * 1000;
        const blot = G.fbm(x * 0.018, y * 0.018, ns + 41, 3) - 0.5;
        let c;
        if (wet[i]) {
          if (wet[i] === 2) c = LAKE;
          else {
            const depth = clamp(-e, 0, 1);
            const band = Math.min(4, Math.floor((Math.sqrt(depth) * 1.15 + blot * 0.12) * 5)) / 4;
            c = mix(SEA_SHALLOW, SEA_DEEP, band);
            c = mix(SEA_SHORE, c, clamp(depth * 22, 0, 1));
          }
          c = mix(c, [255, 255, 255], blot * 0.35 + 0.02);
        } else {
          c = landColor(e, G.moistureAt(t, mx, my));
          const l = elev[y * n + Math.max(0, x - 1)];
          const r = elev[y * n + Math.min(n - 1, x + 1)];
          const u = elev[Math.max(0, y - 1) * n + x];
          const d = elev[Math.min(n - 1, y + 1) * n + x];
          const shadeK = clamp(1 + ((l - r) + (u - d)) * 9, 0.82, 1.12);
          const tone = 1 + blot * 0.16;
          c = [c[0] * shadeK * tone, c[1] * shadeK * tone, c[2] * shadeK * tone];
          mask.data[i * 4 + 3] = 255;
        }
        img.data[i * 4] = clamp(c[0], 0, 255);
        img.data[i * 4 + 1] = clamp(c[1], 0, 255);
        img.data[i * 4 + 2] = clamp(c[2], 0, 255);
        img.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    mctx.putImageData(mask, 0, 0);
    const land = layer();
    const lc = land.getContext("2d");
    lc.imageSmoothingEnabled = true;
    lc.filter = "blur(3px)";
    lc.drawImage(maskCanvas, 0, 0, A, A);
    lc.filter = "none";
    return { canvas, land };
  }

  // ---------- contours ----------

  function contourPath(t, level, wobble, seed) {
    const n = t.N;
    const e = t.elev;
    const s = A / n;
    const path = new Path2D();
    const lerp = (a, b) => (level - a) / (b - a || 1e-6);
    const amp = wobble || 0;
    const shift = (p) => {
      if (!amp) return p;
      return [
        p[0] + (G.valueNoise(p[0] * 0.03, p[1] * 0.03, seed) - 0.5) * 2 * amp,
        p[1] + (G.valueNoise(p[0] * 0.03 + 50, p[1] * 0.03, seed + 7) - 0.5) * 2 * amp,
      ];
    };
    for (let y = 0; y < n - 1; y++) {
      for (let x = 0; x < n - 1; x++) {
        const a = e[y * n + x];
        const b = e[y * n + x + 1];
        const c = e[(y + 1) * n + x + 1];
        const d = e[(y + 1) * n + x];
        const code = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
        if (code === 0 || code === 15) continue;
        const px = (x + 0.5) * s;
        const py = (y + 0.5) * s;
        const top = [px + lerp(a, b) * s, py];
        const right = [px + s, py + lerp(b, c) * s];
        const bottom = [px + lerp(d, c) * s, py + s];
        const left = [px, py + lerp(a, d) * s];
        const seg = (p0, q0) => {
          const p = shift(p0);
          const q = shift(q0);
          path.moveTo(p[0], p[1]);
          path.lineTo(q[0], q[1]);
        };
        switch (code) {
          case 1: case 14: seg(left, bottom); break;
          case 2: case 13: seg(bottom, right); break;
          case 3: case 12: seg(left, right); break;
          case 4: case 11: seg(top, right); break;
          case 6: case 9: seg(top, bottom); break;
          case 7: case 8: seg(left, top); break;
          case 5: seg(left, top); seg(bottom, right); break;
          case 10: seg(top, right); seg(left, bottom); break;
          default: break;
        }
      }
    }
    return path;
  }

  function strokePath(ctx, path, color, width, dash) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (dash) ctx.setLineDash(dash);
    ctx.stroke(path);
    ctx.restore();
  }

  // ---------- helpers ----------

  function chaikin(points, rounds) {
    let out = points;
    for (let r = 0; r < rounds; r++) {
      if (out.length < 3) return out;
      const next = [out[0]];
      for (let i = 0; i < out.length - 1; i++) {
        const p = out[i];
        const q = out[i + 1];
        next.push({ x: p.x * 0.75 + q.x * 0.25, y: p.y * 0.75 + q.y * 0.25, w: p.w * 0.75 + q.w * 0.25 });
        next.push({ x: p.x * 0.25 + q.x * 0.75, y: p.y * 0.25 + q.y * 0.75, w: p.w * 0.25 + q.w * 0.75 });
      }
      next.push(out[out.length - 1]);
      out = next;
    }
    return out;
  }

  function occupancy() {
    const R = 200;
    const grid = new Uint8Array(R * R);
    const mark = (x, y, radius) => {
      const r = Math.ceil(radius / 5);
      const cx = Math.floor(x / 5);
      const cy = Math.floor(y / 5);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const gx = cx + dx;
          const gy = cy + dy;
          if (gx < 0 || gy < 0 || gx >= R || gy >= R || dx * dx + dy * dy > r * r) continue;
          grid[gy * R + gx] = 1;
        }
      }
    };
    const busy = (x, y) => {
      const gx = clamp(Math.floor(x / 5), 0, R - 1);
      const gy = clamp(Math.floor(y / 5), 0, R - 1);
      return grid[gy * R + gx] === 1;
    };
    return { mark, busy };
  }

  // ---------- icons ----------

  function mountain(ctx, x, y, s, rand, snowy) {
    const peak = { x: x + (rand() - 0.5) * s * 0.2, y: y - s };
    const L = { x: x - s * 0.66, y };
    const R = { x: x + s * 0.66, y };
    const mid = { x: x + s * 0.06 + (rand() - 0.5) * s * 0.1, y };
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(L.x, L.y);
    ctx.quadraticCurveTo(x - s * 0.28, y - s * 0.62, peak.x, peak.y);
    ctx.quadraticCurveTo(x + s * 0.3, y - s * 0.55, R.x, R.y);
    ctx.closePath();
    ctx.fillStyle = "#d9c3d6";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(peak.x, peak.y);
    ctx.quadraticCurveTo(x + s * 0.3, y - s * 0.55, R.x, R.y);
    ctx.lineTo(mid.x, mid.y);
    ctx.quadraticCurveTo(x + s * 0.02, y - s * 0.5, peak.x, peak.y);
    ctx.fillStyle = "#9f86ad";
    ctx.fill();
    if (snowy) {
      ctx.beginPath();
      const cy = peak.y + s * 0.36;
      ctx.moveTo(peak.x - s * 0.24, cy);
      ctx.lineTo(peak.x, peak.y);
      ctx.lineTo(peak.x + s * 0.23, cy - s * 0.02);
      ctx.lineTo(peak.x + s * 0.11, cy - s * 0.08);
      ctx.lineTo(peak.x + s * 0.02, cy + s * 0.02);
      ctx.lineTo(peak.x - s * 0.1, cy - s * 0.08);
      ctx.closePath();
      ctx.fillStyle = "#fbf8ff";
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(L.x, L.y);
    ctx.quadraticCurveTo(x - s * 0.28, y - s * 0.62, peak.x, peak.y);
    ctx.quadraticCurveTo(x + s * 0.3, y - s * 0.55, R.x, R.y);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(peak.x + s * 0.05, peak.y + s * 0.3);
    ctx.lineTo(peak.x + s * 0.12, peak.y + s * 0.5);
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  function googlyFace(ctx, x, y, r, rand, mood) {
    ctx.lineWidth = Math.max(1.4, r * 0.18);
    ctx.strokeStyle = INK;
    [-1, 1].forEach((side) => {
      const ex = x + side * r * 0.9;
      const er = r * (0.62 + rand() * 0.18);
      ctx.beginPath();
      ctx.arc(ex, y, er, 0, TAU);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.stroke();
      const a = rand() * TAU;
      ctx.beginPath();
      ctx.arc(ex + Math.cos(a) * er * 0.4, y + Math.sin(a) * er * 0.4, er * 0.42, 0, TAU);
      ctx.fillStyle = INK;
      ctx.fill();
    });
    ctx.beginPath();
    if (mood === "o") {
      ctx.ellipse(x, y + r * 1.25, r * 0.32, r * 0.42, 0, 0, TAU);
      ctx.fillStyle = "#5a1638";
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.moveTo(x - r * 0.75, y + r * 1.0);
      ctx.quadraticCurveTo(x, y + r * 1.75, x + r * 0.75, y + r * 1.0);
      ctx.stroke();
    }
  }

  function volcano(ctx, x, y, s, rand) {
    const top = y - s;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x - s * 0.78, y);
    ctx.quadraticCurveTo(x - s * 0.36, y - s * 0.5, x - s * 0.2, top);
    ctx.lineTo(x + s * 0.2, top);
    ctx.quadraticCurveTo(x + s * 0.36, y - s * 0.5, x + s * 0.78, y);
    ctx.closePath();
    ctx.fillStyle = "#b48aa8";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - s * 0.2, top);
    ctx.quadraticCurveTo(x - s * 0.24, top + s * 0.3, x - s * 0.12, top + s * 0.42);
    ctx.quadraticCurveTo(x - s * 0.04, top + s * 0.2, x + s * 0.02, top + s * 0.5);
    ctx.quadraticCurveTo(x + s * 0.1, top + s * 0.22, x + s * 0.2, top);
    ctx.closePath();
    ctx.fillStyle = "#ff7a3d";
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, top, s * 0.2, s * 0.06, 0, 0, TAU);
    ctx.fillStyle = "#ffe56b";
    ctx.fill();
    ctx.stroke();
    const puffs = [[0, -0.28, 0.2], [-0.18, -0.48, 0.17], [0.16, -0.58, 0.22], [-0.02, -0.8, 0.26]];
    puffs.forEach(([dx, dy, r]) => {
      ctx.beginPath();
      ctx.arc(x + dx * s, top + dy * s, r * s, 0, TAU);
      ctx.fillStyle = "#f3eaf6";
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.stroke();
    });
    googlyFace(ctx, x - s * 0.02, top - s * 0.84, s * 0.08, rand, "o");
    googlyFace(ctx, x, y - s * 0.32, s * 0.1, rand, "smile");
  }

  function hill(ctx, x, y, s, base) {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.7, y);
    ctx.bezierCurveTo(x - s * 0.5, y - s * 0.58, x + s * 0.45, y - s * 0.6, x + s * 0.7, y);
    ctx.fillStyle = rgb(mix(base, [60, 90, 60], 0.18));
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - s * 0.62, y - s * 0.02);
    ctx.bezierCurveTo(x - s * 0.45, y - s * 0.52, x + s * 0.4, y - s * 0.54, x + s * 0.62, y - s * 0.02);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - s * 0.22, y - s * 0.3);
    ctx.quadraticCurveTo(x - s * 0.05, y - s * 0.38, x + s * 0.1, y - s * 0.33);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  const TREE_TONES = [[96, 188, 150], [72, 166, 128], [130, 206, 120], [236, 128, 188], [120, 150, 236]];

  function lollipop(ctx, x, y, s, rand) {
    const tone = TREE_TONES[rand() < 0.16 ? 3 + Math.floor(rand() * 2) : Math.floor(rand() * 3)];
    ctx.strokeStyle = INK;
    ctx.lineCap = "round";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + s * 0.08, y - s * 0.3, x, y - s * 0.52);
    ctx.stroke();
    const r = s * (0.32 + rand() * 0.08);
    ctx.beginPath();
    ctx.arc(x, y - s * 0.62, r, 0, TAU);
    ctx.fillStyle = rgb(tone);
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - s * 0.62 - r * 0.3, r * 0.3, 0, TAU);
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.fill();
  }

  function palmIcon(ctx, x, y, s, rand) {
    const lean = (rand() - 0.5) * s * 0.4;
    const tx = x + lean;
    const ty = y - s * 0.8;
    ctx.strokeStyle = INK;
    ctx.lineCap = "round";
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.2, y - s * 0.4, tx, ty);
    ctx.stroke();
    ctx.strokeStyle = "#b98a64";
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI + (i / 4) * Math.PI + (rand() - 0.5) * 0.2;
      const ex = tx + Math.cos(a) * s * 0.42;
      const ey = ty + Math.sin(a) * s * 0.26 + s * 0.12;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo((tx + ex) / 2, ty - s * 0.14, ex, ey);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4.4;
      ctx.stroke();
      ctx.strokeStyle = "#5fc28d";
      ctx.lineWidth = 2.4;
      ctx.stroke();
    }
  }

  function cactus(ctx, x, y, s, rand) {
    const h = s * (0.6 + rand() * 0.25);
    const w = s * 0.16;
    const arm = rand() < 0.5 ? 1 : -1;
    ctx.lineCap = "round";
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - h);
      ctx.moveTo(x, y - h * 0.45);
      ctx.lineTo(x + arm * s * 0.22, y - h * 0.45);
      ctx.lineTo(x + arm * s * 0.22, y - h * 0.78);
    };
    body();
    ctx.strokeStyle = INK;
    ctx.lineWidth = w + 4;
    ctx.stroke();
    body();
    ctx.strokeStyle = "#8ccf7c";
    ctx.lineWidth = w;
    ctx.stroke();
  }

  function rockIcon(ctx, x, y, s) {
    ctx.beginPath();
    ctx.ellipse(x, y - s * 0.14, s * 0.3, s * 0.18, 0, 0, TAU);
    ctx.fillStyle = "#c8b7c9";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // ---------- towns ----------

  const WALLS = ["#ffd1e6", "#c9dcff", "#fff1a8", "#c8fbff", "#ffe0c2"];
  const ROOFS = ["#ff4f9a", "#3d7dff", "#8b5cf6", "#ff8a3d", "#22c3a6"];

  function house(ctx, x, y, w, h, wall, roof, kind, face) {
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.rect(x - w / 2, y - h, w, h);
    ctx.fillStyle = wall;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    if (kind === 0) {
      ctx.moveTo(x - w / 2 - 3, y - h);
      ctx.lineTo(x, y - h - w * 0.7);
      ctx.lineTo(x + w / 2 + 3, y - h);
      ctx.closePath();
    } else if (kind === 1) {
      ctx.arc(x, y - h, w / 2 + 1, Math.PI, 0);
      ctx.closePath();
    } else {
      ctx.moveTo(x - w / 2, y - h);
      ctx.lineTo(x, y - h - w * 1.3);
      ctx.lineTo(x + w / 2, y - h);
      ctx.closePath();
    }
    ctx.fillStyle = roof;
    ctx.fill();
    ctx.stroke();
    if (face) {
      const fy = y - h * 0.62;
      const er = Math.min(w * 0.17, 4.2);
      [-1, 1].forEach((side) => {
        ctx.beginPath();
        ctx.arc(x + side * w * 0.22, fy, er, 0, TAU);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + side * w * 0.22 + er * 0.25, fy + er * 0.2, er * 0.5, 0, TAU);
        ctx.fillStyle = INK;
        ctx.fill();
      });
      ctx.beginPath();
      ctx.arc(x, fy + er * 1.6, er * 1.2, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      return;
    }
    ctx.fillStyle = "#ffe56b";
    const rows = Math.max(1, Math.floor(h / 11));
    for (let r = 0; r < rows; r++) {
      ctx.fillRect(x - w * 0.22, y - h + 5 + r * 10, w * 0.44, 4);
    }
  }

  function bunting(ctx, x0, y0, x1, y1, rand) {
    const sag = 9;
    const pt = (k) => ({
      x: x0 + (x1 - x0) * k,
      y: y0 + (y1 - y0) * k + Math.sin(k * Math.PI) * sag,
    });
    ctx.beginPath();
    for (let k = 0; k <= 1.001; k += 0.1) {
      const p = pt(k);
      if (k === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    const flags = ["#ff4f9a", "#3d7dff", "#ffe56b", "#22c3a6"];
    const offset = Math.floor(rand() * flags.length);
    for (let i = 1; i < 8; i++) {
      const p = pt(i / 8);
      ctx.beginPath();
      ctx.moveTo(p.x - 3.4, p.y);
      ctx.lineTo(p.x + 3.4, p.y);
      ctx.lineTo(p.x, p.y + 7);
      ctx.closePath();
      ctx.fillStyle = flags[(i + offset) % flags.length];
      ctx.fill();
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
  }

  function townIcon(ctx, town, rand) {
    const x = town.x * K;
    const y = town.y * K;
    const city = town.kind === "city";
    ctx.beginPath();
    ctx.ellipse(x, y + 4, city ? 46 : 28, city ? 16 : 10, 0, 0, TAU);
    ctx.fillStyle = "rgba(255, 246, 220, 0.85)";
    ctx.fill();
    ctx.strokeStyle = "rgba(27, 16, 51, 0.55)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    const houses = city
      ? [[-24, 14, 30], [-6, 16, 46], [13, 13, 36], [29, 11, 24]]
      : [[-9, 14, 16], [10, 13, 13]];
    houses.forEach(([dx, w, h], i) => {
      const wall = WALLS[Math.floor(rand() * WALLS.length)];
      const roof = ROOFS[Math.floor(rand() * ROOFS.length)];
      const kind = city ? (i === 1 ? 2 : Math.floor(rand() * 2)) : 0;
      house(ctx, x + dx, y + 8, w, h, wall, roof, kind, rand() < (city ? 0.4 : 0.5));
    });
    if (city) {
      bunting(ctx, x - 24, y + 8 - 30, x - 6, y + 8 - 46, rand);
      bunting(ctx, x - 6, y + 8 - 46, x + 13, y + 8 - 36, rand);
    }
    if (city) {
      ctx.beginPath();
      ctx.moveTo(x - 6, y + 8 - 46 - 18);
      ctx.lineTo(x - 6, y + 8 - 46 - 34);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x - 6, y + 8 - 46 - 36, 4, 0, TAU);
      ctx.fillStyle = "#5ff2ff";
      ctx.fill();
      ctx.stroke();
    }
  }

  // ---------- decorations ----------

  function inkFill(ctx, fill, width) {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = width || 2.6;
    ctx.stroke();
  }

  function waterRing(ctx, x, y, rx) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, rx * 0.28, 0, 0, TAU);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 2.6;
    ctx.stroke();
  }

  function tentacle(ctx, x, y, s, rand) {
    const flip = rand() < 0.5 ? -1 : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip, 1);
    waterRing(ctx, 0, 0, s * 0.5);
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, 0);
    ctx.bezierCurveTo(-s * 0.4, -s * 0.9, s * 0.5, -s * 1.1, s * 0.35, -s * 1.6);
    ctx.bezierCurveTo(s * 0.3, -s * 1.9, s * 0.05, -s * 1.85, s * 0.02, -s * 1.65);
    ctx.bezierCurveTo(s * 0.12, -s * 1.5, s * 0.25, -s * 1.2, -s * 0.05, -s * 0.85);
    ctx.bezierCurveTo(-s * 0.2, -s * 0.6, s * 0.1, -s * 0.3, s * 0.25, 0);
    ctx.closePath();
    inkFill(ctx, "#b45cff", 3);
    [[-0.08, -0.35, 0.09], [0.05, -0.7, 0.08], [0.22, -1.05, 0.07], [0.27, -1.38, 0.055]].forEach(([dx, dy, r]) => {
      ctx.beginPath();
      ctx.arc(dx * s, dy * s, r * s, 0, TAU);
      inkFill(ctx, "#ffc2f0", 1.6);
    });
    ctx.restore();
  }

  function rubberDuck(ctx, x, y, s, rand) {
    ctx.save();
    ctx.translate(x, y);
    waterRing(ctx, 0, 0, s * 1.3);
    ctx.beginPath();
    ctx.ellipse(-s * 0.1, -s * 0.3, s * 0.9, s * 0.42, 0, Math.PI * 0.95, Math.PI * 2.05);
    ctx.quadraticCurveTo(s * 0.9, -s * 0.1, s * 0.6, 0);
    ctx.lineTo(-s * 0.85, 0);
    ctx.closePath();
    inkFill(ctx, "#ffe14a", 3);
    ctx.beginPath();
    ctx.arc(s * 0.35, -s * 0.85, s * 0.42, 0, TAU);
    inkFill(ctx, "#ffe14a", 3);
    ctx.beginPath();
    ctx.moveTo(s * 0.7, -s * 0.9);
    ctx.quadraticCurveTo(s * 1.15, -s * 0.85, s * 0.72, -s * 0.66);
    ctx.closePath();
    inkFill(ctx, "#ff8a3d", 2.2);
    googlyFace(ctx, s * 0.36, -s * 0.98, s * 0.12, rand, "smile");
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.38);
    ctx.quadraticCurveTo(-s * 0.2, -s * 0.12, s * 0.05, -s * 0.4);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, -s * 1.2);
    ctx.lineTo(-s * 0.2, -s * 1.75);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, -s * 1.75);
    ctx.lineTo(s * 0.25, -s * 1.62);
    ctx.lineTo(-s * 0.15, -s * 1.48);
    ctx.closePath();
    inkFill(ctx, "#ff4f9a", 1.8);
    ctx.restore();
  }

  function whale(ctx, x, y, s, rand) {
    const flip = rand() < 0.5 ? -1 : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip, 1);
    waterRing(ctx, 0, s * 0.05, s * 1.3);
    ctx.beginPath();
    ctx.moveTo(-s * 1.1, 0);
    ctx.bezierCurveTo(-s * 1.1, -s * 0.9, s * 0.9, -s * 1.0, s * 1.0, -s * 0.1);
    ctx.lineTo(s * 1.0, 0);
    ctx.closePath();
    inkFill(ctx, "#5aa8ff", 3);
    ctx.beginPath();
    ctx.moveTo(-s * 1.0, -s * 0.15);
    ctx.quadraticCurveTo(-s * 1.55, -s * 0.5, -s * 1.6, -s * 0.15);
    ctx.quadraticCurveTo(-s * 1.4, -s * 0.12, -s * 1.5, s * 0.1);
    ctx.quadraticCurveTo(-s * 1.2, -s * 0.05, -s * 1.0, -s * 0.02);
    ctx.closePath();
    inkFill(ctx, "#5aa8ff", 2.6);
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, -s * 0.12);
    ctx.quadraticCurveTo(s * 0.2, -s * 0.02, s * 0.9, -s * 0.12);
    ctx.lineTo(s * 0.98, -s * 0.02);
    ctx.lineTo(-s * 0.6, -s * 0.02);
    ctx.closePath();
    ctx.fillStyle = "#cfe6ff";
    ctx.fill();
    googlyFace(ctx, s * 0.45, -s * 0.42, s * 0.11, rand, "smile");
    ctx.strokeStyle = "#e9f6ff";
    ctx.lineCap = "round";
    ctx.lineWidth = 3.4;
    [-0.5, 0, 0.5].forEach((k) => {
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.78);
      ctx.quadraticCurveTo(k * s * 0.3, -s * 1.35, k * s * 0.75, -s * 1.15);
      ctx.stroke();
    });
    [-0.75, 0, 0.75].forEach((k) => {
      ctx.beginPath();
      ctx.arc(k * s, -s * 1.15 - Math.abs(k) * -s * 0.05, s * 0.08, 0, TAU);
      ctx.fillStyle = "#e9f6ff";
      ctx.fill();
    });
    ctx.restore();
  }

  function bottle(ctx, x, y, s, rand) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.5 + rand() * 0.3);
    waterRing(ctx, 0, s * 0.1, s * 0.9);
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, -s * 0.25);
    ctx.lineTo(s * 0.25, -s * 0.25);
    ctx.quadraticCurveTo(s * 0.45, -s * 0.12, s * 0.55, -s * 0.1);
    ctx.lineTo(s * 0.8, -s * 0.1);
    ctx.lineTo(s * 0.8, s * 0.1);
    ctx.lineTo(s * 0.55, s * 0.1);
    ctx.quadraticCurveTo(s * 0.45, s * 0.12, s * 0.25, s * 0.25);
    ctx.lineTo(-s * 0.7, s * 0.25);
    ctx.closePath();
    inkFill(ctx, "rgba(150, 240, 200, 0.85)", 2.6);
    ctx.beginPath();
    ctx.rect(s * 0.8, -s * 0.12, s * 0.16, s * 0.24);
    inkFill(ctx, "#c98d5a", 2);
    ctx.beginPath();
    ctx.rect(-s * 0.5, -s * 0.13, s * 0.6, s * 0.26);
    inkFill(ctx, "#fff3c4", 1.6);
    ctx.beginPath();
    ctx.moveTo(-s * 0.42, 0);
    ctx.lineTo(0, 0);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  function sailboat(ctx, x, y, s, rand) {
    const sail = rand() < 0.5 ? "#ff4f9a" : "#3d7dff";
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rand() - 0.5) * 0.2);
    waterRing(ctx, 0, s * 0.05, s * 1.0);
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, -s * 0.25);
    ctx.lineTo(s * 0.85, -s * 0.25);
    ctx.quadraticCurveTo(s * 0.6, s * 0.15, 0, s * 0.12);
    ctx.quadraticCurveTo(-s * 0.6, s * 0.15, -s * 0.85, -s * 0.25);
    ctx.closePath();
    inkFill(ctx, "#ffd84a", 2.6);
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.25);
    ctx.lineTo(0, -s * 1.6);
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.06, -s * 1.5);
    ctx.quadraticCurveTo(s * 0.9, -s * 0.9, s * 0.7, -s * 0.4);
    ctx.lineTo(s * 0.06, -s * 0.4);
    ctx.closePath();
    inkFill(ctx, sail, 2.4);
    ctx.beginPath();
    ctx.moveTo(-s * 0.06, -s * 1.2);
    ctx.quadraticCurveTo(-s * 0.6, -s * 0.8, -s * 0.5, -s * 0.4);
    ctx.lineTo(-s * 0.06, -s * 0.4);
    ctx.closePath();
    inkFill(ctx, "#fff", 2.2);
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.6);
    ctx.lineTo(s * 0.35, -s * 1.5);
    ctx.lineTo(0, -s * 1.4);
    inkFill(ctx, "#ffe56b", 1.6);
    ctx.restore();
  }

  function smilingCloud(ctx, x, y, s, rand) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.ellipse(s * 0.1, s * 0.75, s * 1.4, s * 0.22, 0, 0, TAU);
    ctx.fillStyle = "rgba(40, 30, 90, 0.16)";
    ctx.fill();
    const lumps = [[-0.9, 0.05, 0.42], [-0.35, -0.3, 0.55], [0.3, -0.38, 0.6], [0.9, -0.02, 0.45]];
    ctx.beginPath();
    lumps.forEach(([dx, dy, r]) => {
      ctx.moveTo(dx * s + r * s, dy * s);
      ctx.arc(dx * s, dy * s, r * s, 0, TAU);
    });
    ctx.rect(-s * 0.95, -s * 0.05, s * 1.9, s * 0.42);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "#e6dcff";
    ctx.fillRect(-s * 1.5, s * 0.15, s * 3, s * 0.4);
    ctx.restore();
    googlyFace(ctx, 0, -s * 0.1, s * 0.13, rand, "smile");
    ctx.beginPath();
    ctx.ellipse(-s * 0.45, s * 0.08, s * 0.12, s * 0.06, 0, 0, TAU);
    ctx.ellipse(s * 0.45, s * 0.08, s * 0.12, s * 0.06, 0, 0, TAU);
    ctx.fillStyle = "rgba(255, 110, 170, 0.55)";
    ctx.fill();
    ctx.restore();
  }

  function scaleBar(ctx, x, y) {
    const len = 100 * K;
    const seg = len / 4;
    ctx.save();
    ctx.fillStyle = "rgba(255, 248, 230, 0.9)";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(x - 18, y - 52, len + 36, 82, 16);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? "#fff" : "#ff4f9a";
      ctx.fillRect(x + i * seg, y, seg, 12);
    }
    ctx.strokeRect(x, y, len, 12);
    ctx.font = `30px "Luckiest Guy", Fredoka, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = INK;
    ctx.fillText("100 blorps", x + len / 2, y - 12);
    ctx.font = `600 16px Fredoka, sans-serif`;
    ctx.fillText("0", x, y + 28);
    ctx.fillText("100", x + len, y + 28);
    ctx.restore();
  }

  function cartouche(ctx, x, y, seed) {
    const title = `Planet ${seed}`.slice(0, 26);
    ctx.save();
    ctx.font = `46px "Luckiest Guy", Fredoka, sans-serif`;
    const w = Math.max(260, ctx.measureText(title).width + 70);
    const h = 104;
    const left = x - w / 2;
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    [-1, 1].forEach((side) => {
      const ex = side < 0 ? left - 6 : left + w + 6;
      ctx.beginPath();
      ctx.moveTo(ex, y - 18);
      ctx.lineTo(ex + side * 46, y - 26);
      ctx.lineTo(ex + side * 30, y + 6);
      ctx.lineTo(ex + side * 46, y + 34);
      ctx.lineTo(ex, y + 28);
      ctx.closePath();
      ctx.fillStyle = "#3d7dff";
      ctx.fill();
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.roundRect(left, y - h / 2, w, h, 22);
    ctx.fillStyle = "#ff4f9a";
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(left + 8, y - h / 2 + 8, w - 16, h - 16, 16);
    ctx.setLineDash([7, 6]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 8;
    ctx.strokeStyle = INK;
    ctx.strokeText(title, x, y - 8);
    ctx.fillStyle = "#fff";
    ctx.fillText(title, x, y - 8);
    ctx.font = `600 18px Fredoka, sans-serif`;
    ctx.fillStyle = "#fff6c9";
    ctx.fillText("Official Tourist Atlas · not to scale-ish", x, y + 30);
    ctx.restore();
  }

  function seaMonster(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    [[-1.4, 0.55], [-0.5, 0.75], [0.35, 0.6]].forEach(([dx, r]) => {
      ctx.beginPath();
      ctx.arc(dx * s, 0, r * s, Math.PI, 0);
      ctx.fillStyle = "#7be0b0";
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(dx * s, -r * s * 0.9, s * 0.1, 0, TAU);
      ctx.fillStyle = "#ff8fc0";
      ctx.fill();
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(0.9 * s, 0);
    ctx.quadraticCurveTo(1.0 * s, -1.3 * s, 1.55 * s, -1.25 * s);
    ctx.quadraticCurveTo(2.0 * s, -1.1 * s, 1.75 * s, -0.75 * s);
    ctx.quadraticCurveTo(1.35 * s, -0.7 * s, 1.35 * s, 0);
    ctx.closePath();
    ctx.fillStyle = "#7be0b0";
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(1.58 * s, -1.05 * s, s * 0.14, 0, TAU);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(1.62 * s, -1.03 * s, s * 0.06, 0, TAU);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      ctx.moveTo((i * 0.8 - 0.3) * s, s * 0.14);
      ctx.quadraticCurveTo((i * 0.8 + 0.05) * s, s * 0.32, (i * 0.8 + 0.4) * s, s * 0.14);
    }
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.font = `600 ${Math.round(s * 0.42)}px Fredoka, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(27, 16, 51, 0.7)";
    ctx.fillText("here be blorbs", 0.1 * s, s * 0.9);
    ctx.restore();
  }

  function ufo(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.18);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, s * 0.2);
    ctx.lineTo(-s * 0.9, s * 1.3);
    ctx.lineTo(s * 0.9, s * 1.3);
    ctx.lineTo(s * 0.55, s * 0.2);
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 229, 107, 0.35)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -s * 0.12, s * 0.42, Math.PI, 0);
    ctx.fillStyle = "#c8fbff";
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.3, 0, 0, TAU);
    ctx.fillStyle = "#b892ff";
    ctx.fill();
    ctx.stroke();
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(i * s * 0.36, s * 0.04, s * 0.07, 0, TAU);
      ctx.fillStyle = i % 2 ? "#ff4f9a" : "#ffe56b";
      ctx.fill();
    }
    ctx.restore();
  }

  function waveMark(ctx, x, y, s) {
    const cx = x + s * 0.15;
    const cy = y - s * 0.5;
    ctx.beginPath();
    ctx.moveTo(x - s * 1.2, y);
    ctx.bezierCurveTo(x - s * 0.7, y, x - s * 0.5, cy - s * 0.5, cx, cy - s * 0.42);
    for (let k = 0; k <= 16; k++) {
      const a = -Math.PI / 2 + (k / 16) * Math.PI * 1.6;
      const r = s * 0.42 * (1 - k / 26);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.moveTo(cx + s * 0.38, cy + s * 0.1);
    ctx.quadraticCurveTo(x + s * 0.7, y, x + s * 1.2, y);
    ctx.stroke();
  }

  // ---------- build ----------

  function waterShare(t, cx, cy, r) {
    let wet = 0;
    let total = 0;
    for (let y = cy - r; y <= cy + r; y += r / 4) {
      for (let x = cx - r; x <= cx + r; x += r / 4) {
        total += 1;
        if (!G.isDryLand(t, clamp(x, 0, 999), clamp(y, 0, 999))) wet += 1;
      }
    }
    return wet / total;
  }

  function buildAtlas(planet) {
    if (planet.atlas) return planet.atlas;
    const started = performance.now();
    const t = planet.terrain;
    const ns = G.hashSeed(`${planet.seed}|atlas`) || 1;
    const rand = G.mulberry32(ns);
    const canvas = layer();
    const ctx = canvas.getContext("2d");
    const wash = baseWash(planet, ns);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(wash.canvas, 0, 0, A, A);

    const coast = contourPath(t, 0, 3.2, ns + 3);

    const fx = layer();
    const fc = fx.getContext("2d");
    for (let i = 0; i < 70; i++) {
      const x = rand() * A;
      const y = rand() * A;
      const r = 60 + rand() * 180;
      const g = fc.createRadialGradient(x, y, 0, x, y, r);
      const tone = rand() < 0.5 ? "rgba(255, 250, 230, 0.16)" : "rgba(120, 90, 140, 0.08)";
      g.addColorStop(0, tone);
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      fc.fillStyle = g;
      fc.fillRect(x - r, y - r, r * 2, r * 2);
    }
    fc.filter = "blur(6px)";
    strokePath(fc, coast, "rgba(110, 80, 40, 0.22)", 18);
    fc.filter = "none";
    fc.globalCompositeOperation = "destination-in";
    fc.drawImage(wash.land, 0, 0);
    ctx.drawImage(fx, 0, 0);

    const sx = layer();
    const sc = sx.getContext("2d");
    sc.filter = "blur(8px)";
    strokePath(sc, coast, "rgba(255, 255, 255, 0.5)", 30);
    sc.filter = "none";
    sc.globalCompositeOperation = "destination-out";
    sc.drawImage(wash.land, 0, 0);
    ctx.drawImage(sx, 0, 0);

    [[-0.03, 0.55, 2.6], [-0.07, 0.38, 2.1], [-0.12, 0.24, 1.7]].forEach(([level, alpha, width], i) => {
      strokePath(ctx, contourPath(t, level, 5, ns + 20 + i), `rgba(40, 70, 150, ${alpha})`, width);
    });
    [0.3, 0.5, 0.68].forEach((level) => {
      strokePath(ctx, contourPath(t, level), "rgba(110, 70, 90, 0.2)", 1.6);
    });

    const used = occupancy();
    planet.roads.forEach((road) => {
      road.points.forEach((p, i) => {
        if (i % 2 === 0) used.mark(p.x, p.y, 7);
      });
    });
    planet.towns.forEach((town) => used.mark(town.x, town.y, town.kind === "city" ? 34 : 22));
    t.rivers.forEach((river) => river.forEach((p) => used.mark(p.x, p.y, 4)));

    const corners = [
      { x: 120, y: 105 }, { x: 880, y: 105 }, { x: 880, y: 895 },
    ].map((c) => {
      const crowd = planet.towns.filter((town) => Math.abs(town.x - c.x) < 170 && Math.abs(town.y - c.y) < 110).length;
      return { ...c, wet: waterShare(t, c.x, c.y, 90) - crowd * 0.35 };
    });
    const ranked = corners.slice().sort((a, b) => b.wet - a.wet);
    const titleSpot = ranked.find((c) => c.y < 500) || ranked[0];
    const rest = ranked.filter((c) => c !== titleSpot);
    const scaleSpot = rest[0];
    used.mark(titleSpot.x, titleSpot.y, 90);
    used.mark(scaleSpot.x, scaleSpot.y, 70);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    for (let gy = 20; gy < 1000; gy += 46) {
      for (let gx = 20; gx < 1000; gx += 46) {
        const x = gx + (rand() - 0.5) * 30;
        const y = gy + (rand() - 0.5) * 30;
        if (rand() < 0.45 || G.elevationAt(t, x, y) > -0.09 || used.busy(x, y)) continue;
        const s = 9 + rand() * 6;
        ctx.strokeStyle = "rgba(27, 16, 51, 0.35)";
        ctx.lineWidth = 5;
        waveMark(ctx, x * K, y * K, s);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = 2.6;
        waveMark(ctx, x * K, y * K, s);
      }
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.strokeStyle = "rgba(40, 70, 150, 0.45)";
    ctx.lineWidth = 1.2;
    for (let gy = 3; gy < 1000; gy += 7) {
      for (let gx = 3; gx < 1000; gx += 7) {
        const x = gx + (rand() - 0.5) * 5;
        const y = gy + (rand() - 0.5) * 5;
        const e = G.elevationAt(t, x, y);
        if (e > -0.008 || e < -0.05 || rand() < 0.5) continue;
        ctx.beginPath();
        ctx.arc(x * K, y * K, 2.2 + rand() * 3 * (1 + e * 16), 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    }

    strokePath(ctx, coast, INK, 4.4);
    strokePath(ctx, contourPath(t, 0, 4.5, ns + 11), "rgba(27, 16, 51, 0.55)", 1.8);

    const rivers = t.rivers.map((river) => chaikin(river, 2));
    [[INK, 3.4], ["#78bdf0", 0]].forEach(([color, extra]) => {
      ctx.strokeStyle = color;
      ctx.lineCap = "round";
      rivers.forEach((river) => {
        for (let i = 1; i < river.length; i++) {
          ctx.lineWidth = 1.6 + river[i].w * 6.5 + extra;
          ctx.beginPath();
          ctx.moveTo(river[i - 1].x * K, river[i - 1].y * K);
          ctx.lineTo(river[i].x * K, river[i].y * K);
          ctx.stroke();
        }
      });
    });

    const political = politicalGrid(planet);
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.filter = "blur(2px)";
    ctx.drawImage(political.tint, 0, 0, A, A);
    ctx.restore();

    const borders = layer();
    const bc = borders.getContext("2d");
    const provinceLayer = layer();
    const pc = provinceLayer.getContext("2d");
    const seam = (c, polygon) => {
      c.beginPath();
      polygon.forEach((p, i) => {
        if (i === 0) c.moveTo(p.x * K, p.y * K);
        else c.lineTo(p.x * K, p.y * K);
      });
      c.closePath();
    };
    const scratch = layer();
    const sc2 = scratch.getContext("2d");
    planet.continents.forEach((continent) => {
      const mask = political.continentMask(continent.id);
      const countries = continent.countryIds.map((id) => planet.countries[id]);
      [[bc, () => {
        sc2.lineCap = "round";
        sc2.lineJoin = "round";
        countries.forEach((country) => {
          seam(sc2, country.polygon);
          sc2.strokeStyle = "rgba(255, 250, 235, 0.6)";
          sc2.lineWidth = 12;
          sc2.stroke();
        });
        sc2.setLineDash([16, 6, 4, 6]);
        countries.forEach((country) => {
          seam(sc2, country.polygon);
          sc2.strokeStyle = "rgba(120, 28, 92, 0.9)";
          sc2.lineWidth = 4.2;
          sc2.stroke();
        });
        sc2.setLineDash([]);
      }], [pc, () => {
        sc2.lineCap = "round";
        sc2.setLineDash([0.1, 9]);
        countries.forEach((country) => {
          if (country.provinceIds.length < 2) return;
          country.provinceIds.forEach((id) => {
            seam(sc2, planet.regions[id].polygon);
            sc2.strokeStyle = "rgba(120, 28, 92, 0.75)";
            sc2.lineWidth = 3.2;
            sc2.stroke();
          });
        });
        sc2.setLineDash([]);
      }]].forEach(([target, paintLines]) => {
        sc2.clearRect(0, 0, A, A);
        sc2.globalCompositeOperation = "source-over";
        paintLines();
        sc2.globalCompositeOperation = "destination-in";
        sc2.filter = "blur(2.5px)";
        sc2.drawImage(mask, 0, 0, A, A);
        sc2.filter = "none";
        sc2.globalCompositeOperation = "source-over";
        target.drawImage(scratch, 0, 0);
      });
    });
    ctx.drawImage(borders, 0, 0);

    const icons = [];
    for (let gy = 7; gy < 1000; gy += 14) {
      for (let gx = 7; gx < 1000; gx += 14) {
        const x = gx + (rand() - 0.5) * 11;
        const y = gy + (rand() - 0.5) * 11;
        const roll = rand();
        const size = rand();
        if (!G.isDryLand(t, x, y) || G.waterAt(t, x, y) === G.WATER.RIVER || used.busy(x, y)) continue;
        const e = G.elevationAt(t, x, y);
        const m = G.moistureAt(t, x, y);
        if (e > 0.52) {
          if (roll < 0.85) icons.push({ x, y, e, type: "mountain", s: 34 + (e - 0.52) * 80 + size * 12, snow: e > 0.72, face: roll < 0.1 });
        } else if (e > 0.36) {
          if (roll < 0.42) icons.push({ x, y, type: "hill", s: 30 + size * 12, base: landColor(e, m) });
        } else if (e < 0.04) {
          if (roll < 0.14) icons.push({ x, y, type: "palm", s: 26 + size * 8 });
        } else if (m > 0.56) {
          if (roll < 0.6) icons.push({ x, y, type: roll < 0.12 ? "palm" : "tree", s: 24 + size * 10 });
        } else if (m < 0.4) {
          if (roll < 0.16) icons.push({ x, y, type: roll < 0.1 ? "cactus" : "rock", s: 26 + size * 8 });
        } else if (roll < 0.24) {
          icons.push({ x, y, type: "tree", s: 22 + size * 8 });
        }
      }
    }
    const peak = icons.reduce((best, icon) => (icon.type === "mountain" && (!best || icon.e > best.e) ? icon : best), null);
    if (peak) {
      peak.type = "volcano";
      peak.s = Math.max(peak.s, 58);
    }
    icons.sort((a, b) => a.y - b.y);
    icons.forEach((icon) => {
      const x = icon.x * K;
      const y = icon.y * K;
      if (icon.type === "volcano") volcano(ctx, x, y, icon.s, rand);
      else if (icon.type === "mountain") {
        mountain(ctx, x, y, icon.s, rand, icon.snow);
        if (icon.face) googlyFace(ctx, x - icon.s * 0.05, y - icon.s * 0.32, icon.s * 0.09, rand, "smile");
      }
      else if (icon.type === "hill") hill(ctx, x, y, icon.s, icon.base);
      else if (icon.type === "palm") palmIcon(ctx, x, y, icon.s, rand);
      else if (icon.type === "tree") lollipop(ctx, x, y, icon.s, rand);
      else if (icon.type === "cactus") cactus(ctx, x, y, icon.s, rand);
      else rockIcon(ctx, x, y, icon.s);
    });

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const trace = (road) => {
      ctx.beginPath();
      road.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x * K, p.y * K);
        else ctx.lineTo(p.x * K, p.y * K);
      });
    };
    planet.roads.filter((r) => r.cls === "minor").forEach((road) => {
      trace(road);
      ctx.strokeStyle = "rgba(255, 246, 225, 0.85)";
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.strokeStyle = "#8a5a3c";
      ctx.lineWidth = 3.4;
      ctx.setLineDash([11, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    });
    const majors = planet.roads.filter((r) => r.cls === "major");
    majors.forEach((road) => {
      trace(road);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 10;
      ctx.stroke();
    });
    majors.forEach((road) => {
      trace(road);
      ctx.strokeStyle = "#fff3c4";
      ctx.lineWidth = 5.6;
      ctx.stroke();
    });

    const bridges = [];
    planet.roads.forEach((road) => {
      let wasRiver = false;
      road.points.forEach((p, i) => {
        const river = G.waterAt(t, p.x, p.y) === G.WATER.RIVER;
        if (river && !wasRiver && bridges.every((b) => Math.hypot(b.x - p.x, b.y - p.y) > 12)) {
          const q = road.points[Math.min(road.points.length - 1, i + 1)];
          const o = road.points[Math.max(0, i - 1)];
          bridges.push({ x: p.x, y: p.y, angle: Math.atan2(q.y - o.y, q.x - o.x) });
        }
        wasRiver = river;
      });
    });
    bridges.forEach((b) => {
      ctx.save();
      ctx.translate(b.x * K, b.y * K);
      ctx.rotate(b.angle);
      ctx.fillStyle = "#c98d5a";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.rect(-13, -7, 26, 14);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      for (let k = -8; k <= 8; k += 5.3) {
        ctx.moveTo(k, -7);
        ctx.lineTo(k, 7);
      }
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-16, -9);
      ctx.lineTo(16, -9);
      ctx.moveTo(-16, 9);
      ctx.lineTo(16, 9);
      ctx.stroke();
      ctx.restore();
    });

    planet.towns.slice().sort((a, b) => a.y - b.y).forEach((town) => townIcon(ctx, town, rand));

    const doodles = [
      (x, y) => seaMonster(ctx, x, y, 40),
      (x, y) => ufo(ctx, x, y, 44),
      (x, y) => whale(ctx, x, y, 38, rand),
      (x, y) => tentacle(ctx, x, y, 52, rand),
      (x, y) => rubberDuck(ctx, x, y, 30, rand),
      (x, y) => sailboat(ctx, x, y, 30, rand),
      (x, y) => bottle(ctx, x, y, 26, rand),
      (x, y) => sailboat(ctx, x, y, 26, rand),
    ];
    const open = [];
    for (let i = 0; i < 900 && open.length < doodles.length; i++) {
      const x = 70 + rand() * 860;
      const y = 70 + rand() * 860;
      const deep = open.length < 3 ? -0.2 : -0.08;
      if (G.elevationAt(t, x, y) > deep || used.busy(x, y) || waterShare(t, x, y, open.length < 3 ? 50 : 34) < 1) continue;
      if (open.some((o) => Math.hypot(o.x - x, o.y - y) < (open.length < 3 ? 240 : 150)) || Math.hypot(x - 100, y - 900) < 170) continue;
      open.push({ x, y });
      used.mark(x, y, 55);
    }
    open.forEach((o, i) => doodles[i](o.x * K, o.y * K));

    const clouds = [{ x: 500, y: 48 }, { x: 500, y: 955 }, { x: 45, y: 500 }, { x: 955, y: 500 }]
      .map((c) => ({ ...c, x: c.x + (rand() - 0.5) * 260 * (c.y !== 500 ? 1 : 0), y: c.y + (rand() - 0.5) * 260 * (c.y === 500 ? 1 : 0) }))
      .filter((c) => waterShare(t, c.x, c.y, 40) > 0.85 && !used.busy(c.x, c.y));
    clouds.slice(0, 2).forEach((c) => smilingCloud(ctx, c.x * K, c.y * K, 34 + rand() * 8, rand));

    scaleBar(ctx, scaleSpot.x * K - 50 * K, scaleSpot.y * K + 20);
    cartouche(ctx, titleSpot.x * K + (titleSpot.x < 500 ? 70 : -70), titleSpot.y * K - 30, planet.seed);

    if (G.paperTexture) {
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = ctx.createPattern(G.paperTexture(), "repeat");
      ctx.fillRect(0, 0, A, A);
      ctx.restore();
    }

    planet.atlas = {
      canvas,
      size: A,
      provinces: provinceLayer,
      labels: { countries: political.countryLabels, continents: continentLabels(planet, political) },
      highlight: political.highlight,
      ms: performance.now() - started,
      volcano: peak && { x: peak.x, y: peak.y },
    };
    return planet.atlas;
  }

  // ---------- political ----------

  const TINTS = [[255, 214, 232], [210, 238, 255], [255, 240, 178], [214, 250, 204], [232, 218, 255], [255, 224, 200]];

  function politicalGrid(planet) {
    const n = BASE;
    const t = planet.terrain;
    const owner = new Uint8Array(n * n).fill(255);
    const stats = planet.countries.map(() => ({ sx: 0, sy: 0, count: 0, minX: 1000, maxX: 0, minY: 1000, maxY: 0 }));
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const mx = ((x + 0.5) / n) * 1000;
        const my = ((y + 0.5) / n) * 1000;
        const w = G.waterAt(t, mx, my);
        if (w === G.WATER.SEA || w === G.WATER.LAKE) continue;
        const id = G.placeAt(planet, mx, my).country.id;
        owner[y * n + x] = id;
        const s = stats[id];
        s.sx += mx;
        s.sy += my;
        s.count += 1;
        s.minX = Math.min(s.minX, mx);
        s.maxX = Math.max(s.maxX, mx);
        s.minY = Math.min(s.minY, my);
        s.maxY = Math.max(s.maxY, my);
      }
    }
    const touching = planet.countries.map(() => new Set());
    for (let i = 0; i < n * n; i++) {
      const a = owner[i];
      if (a === 255) continue;
      const right = i % n < n - 1 ? owner[i + 1] : 255;
      const down = i + n < n * n ? owner[i + n] : 255;
      [right, down].forEach((b) => {
        if (b !== 255 && b !== a) {
          touching[a].add(b);
          touching[b].add(a);
        }
      });
    }
    const tintOf = [];
    planet.countries.forEach((country) => {
      const taken = new Set([...touching[country.id]].map((other) => tintOf[other]).filter((v) => v !== undefined));
      let pick = country.id % TINTS.length;
      for (let k = 0; k < TINTS.length && taken.has(pick); k++) pick = (pick + 1) % TINTS.length;
      tintOf[country.id] = pick;
    });
    const tint = document.createElement("canvas");
    tint.width = n;
    tint.height = n;
    const tc = tint.getContext("2d");
    const img = tc.createImageData(n, n);
    for (let i = 0; i < n * n; i++) {
      const id = owner[i];
      const c = id === 255 ? [255, 255, 255] : TINTS[tintOf[id]];
      img.data[i * 4] = c[0];
      img.data[i * 4 + 1] = c[1];
      img.data[i * 4 + 2] = c[2];
      img.data[i * 4 + 3] = 255;
    }
    tc.putImageData(img, 0, 0);

    const maskOf = (test) => {
      const canvas = document.createElement("canvas");
      canvas.width = n;
      canvas.height = n;
      const mc = canvas.getContext("2d");
      const data = mc.createImageData(n, n);
      for (let i = 0; i < n * n; i++) {
        if (owner[i] !== 255 && test(owner[i])) data.data[i * 4 + 3] = 255;
      }
      mc.putImageData(data, 0, 0);
      return canvas;
    };
    const highlights = new Map();
    const countryLabels = planet.countries.map((country) => {
      const s = stats[country.id];
      if (!s.count) return { id: country.id, name: country.name, x: country.site.x, y: country.site.y, area: 0 };
      const cx = s.sx / s.count;
      const cy = s.sy / s.count;
      let best = null;
      let bestScore = Infinity;
      for (let y = 0; y < n; y += 2) {
        for (let x = 0; x < n; x += 2) {
          if (owner[y * n + x] !== country.id) continue;
          const mx = ((x + 0.5) / n) * 1000;
          const my = ((y + 0.5) / n) * 1000;
          let inside = 0;
          for (let r = 1; r <= 4; r++) {
            const d = r * 5;
            const ok = [[d, 0], [-d, 0], [0, d], [0, -d]].every(([dx, dy]) => {
              const px = clamp(x + dx, 0, n - 1);
              const py = clamp(y + dy, 0, n - 1);
              return owner[py * n + px] === country.id;
            });
            if (!ok) break;
            inside = r;
          }
          const score = Math.hypot(mx - cx, my - cy) - inside * 18;
          if (score < bestScore) {
            bestScore = score;
            best = { x: mx, y: my };
          }
        }
      }
      return { id: country.id, name: country.name, x: best.x, y: best.y, area: s.count, box: s };
    });
    return {
      owner,
      tint,
      countryLabels,
      continentMask: (id) => maskOf((owner) => planet.countries[owner].continentId === id),
      highlight: (id) => {
        if (!highlights.has(id)) highlights.set(id, maskOf((owner) => owner === id));
        return highlights.get(id);
      },
    };
  }

  function continentLabels(planet, political) {
    const t = planet.terrain;
    const placed = [];
    return planet.continents.map((continent) => {
      const boxes = continent.countryIds.map((id) => political.countryLabels[id].box).filter(Boolean);
      const minX = Math.min(...boxes.map((b) => b.minX));
      const maxX = Math.max(...boxes.map((b) => b.maxX));
      const minY = Math.min(...boxes.map((b) => b.minY));
      const maxY = Math.max(...boxes.map((b) => b.maxY));
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const options = [];
      [-1, 1].forEach((side) => {
        for (let k = -2; k <= 2; k++) {
          options.push({ x: cx + k * 60, y: side < 0 ? minY - 30 : maxY + 30 });
        }
      });
      [-1, 1].forEach((side) => {
        for (let k = -1; k <= 1; k++) options.push({ x: side < 0 ? minX - 70 : maxX + 70, y: cy + k * 70 });
      });
      let best = { x: continent.x, y: continent.y, over: true };
      let bestScore = -Infinity;
      options.forEach((o) => {
        if (o.x < 110 || o.x > 890 || o.y < 50 || o.y > 950) return;
        const wet = waterShare(t, o.x, o.y, 38) + waterShare(t, o.x - 70, o.y, 20) * 0.3 + waterShare(t, o.x + 70, o.y, 20) * 0.3;
        const crowd = placed.some((p) => Math.abs(p.x - o.x) < 220 && Math.abs(p.y - o.y) < 60) ? 2 : 0;
        const score = wet - crowd - Math.hypot(o.x - cx, o.y - cy) / 2000;
        if (score > bestScore) {
          bestScore = score;
          best = o;
        }
      });
      placed.push(best);
      return { id: continent.id, name: continent.name, x: best.x, y: best.y };
    });
  }

  G.buildAtlas = buildAtlas;
  G.ATLAS_SEA = "#5680d2";
})(window.ProbeDrop = window.ProbeDrop || {});
