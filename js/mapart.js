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
            c = mix(SEA_SHALLOW, SEA_DEEP, Math.sqrt(depth) * 1.15);
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

  function contourPath(t, level) {
    const n = t.N;
    const e = t.elev;
    const s = A / n;
    const path = new Path2D();
    const lerp = (a, b) => (level - a) / (b - a || 1e-6);
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
        const seg = (p, q) => {
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

  function house(ctx, x, y, w, h, wall, roof, kind) {
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
    ctx.fillStyle = "#ffe56b";
    const rows = Math.max(1, Math.floor(h / 11));
    for (let r = 0; r < rows; r++) {
      ctx.fillRect(x - w * 0.22, y - h + 5 + r * 10, w * 0.44, 4);
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
      house(ctx, x + dx, y + 8, w, h, wall, roof, kind);
    });
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

  function compass(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = "rgba(255, 248, 230, 0.92)";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.82, 0, TAU);
    ctx.setLineDash([5, 6]);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      const long = i % 2 === 0;
      const len = r * (long ? 0.95 : 0.6);
      const w = r * (long ? 0.16 : 0.11);
      const tip = { x: Math.cos(a) * len, y: Math.sin(a) * len };
      const side = { x: Math.cos(a + Math.PI / 2) * w, y: Math.sin(a + Math.PI / 2) * w };
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(side.x, side.y);
      ctx.lineTo(-side.x, -side.y);
      ctx.closePath();
      ctx.fillStyle = long ? (i === 0 ? "#ff4f9a" : "#3d7dff") : "#ffe56b";
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.12, 0, TAU);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.stroke();
    ctx.font = `${Math.round(r * 0.42)}px "Luckiest Guy", Fredoka, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = 6;
    ctx.strokeStyle = INK;
    ctx.strokeText("N", 0, -r - 4);
    ctx.fillStyle = "#fff";
    ctx.fillText("N", 0, -r - 4);
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
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.quadraticCurveTo(x - s * 0.5, y - s * 0.55, x, y);
    ctx.quadraticCurveTo(x + s * 0.5, y + s * 0.55, x + s, y);
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

    const coast = contourPath(t, 0);

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

    [[-0.03, 0.5, 2.2], [-0.07, 0.34, 1.8], [-0.12, 0.2, 1.5]].forEach(([level, alpha, width]) => {
      strokePath(ctx, contourPath(t, level), `rgba(40, 70, 150, ${alpha})`, width);
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
      { x: 120, y: 105 }, { x: 880, y: 105 }, { x: 120, y: 895 }, { x: 880, y: 895 },
    ].map((c) => {
      const crowd = planet.towns.filter((town) => Math.abs(town.x - c.x) < 170 && Math.abs(town.y - c.y) < 110).length;
      return { ...c, wet: waterShare(t, c.x, c.y, 90) - crowd * 0.35 };
    });
    const ranked = corners.slice().sort((a, b) => b.wet - a.wet);
    const titleSpot = ranked.find((c) => c.y < 500) || ranked[0];
    const rest = ranked.filter((c) => c !== titleSpot);
    const compassSpot = rest[0];
    const scaleSpot = rest[1];
    used.mark(titleSpot.x, titleSpot.y, 90);
    used.mark(compassSpot.x, compassSpot.y, 60);
    used.mark(scaleSpot.x, scaleSpot.y, 70);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    for (let gy = 20; gy < 1000; gy += 46) {
      for (let gx = 20; gx < 1000; gx += 46) {
        const x = gx + (rand() - 0.5) * 30;
        const y = gy + (rand() - 0.5) * 30;
        if (rand() < 0.45 || G.elevationAt(t, x, y) > -0.09 || used.busy(x, y)) continue;
        waveMark(ctx, x * K, y * K, 9 + rand() * 6);
      }
    }

    strokePath(ctx, coast, INK, 4.2);

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

    const borders = layer();
    const bc = borders.getContext("2d");
    bc.strokeStyle = "rgba(60, 20, 80, 0.5)";
    bc.lineWidth = 3;
    bc.lineCap = "round";
    bc.setLineDash([14, 11]);
    planet.regions.forEach((region) => {
      bc.beginPath();
      region.polygon.forEach((p, i) => {
        if (i === 0) bc.moveTo(p.x * K, p.y * K);
        else bc.lineTo(p.x * K, p.y * K);
      });
      bc.closePath();
      bc.stroke();
    });
    bc.globalCompositeOperation = "destination-in";
    bc.drawImage(wash.land, 0, 0);
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
          if (roll < 0.85) icons.push({ x, y, type: "mountain", s: 34 + (e - 0.52) * 80 + size * 12, snow: e > 0.72 });
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
    icons.sort((a, b) => a.y - b.y);
    icons.forEach((icon) => {
      const x = icon.x * K;
      const y = icon.y * K;
      if (icon.type === "mountain") mountain(ctx, x, y, icon.s, rand, icon.snow);
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

    const open = [];
    for (let i = 0; i < 400 && open.length < 2; i++) {
      const x = 80 + rand() * 840;
      const y = 80 + rand() * 840;
      if (G.elevationAt(t, x, y) > -0.2 || used.busy(x, y) || waterShare(t, x, y, 50) < 1) continue;
      if (open.some((o) => Math.hypot(o.x - x, o.y - y) < 260)) continue;
      open.push({ x, y });
      used.mark(x, y, 60);
    }
    if (open[0]) seaMonster(ctx, open[0].x * K, open[0].y * K, 40);
    if (open[1]) ufo(ctx, open[1].x * K, open[1].y * K, 44);

    compass(ctx, compassSpot.x * K, compassSpot.y * K, 76);
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

    planet.atlas = { canvas, size: A, ms: performance.now() - started };
    return planet.atlas;
  }

  G.buildAtlas = buildAtlas;
  G.ATLAS_SEA = "#5680d2";
})(window.AlienGuessr = window.AlienGuessr || {});
