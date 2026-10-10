(function (G) {
  const INK = "#1b1033";
  const TAU = Math.PI * 2;
  const HEIGHT = { short: 1.05, medium: 1.45, tall: 1.95 };

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function col(c, dl, ds, a) {
    const h = ((c.h % 360) + 360) % 360;
    const s = clamp(c.s + (ds || 0), 0, 100);
    const l = clamp(c.l + (dl || 0), 0, 100);
    return `hsla(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}% / ${a === undefined ? 1 : a})`;
  }

  function mixC(a, b, t) {
    const dh = ((((b.h - a.h) % 360) + 540) % 360) - 180;
    return { h: a.h + dh * t, s: a.s + (b.s - a.s) * t, l: a.l + (b.l - a.l) * t };
  }

  function shade(c, dl, ds) {
    return { h: c.h, s: clamp(c.s + (ds || 0), 0, 100), l: clamp(c.l + (dl || 0), 0, 100) };
  }

  function inkW(s, U) {
    return U * clamp(0.8 + (s / U) * 0.014, 0.8, 3);
  }

  function paint(ctx, build, fill, o) {
    ctx.beginPath();
    build();
    ctx.fillStyle = fill;
    ctx.fill();
    if (o && o.glaze) {
      ctx.save();
      ctx.clip();
      ctx.globalAlpha = o.glazeAlpha || 0.32;
      ctx.strokeStyle = o.glaze;
      ctx.lineWidth = o.edge || 6;
      ctx.beginPath();
      build();
      ctx.stroke();
      ctx.restore();
    }
    if (o && o.ink) {
      ctx.beginPath();
      build();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = INK;
      ctx.lineWidth = o.ink;
      ctx.stroke();
    }
  }

  function stroke(ctx, build, color, width) {
    ctx.beginPath();
    build();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function leafPath(ctx, x0, y0, x1, y1, w, bend) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const cx = (x0 + x1) / 2 + nx * bend * len;
    const cy = (y0 + y1) / 2 + ny * bend * len;
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx + nx * w, cy + ny * w, x1, y1);
    ctx.quadraticCurveTo(cx - nx * w, cy - ny * w, x0, y0);
  }

  function blobUnion(ctx, blobs, color, iw) {
    ctx.fillStyle = INK;
    blobs.forEach((b) => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + iw, 0, TAU);
      ctx.fill();
    });
    ctx.fillStyle = col(color);
    blobs.forEach((b) => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
    });
    ctx.fillStyle = col(color, -12, 4, 0.5);
    blobs.forEach((b) => {
      ctx.beginPath();
      ctx.arc(b.x + b.r * 0.12, b.y + b.r * 0.3, b.r * 0.62, 0, TAU);
      ctx.fill();
    });
    ctx.fillStyle = col(color, 12, -4, 0.32);
    blobs.forEach((b) => {
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.28, b.y - b.r * 0.3, b.r * 0.32, 0, TAU);
      ctx.fill();
    });
  }

  function shadowBlob(ctx, x, y, rx, ry) {
    ctx.fillStyle = "rgba(27, 16, 51, 0.22)";
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fill();
  }

  // ---------- plants ----------

  function bush(ctx, x, y, s, size, color, rand, U) {
    const r0 = size * s;
    if (r0 < 1) return;
    const n = 3 + Math.floor(rand() * 4);
    const blobs = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      blobs.push({
        x: x + (t - 0.5) * r0 * 1.5 + (rand() - 0.5) * r0 * 0.3,
        y: y - r0 * (0.32 + Math.sin(t * Math.PI) * 0.45 + rand() * 0.15),
        r: r0 * (0.36 + rand() * 0.2),
      });
    }
    shadowBlob(ctx, x, y, r0 * 0.95, r0 * 0.16);
    blobUnion(ctx, blobs, color, inkW(s, U));
  }

  function tree(ctx, x, y, s, h, color, trunk, rand, U) {
    const H = h * s;
    if (H < 2) return;
    const iw = inkW(s, U);
    const lean = (rand() - 0.5) * 0.3;
    const tx = x + lean * H;
    const ty = y - H * 0.62;
    const w0 = Math.max(1, H * 0.07);
    const w1 = Math.max(0.6, H * 0.035);
    shadowBlob(ctx, x, y, H * 0.3, H * 0.05);
    paint(ctx, () => {
      ctx.moveTo(x - w0, y);
      ctx.quadraticCurveTo(x - w0 + lean * H * 0.6, y - H * 0.35, tx - w1, ty);
      ctx.lineTo(tx + w1, ty);
      ctx.quadraticCurveTo(x + w0 + lean * H * 0.6, y - H * 0.35, x + w0, y);
      ctx.closePath();
    }, col(trunk), { ink: iw });
    const blobs = [];
    const n = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand();
      const rr = H * (0.16 + rand() * 0.08);
      blobs.push({ x: tx + Math.cos(a) * H * 0.16, y: ty - H * 0.1 + Math.sin(a) * H * 0.12, r: rr });
    }
    blobs.push({ x: tx, y: ty - H * 0.12, r: H * 0.2 });
    blobUnion(ctx, blobs, color, iw);
  }

  function palm(ctx, x, y, s, h, color, trunk, rand, U) {
    const H = h * s;
    if (H < 3) return;
    const iw = inkW(s, U);
    const lean = (rand() - 0.5) * 0.7;
    const tx = x + lean * H * 0.45;
    const ty = y - H;
    const w0 = Math.max(1, H * 0.045);
    const w1 = Math.max(0.6, H * 0.025);
    const cx = x + lean * H * 0.05;
    shadowBlob(ctx, x, y, H * 0.22, H * 0.04);
    paint(ctx, () => {
      ctx.moveTo(x - w0, y);
      ctx.quadraticCurveTo(cx - w0, y - H * 0.6, tx - w1, ty);
      ctx.lineTo(tx + w1, ty);
      ctx.quadraticCurveTo(cx + w0, y - H * 0.6, x + w0, y);
      ctx.closePath();
    }, col(trunk), { ink: iw });
    ctx.strokeStyle = col(trunk, -18, 0, 0.8);
    ctx.lineWidth = Math.max(0.6, iw * 0.7);
    for (let i = 1; i < 9; i++) {
      const t = i / 9;
      const u = 1 - t;
      const px = u * u * x + 2 * u * t * cx + t * t * tx;
      const py = u * u * y + 2 * u * t * (y - H * 0.6) + t * t * ty;
      const w = w0 + (w1 - w0) * t;
      ctx.beginPath();
      ctx.moveTo(px - w, py);
      ctx.quadraticCurveTo(px, py + w * 0.6, px + w, py);
      ctx.stroke();
    }
    const fronds = 6 + Math.floor(rand() * 3);
    for (let i = 0; i < fronds; i++) {
      const a = -Math.PI + (i / (fronds - 1)) * Math.PI + (rand() - 0.5) * 0.3;
      const len = H * (0.42 + rand() * 0.15);
      const ex = tx + Math.cos(a) * len;
      const ey = ty + Math.sin(a) * len * 0.45 + len * 0.42;
      const leafColor = shade(color, (rand() - 0.5) * 12);
      paint(ctx, () => leafPath(ctx, tx, ty, ex, ey, len * 0.13, Math.cos(a) > 0 ? -0.22 : 0.22), col(leafColor), {
        ink: iw,
        glaze: col(leafColor, -18),
        edge: len * 0.06,
      });
      stroke(ctx, () => {
        ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo((tx + ex) / 2, (ty + ey) / 2 - len * 0.18, ex, ey);
      }, col(leafColor, -22, 0, 0.7), Math.max(0.5, iw * 0.6));
    }
    for (let i = 0; i < 3; i++) {
      paint(ctx, () => ctx.arc(tx + (i - 1) * H * 0.03, ty + H * 0.03, Math.max(1, H * 0.022), 0, TAU), col({ h: 30, s: 50, l: 40 }), { ink: iw * 0.7 });
    }
  }

  function mushroom(ctx, x, y, s, h, color, rand, U) {
    const H = h * s;
    if (H < 3) return;
    const iw = inkW(s, U);
    const lean = (rand() - 0.5) * 0.25 * H;
    const tx = x + lean;
    const ty = y - H * 0.72;
    const sw = H * 0.09;
    shadowBlob(ctx, x, y, H * 0.3, H * 0.05);
    paint(ctx, () => {
      ctx.moveTo(x - sw * 1.3, y);
      ctx.quadraticCurveTo(x - sw + lean * 0.4, y - H * 0.4, tx - sw * 0.75, ty);
      ctx.lineTo(tx + sw * 0.75, ty);
      ctx.quadraticCurveTo(x + sw + lean * 0.4, y - H * 0.4, x + sw * 1.3, y);
      ctx.closePath();
    }, col({ h: 40, s: 60, l: 90 }), { ink: iw, glaze: col({ h: 30, s: 40, l: 70 }), edge: sw });
    const rx = H * (0.42 + rand() * 0.12);
    const ry = H * (0.3 + rand() * 0.1);
    const capPath = () => {
      ctx.moveTo(tx - rx, ty + ry * 0.1);
      ctx.bezierCurveTo(tx - rx, ty - ry * 1.3, tx + rx, ty - ry * 1.3, tx + rx, ty + ry * 0.1);
      ctx.quadraticCurveTo(tx, ty + ry * 0.45, tx - rx, ty + ry * 0.1);
      ctx.closePath();
    };
    paint(ctx, () => {
      ctx.moveTo(tx - rx * 0.9, ty + ry * 0.15);
      ctx.quadraticCurveTo(tx, ty + ry * 0.6, tx + rx * 0.9, ty + ry * 0.15);
      ctx.closePath();
    }, col(color, -22), { ink: iw * 0.8 });
    paint(ctx, capPath, col(color), { ink: iw, glaze: col(color, -20), edge: ry * 0.4 });
    ctx.save();
    ctx.beginPath();
    capPath();
    ctx.clip();
    for (let i = 0; i < 6; i++) {
      const sx = tx + (rand() - 0.5) * rx * 1.6;
      const sy = ty - rand() * ry * 0.9;
      paint(ctx, () => ctx.ellipse(sx, sy, rx * 0.12, ry * 0.11, 0, 0, TAU), "rgba(255, 250, 245, 0.92)", { ink: iw * 0.6 });
    }
    ctx.restore();
  }

  function tentacle(ctx, x, y, s, h, color, rand, U) {
    const H = h * s;
    if (H < 3) return;
    const iw = inkW(s, U);
    const pts = [];
    const sway = (rand() - 0.5) * H * 0.5;
    const curlDir = rand() < 0.5 ? -1 : 1;
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      pts.push({ x: x + Math.sin(t * 2.4) * sway, y: y - t * H * 0.82 });
    }
    const last = pts[pts.length - 1];
    const cr = H * 0.12;
    for (let i = 1; i <= 14; i++) {
      const a = Math.PI + curlDir * (i / 14) * Math.PI * 1.7;
      const r = cr * (1 - i / 22);
      pts.push({ x: last.x + cr * curlDir + Math.cos(a) * r * curlDir, y: last.y + Math.sin(a) * r * -1 });
    }
    const left = [];
    const right = [];
    pts.forEach((p, i) => {
      const q = pts[Math.min(pts.length - 1, i + 1)];
      const o = pts[Math.max(0, i - 1)];
      const dx = q.x - o.x;
      const dy = q.y - o.y;
      const len = Math.hypot(dx, dy) || 1;
      const w = H * 0.07 * (1 - i / pts.length) + H * 0.008;
      left.push({ x: p.x - (dy / len) * w, y: p.y + (dx / len) * w });
      right.push({ x: p.x + (dy / len) * w, y: p.y - (dx / len) * w });
    });
    shadowBlob(ctx, x, y, H * 0.12, H * 0.03);
    paint(ctx, () => {
      ctx.moveTo(left[0].x, left[0].y);
      left.forEach((p) => ctx.lineTo(p.x, p.y));
      for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
      ctx.closePath();
    }, col(color), { ink: iw, glaze: col(color, -22), edge: H * 0.04 });
    for (let i = 2; i < 16; i += 2) {
      const p = left[i];
      paint(ctx, () => ctx.arc(p.x * 0.7 + pts[i].x * 0.3, p.y * 0.7 + pts[i].y * 0.3, Math.max(0.6, H * 0.012), 0, TAU), col(color, 20, -10), { ink: iw * 0.5 });
    }
  }

  function crystal(ctx, x, y, s, h, color, rand, U) {
    const H = h * s;
    if (H < 3) return;
    const iw = inkW(s, U);
    const glow = ctx.createRadialGradient(x, y - H * 0.4, 0, x, y - H * 0.4, H * 0.8);
    glow.addColorStop(0, col(color, 20, 0, 0.35));
    glow.addColorStop(1, col(color, 20, 0, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x - H, y - H * 1.2, H * 2, H * 1.4);
    const n = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const bx = x + (i - (n - 1) / 2) * H * 0.18 + (rand() - 0.5) * H * 0.06;
      const hh = H * (i === Math.floor(n / 2) ? 1 : 0.45 + rand() * 0.4);
      const w = H * (0.1 + rand() * 0.06);
      const tilt = (bx - x) * 0.5;
      const c = shade(color, (rand() - 0.5) * 16);
      paint(ctx, () => {
        ctx.moveTo(bx - w, y);
        ctx.lineTo(bx - w + tilt * 0.6, y - hh * 0.78);
        ctx.lineTo(bx + tilt, y - hh);
        ctx.lineTo(bx + w + tilt * 0.6, y - hh * 0.78);
        ctx.lineTo(bx + w, y);
        ctx.closePath();
      }, col(c, 6), { ink: iw, glaze: col(c, -20), edge: w * 0.5 });
      stroke(ctx, () => {
        ctx.moveTo(bx + tilt, y - hh);
        ctx.lineTo(bx + tilt * 0.3, y);
      }, col(c, 30, 0, 0.7), Math.max(0.6, iw * 0.8));
    }
  }

  function fern(ctx, x, y, s, size, color, rand, U) {
    const H = size * s;
    if (H < 2) return;
    const iw = inkW(s, U);
    const n = 5 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.12 + (i / (n - 1)) * 0.76) + (rand() - 0.5) * 0.2;
      const len = H * (0.65 + rand() * 0.45);
      const ex = x + Math.cos(a) * len;
      const ey = y + Math.sin(a) * len * 0.9 + len * 0.18;
      const c = shade(color, (rand() - 0.5) * 14, 0);
      paint(ctx, () => leafPath(ctx, x, y, ex, ey, len * 0.17, Math.cos(a) > 0 ? -0.2 : 0.2), col(c), {
        ink: iw,
        glaze: col(c, -16),
        edge: len * 0.08,
      });
      stroke(ctx, () => {
        ctx.moveTo(x, y);
        ctx.lineTo(x + (ex - x) * 0.85, y + (ey - y) * 0.85);
      }, col(c, -24, 0, 0.6), Math.max(0.5, iw * 0.6));
    }
  }

  function boulder(ctx, x, y, s, size, color, rand, U) {
    const R = size * s;
    if (R < 1.5) return;
    const iw = inkW(s, U);
    const pts = [];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i / (n - 1)) * Math.PI;
      const r = R * (0.8 + rand() * 0.35);
      pts.push({ x: x + Math.cos(a) * r * 1.2, y: y + Math.sin(a) * r * 0.85 });
    }
    shadowBlob(ctx, x, y, R * 1.3, R * 0.18);
    const build = () => {
      ctx.moveTo(pts[0].x, y);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const q = pts[(i + 1) % pts.length];
        ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
      }
      ctx.lineTo(pts[pts.length - 1].x, y);
      ctx.closePath();
    };
    paint(ctx, build, col(color), { ink: iw, glaze: col(color, -20), edge: R * 0.3 });
    paint(ctx, () => ctx.ellipse(x - R * 0.35, y - R * 0.55, R * 0.35, R * 0.2, -0.3, 0, TAU), col(color, 14, 0, 0.6));
    stroke(ctx, () => {
      ctx.moveTo(x + R * 0.1, y - R * 0.6);
      ctx.lineTo(x + R * 0.25, y - R * 0.3);
      ctx.lineTo(x + R * 0.15, y - R * 0.05);
    }, INK, iw * 0.7);
  }

  function tuft(ctx, x, y, s, size, color, rand, U) {
    const H = size * s;
    if (H < 1) return;
    ctx.strokeStyle = col(color, -16);
    ctx.lineWidth = Math.max(0.6, inkW(s, U) * 0.8);
    ctx.lineCap = "round";
    const n = 3 + Math.floor(rand() * 3);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const dx = (i - (n - 1) / 2) * H * 0.25;
      ctx.moveTo(x + dx * 0.4, y);
      ctx.quadraticCurveTo(x + dx, y - H * 0.6, x + dx * 1.6 + (rand() - 0.5) * H * 0.3, y - H * (0.8 + rand() * 0.4));
    }
    ctx.stroke();
  }

  function flower(ctx, x, y, s, size, color, rand, U) {
    const H = size * s;
    if (H < 2) return;
    const iw = inkW(s, U) * 0.7;
    stroke(ctx, () => {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + H * 0.1, y - H * 0.5, x, y - H);
    }, col({ h: 130, s: 40, l: 34 }), iw);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      paint(ctx, () => ctx.arc(x + Math.cos(a) * H * 0.16, y - H + Math.sin(a) * H * 0.16, H * 0.13, 0, TAU), col(color), { ink: iw });
    }
    paint(ctx, () => ctx.arc(x, y - H, H * 0.1, 0, TAU), col({ h: 50, s: 90, l: 70 }), { ink: iw });
  }

  // ---------- funky plants ----------

  function eyestalk(ctx, x, y, s, h, color, rand, U) {
    const H = h * s;
    if (H < 3) return;
    const iw = inkW(s, U);
    shadowBlob(ctx, x, y, H * 0.26, H * 0.05);
    const n = 2 + Math.floor(rand() * 3);
    const stalks = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      const bx = x + t * H * 0.28;
      stalks.push({
        bx,
        tx: bx + t * H * 0.36 + (rand() - 0.5) * H * 0.14,
        ty: y - H * (0.5 + rand() * 0.5),
        w: Math.max(0.8, H * 0.03),
        r: H * (0.085 + rand() * 0.05),
        sleepy: rand() < 0.35,
        lx: (rand() - 0.5) * 0.5,
        ly: (rand() - 0.5) * 0.4,
      });
    }
    const iris = { h: color.h + 180, s: 72, l: 56 };
    stalks.sort((a, b) => a.r - b.r).forEach((st) => {
      const build = () => {
        ctx.moveTo(st.bx, y);
        ctx.quadraticCurveTo(st.bx, (y + st.ty) / 2, st.tx, st.ty);
      };
      stroke(ctx, build, INK, st.w * 2 + iw * 2);
      stroke(ctx, build, col(color), st.w * 2);
      paint(ctx, () => ctx.arc(st.tx, st.ty, st.r, 0, TAU), "#fffaf2", { ink: iw, glaze: col(color, -6), edge: st.r * 0.35 });
      const ix = st.tx + st.lx * st.r;
      const iy = st.ty + st.ly * st.r;
      paint(ctx, () => ctx.arc(ix, iy, st.r * 0.5, 0, TAU), col(iris), { ink: iw * 0.6 });
      paint(ctx, () => ctx.arc(ix, iy, st.r * 0.24, 0, TAU), INK);
      paint(ctx, () => ctx.arc(ix - st.r * 0.16, iy - st.r * 0.18, st.r * 0.1, 0, TAU), "#fff");
      if (st.sleepy) {
        paint(ctx, () => {
          ctx.arc(st.tx, st.ty, st.r * 1.04, Math.PI * 1.02, Math.PI * 1.98);
          ctx.quadraticCurveTo(st.tx, st.ty - st.r * 0.1, st.tx - st.r * 1.04, st.ty - st.r * 0.04);
          ctx.closePath();
        }, col(color, -4), { ink: iw * 0.8 });
      }
    });
  }

  function bulb(ctx, x, y, s, h, color, rand, U) {
    const H = h * s;
    if (H < 3) return;
    const iw = inkW(s, U);
    shadowBlob(ctx, x, y, H * 0.28, H * 0.05);
    const n = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      const hh = H * (i === Math.floor(n / 2) ? 1 : 0.6 + rand() * 0.25);
      const bx = x + t * H * 0.45;
      const r = hh * 0.2;
      const cy = y - hh + r;
      const stem = () => {
        ctx.moveTo(x + t * H * 0.1, y);
        ctx.quadraticCurveTo(bx, y - hh * 0.4, bx, cy + r);
      };
      stroke(ctx, stem, INK, Math.max(1.2, H * 0.03) + iw * 2);
      stroke(ctx, stem, col({ h: color.h + 40, s: 40, l: 40 }), Math.max(1.2, H * 0.03));
      const glow = ctx.createRadialGradient(bx, cy, 0, bx, cy, r * 3);
      glow.addColorStop(0, col(color, 26, 10, 0.5));
      glow.addColorStop(1, col(color, 26, 10, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(bx - r * 3, cy - r * 3, r * 6, r * 6);
      const shape = () => {
        ctx.moveTo(bx, cy - r * 1.7);
        ctx.bezierCurveTo(bx + r * 0.3, cy - r * 1.1, bx + r * 1.15, cy - r * 0.6, bx + r * 1.05, cy + r * 0.25);
        ctx.bezierCurveTo(bx + r * 0.95, cy + r * 1.05, bx - r * 0.95, cy + r * 1.05, bx - r * 1.05, cy + r * 0.25);
        ctx.bezierCurveTo(bx - r * 1.15, cy - r * 0.6, bx - r * 0.3, cy - r * 1.1, bx, cy - r * 1.7);
        ctx.closePath();
      };
      paint(ctx, shape, col(color, 16, 0, 0.82), { ink: iw, glaze: col(color, -14), edge: r * 0.35 });
      stroke(ctx, () => {
        for (let k = 0; k <= 16; k++) {
          const a = k * 0.9;
          const rr = r * 0.12 + k * r * 0.03;
          const px = bx + Math.cos(a) * rr;
          const py = cy + r * 0.25 - k * r * 0.07 + Math.sin(a) * rr * 0.4;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
      }, "rgba(255, 236, 120, 0.95)", Math.max(0.8, r * 0.1));
      paint(ctx, () => ctx.ellipse(bx - r * 0.4, cy - r * 0.35, r * 0.22, r * 0.4, -0.4, 0, TAU), "rgba(255, 255, 255, 0.55)");
    }
    [-1, 1].forEach((side) => {
      const c = shade(color, -18, -10);
      paint(ctx, () => leafPath(ctx, x, y, x + side * H * 0.32, y - H * 0.18, H * 0.06, side * -0.25), col({ h: c.h + 50, s: 45, l: 46 }), { ink: iw });
    });
  }

  function spiralFern(ctx, x, y, s, h, color, rand, U) {
    const H = h * s;
    if (H < 3) return;
    const iw = inkW(s, U);
    shadowBlob(ctx, x, y, H * 0.3, H * 0.05);
    const n = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) - 0.5;
      const hh = H * (0.55 + rand() * 0.45);
      const dir = t < 0 ? -1 : 1;
      const tx = x + t * H * 0.7;
      const ty = y - hh;
      const cr = hh * (0.12 + rand() * 0.06);
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const u = k / 12;
        pts.push({ x: x + (tx - x) * u * u, y: y + (ty - y) * u });
      }
      for (let k = 1; k <= 22; k++) {
        const a = Math.PI + dir * k * 0.42;
        const rr = cr * (1 - k / 26);
        pts.push({ x: tx + dir * cr + Math.cos(a) * rr * dir, y: ty - Math.sin(a) * rr * -1 - cr * 0 });
      }
      const build = () => {
        pts.forEach((p, k) => (k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      };
      const w = Math.max(1, H * 0.035);
      stroke(ctx, build, INK, w + iw * 2);
      stroke(ctx, build, col(color), w);
      for (let k = 3; k < 12; k += 2) {
        const p = pts[k];
        const c = shade(color, (rand() - 0.5) * 12);
        [-1, 1].forEach((side) => {
          const len = hh * 0.13 * (1 - k / 16);
          paint(ctx, () => leafPath(ctx, p.x, p.y, p.x + side * len, p.y - len * 0.5, len * 0.28, side * 0.2), col(c, 6), { ink: iw * 0.7 });
        });
      }
    }
  }

  function balloonPod(ctx, x, y, s, h, color, rand, U) {
    const H = h * s;
    if (H < 3) return;
    const iw = inkW(s, U);
    shadowBlob(ctx, x, y, H * 0.2, H * 0.04);
    const n = 2 + Math.floor(rand() * 3);
    const balloons = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      balloons.push({
        bx: x + t * H * 0.5 + (rand() - 0.5) * H * 0.1,
        by: y - H * (0.6 + rand() * 0.4),
        r: H * (0.09 + rand() * 0.06),
        c: { h: color.h + (rand() - 0.5) * 50, s: clamp(color.s + 10, 0, 100), l: clamp(color.l + (rand() - 0.3) * 14, 20, 85) },
      });
    }
    balloons.forEach((b) => {
      stroke(ctx, () => {
        ctx.moveTo(x, y - H * 0.08);
        ctx.bezierCurveTo(x + (b.bx - x) * 0.2, y - H * 0.35, b.bx + (rand() - 0.5) * H * 0.1, b.by + b.r * 2.5, b.bx, b.by + b.r * 1.1);
      }, INK, Math.max(0.6, iw * 0.7));
    });
    balloons.sort((a, b) => b.by - a.by).forEach((b) => {
      paint(ctx, () => {
        ctx.moveTo(b.bx - b.r * 0.15, b.by + b.r * 1.22);
        ctx.lineTo(b.bx + b.r * 0.15, b.by + b.r * 1.22);
        ctx.lineTo(b.bx, b.by + b.r * 1.0);
        ctx.closePath();
      }, col(b.c, -12), { ink: iw * 0.6 });
      paint(ctx, () => ctx.ellipse(b.bx, b.by, b.r * 0.9, b.r * 1.08, 0, 0, TAU), col(b.c), { ink: iw, glaze: col(b.c, -22), edge: b.r * 0.4 });
      paint(ctx, () => ctx.ellipse(b.bx - b.r * 0.35, b.by - b.r * 0.4, b.r * 0.16, b.r * 0.3, -0.5, 0, TAU), "rgba(255, 255, 255, 0.75)");
    });
    paint(ctx, () => {
      ctx.moveTo(x - H * 0.1, y);
      ctx.bezierCurveTo(x - H * 0.12, y - H * 0.12, x + H * 0.12, y - H * 0.12, x + H * 0.1, y);
      ctx.closePath();
    }, col({ h: color.h + 120, s: 40, l: 44 }), { ink: iw });
  }

  function jellyTree(ctx, x, y, s, h, color, trunk, rand, U) {
    const H = h * s;
    if (H < 3) return;
    const iw = inkW(s, U);
    shadowBlob(ctx, x, y, H * 0.3, H * 0.05);
    const lean = (rand() - 0.5) * H * 0.2;
    const tx = x + lean;
    const ty = y - H * 0.7;
    const w = Math.max(1, H * 0.05);
    paint(ctx, () => {
      ctx.moveTo(x - w * 1.4, y);
      ctx.bezierCurveTo(x - w, y - H * 0.3, tx - w * 1.5, ty + H * 0.2, tx - w * 0.6, ty);
      ctx.lineTo(tx + w * 0.6, ty);
      ctx.bezierCurveTo(tx + w * 1.5, ty + H * 0.2, x + w, y - H * 0.3, x + w * 1.4, y);
      ctx.closePath();
    }, col(trunk), { ink: iw, glaze: col(trunk, -16), edge: w });
    const R = H * (0.36 + rand() * 0.1);
    const c = { h: color.h, s: clamp(color.s + 15, 0, 100), l: clamp(color.l + 12, 30, 85) };
    for (let i = 0; i < 7; i++) {
      const u = i / 6 - 0.5;
      const sx = tx + u * R * 1.7;
      const len = H * (0.38 + rand() * 0.3);
      const wave = (rand() - 0.5) * R * 0.3;
      stroke(ctx, () => {
        ctx.moveTo(sx, ty + R * 0.05);
        ctx.bezierCurveTo(sx + wave, ty + len * 0.35, sx - wave, ty + len * 0.7, sx + wave * 0.5, ty + len);
      }, col(c, -10, 0, 0.9), Math.max(0.8, H * 0.016));
    }
    const dome = () => {
      ctx.moveTo(tx - R, ty + R * 0.1);
      ctx.bezierCurveTo(tx - R, ty - R * 1.15, tx + R, ty - R * 1.15, tx + R, ty + R * 0.1);
      for (let k = 4; k >= -4; k--) {
        const px = tx + (k / 4) * R;
        ctx.quadraticCurveTo(px + R * 0.12, ty + R * 0.3, px, ty + R * 0.1);
      }
      ctx.closePath();
    };
    paint(ctx, dome, col(c, 0, 0, 0.78), { ink: iw, glaze: col(c, -18), edge: R * 0.25 });
    for (let i = 0; i < 5; i++) {
      paint(ctx, () => ctx.arc(tx + (rand() - 0.5) * R * 1.2, ty - rand() * R * 0.6, R * (0.05 + rand() * 0.05), 0, TAU), col(c, 24, -10, 0.85));
    }
    paint(ctx, () => ctx.ellipse(tx - R * 0.45, ty - R * 0.45, R * 0.14, R * 0.26, -0.6, 0, TAU), "rgba(255, 255, 255, 0.6)");
  }

  function tubeCoral(ctx, x, y, s, h, color, rand, U) {
    const H = h * s;
    if (H < 2) return;
    const iw = inkW(s, U);
    shadowBlob(ctx, x, y, H * 0.45, H * 0.07);
    const n = 3 + Math.floor(rand() * 4);
    const tubes = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) - 0.5;
      tubes.push({ bx: x + t * H * 0.7, hh: H * (0.4 + rand() * 0.6), w: H * (0.07 + rand() * 0.05), lean: t * H * 0.25 });
    }
    tubes.sort((a, b) => b.hh - a.hh).forEach((tb) => {
      const top = { x: tb.bx + tb.lean, y: y - tb.hh };
      const c = shade(color, (rand() - 0.5) * 16);
      paint(ctx, () => {
        ctx.moveTo(tb.bx - tb.w, y);
        ctx.quadraticCurveTo(tb.bx - tb.w * 0.8, y - tb.hh * 0.5, top.x - tb.w * 1.1, top.y);
        ctx.lineTo(top.x + tb.w * 1.1, top.y);
        ctx.quadraticCurveTo(tb.bx + tb.w * 0.8, y - tb.hh * 0.5, tb.bx + tb.w, y);
        ctx.closePath();
      }, col(c), { ink: iw, glaze: col(c, -22), edge: tb.w * 0.6 });
      paint(ctx, () => ctx.ellipse(top.x, top.y, tb.w * 1.15, tb.w * 0.4, 0, 0, TAU), col(c, 18), { ink: iw });
      paint(ctx, () => ctx.ellipse(top.x, top.y + tb.w * 0.04, tb.w * 0.7, tb.w * 0.22, 0, 0, TAU), col(c, -36));
      for (let k = 0; k < 3; k++) {
        paint(ctx, () => ctx.arc(tb.bx + (rand() - 0.5) * tb.w, y - tb.hh * (0.2 + rand() * 0.6), Math.max(0.6, tb.w * 0.16), 0, TAU), col(c, 20, 0, 0.8));
      }
    });
  }

  function cottonTree(ctx, x, y, s, h, color, trunk, rand, U) {
    const H = h * s;
    if (H < 3) return;
    const iw = inkW(s, U);
    shadowBlob(ctx, x, y, H * 0.28, H * 0.05);
    const tx = x + (rand() - 0.5) * H * 0.15;
    const ty = y - H * 0.62;
    const w = Math.max(1, H * 0.035);
    paint(ctx, () => {
      ctx.moveTo(x - w * 1.3, y);
      ctx.quadraticCurveTo(x - w, y - H * 0.35, tx - w * 0.6, ty);
      ctx.lineTo(tx + w * 0.6, ty);
      ctx.quadraticCurveTo(x + w, y - H * 0.35, x + w * 1.3, y);
      ctx.closePath();
    }, col(trunk, 10), { ink: iw });
    const puffs = [];
    const n = 4 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand() * 0.6;
      const d = H * (0.08 + rand() * 0.14);
      puffs.push({ x: tx + Math.cos(a) * d * 1.3, y: ty - H * 0.08 + Math.sin(a) * d, r: H * (0.12 + rand() * 0.07) });
    }
    blobUnion(ctx, puffs, { h: color.h, s: clamp(color.s, 40, 70), l: clamp(color.l + 18, 70, 88) }, iw);
    puffs.slice(0, 3).forEach((p) => {
      paint(ctx, () => ctx.arc(p.x - p.r * 0.2, p.y - p.r * 0.25, p.r * 0.4, 0, TAU), "rgba(255, 255, 255, 0.55)");
    });
  }

  function pitcher(ctx, x, y, s, h, color, rand, U) {
    const H = h * s;
    if (H < 2) return;
    const iw = inkW(s, U);
    shadowBlob(ctx, x, y, H * 0.3, H * 0.06);
    const w = H * 0.26;
    const top = y - H * 0.85;
    const body = () => {
      ctx.moveTo(x - w * 0.5, top);
      ctx.bezierCurveTo(x - w * 0.4, top + H * 0.25, x - w * 1.3, y - H * 0.35, x - w * 0.9, y - H * 0.08);
      ctx.quadraticCurveTo(x, y + H * 0.04, x + w * 0.9, y - H * 0.08);
      ctx.bezierCurveTo(x + w * 1.3, y - H * 0.35, x + w * 0.4, top + H * 0.25, x + w * 0.5, top);
      ctx.closePath();
    };
    paint(ctx, body, col(color), { ink: iw, glaze: col(color, -24), edge: w * 0.4 });
    for (let i = 0; i < 6; i++) {
      paint(ctx, () => ctx.arc(x + (rand() - 0.5) * w * 1.2, y - H * (0.15 + rand() * 0.45), Math.max(0.6, w * 0.09), 0, TAU), col(color, -20, 0, 0.8));
    }
    paint(ctx, () => ctx.ellipse(x, top, w * 0.58, w * 0.2, 0, 0, TAU), col({ h: color.h + 330, s: 70, l: 60 }), { ink: iw });
    paint(ctx, () => ctx.ellipse(x, top + w * 0.03, w * 0.4, w * 0.11, 0, 0, TAU), col(color, -40));
    paint(ctx, () => {
      ctx.moveTo(x + w * 0.2, top - w * 0.1);
      ctx.bezierCurveTo(x + w * 0.4, top - w * 1.1, x + w * 1.4, top - w * 0.9, x + w * 1.1, top - w * 0.3);
      ctx.quadraticCurveTo(x + w * 0.7, top - w * 0.05, x + w * 0.2, top - w * 0.1);
      ctx.closePath();
    }, col(color, 8), { ink: iw });
    paint(ctx, () => ctx.ellipse(x - w * 0.42, top + w * 0.45, w * 0.06, w * 0.14, 0, 0, TAU), "rgba(190, 255, 140, 0.9)", { ink: iw * 0.5 });
  }

  // ---------- critters and oddities ----------

  function snail(ctx, x, y, s, color, U, rand) {
    const L = 0.7 * s;
    if (L < 3) return;
    const iw = inkW(s, U);
    const dir = rand() < 0.5 ? -1 : 1;
    shadowBlob(ctx, x, y, L * 0.6, L * 0.08);
    paint(ctx, () => {
      ctx.moveTo(x - dir * L * 0.55, y);
      ctx.quadraticCurveTo(x, y + L * 0.04, x + dir * L * 0.42, y);
      ctx.quadraticCurveTo(x + dir * L * 0.55, y - L * 0.26, x + dir * L * 0.32, y - L * 0.3);
      ctx.quadraticCurveTo(x, y - L * 0.12, x - dir * L * 0.55, y);
      ctx.closePath();
    }, col({ h: color.h + 160, s: 50, l: 72 }), { ink: iw });
    const hx = x + dir * L * 0.38;
    const hy = y - L * 0.28;
    [0.1, -0.16].forEach((off) => {
      const ex = hx + dir * L * (0.1 + off * 0.5);
      const ey = hy - L * 0.32;
      stroke(ctx, () => {
        ctx.moveTo(hx, hy);
        ctx.quadraticCurveTo(hx + dir * L * off, hy - L * 0.2, ex, ey);
      }, INK, Math.max(0.6, iw));
      paint(ctx, () => ctx.arc(ex, ey, L * 0.05, 0, TAU), "#fff", { ink: iw * 0.6 });
    });
    const cx = x - dir * L * 0.08;
    const cy = y - L * 0.34;
    const r = L * 0.3;
    paint(ctx, () => ctx.arc(cx, cy, r, 0, TAU), col(color), { ink: iw, glaze: col(color, -20), edge: r * 0.3 });
    stroke(ctx, () => {
      for (let k = 0; k <= 30; k++) {
        const a = k * 0.42 * dir;
        const rr = r * (0.9 - k * 0.028);
        const px = cx + Math.cos(a) * rr;
        const py = cy + Math.sin(a) * rr;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    }, INK, Math.max(0.6, iw * 0.7));
  }

  function floatingRock(ctx, x, y, s, rock, grass, U, rand) {
    const R = 5 * s;
    if (R < 4) return;
    const iw = inkW(s, U);
    const fallLen = R * (2.2 + rand() * 1.2);
    const fx = x + R * (rand() < 0.5 ? -0.45 : 0.4);
    const g = ctx.createLinearGradient(0, y, 0, y + fallLen);
    g.addColorStop(0, "rgba(170, 230, 255, 0.95)");
    g.addColorStop(1, "rgba(170, 230, 255, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(fx - R * 0.09, y);
    ctx.lineTo(fx - R * 0.2, y + fallLen);
    ctx.lineTo(fx + R * 0.2, y + fallLen);
    ctx.lineTo(fx + R * 0.09, y);
    ctx.closePath();
    ctx.fill();
    for (let k = 0; k < 4; k++) {
      const yy = y + fallLen * (0.15 + k * 0.2);
      stroke(ctx, () => {
        ctx.moveTo(fx - R * 0.05, yy);
        ctx.lineTo(fx - R * 0.06, yy + fallLen * 0.12);
      }, "rgba(255, 255, 255, 0.8)", Math.max(0.6, R * 0.03));
    }
    paint(ctx, () => {
      ctx.moveTo(x - R, y - R * 0.1);
      ctx.bezierCurveTo(x - R * 0.8, y + R * 0.5, x - R * 0.2, y + R * 1.2, x + R * 0.05, y + R * 1.35);
      ctx.bezierCurveTo(x + R * 0.3, y + R * 0.9, x + R * 0.9, y + R * 0.4, x + R, y - R * 0.1);
      ctx.closePath();
    }, col(rock), { ink: iw, glaze: col(rock, -22), edge: R * 0.3 });
    paint(ctx, () => ctx.ellipse(x, y - R * 0.12, R * 1.02, R * 0.26, 0, 0, TAU), col(grass), { ink: iw });
    const tx = x + (rand() - 0.5) * R * 0.8;
    stroke(ctx, () => {
      ctx.moveTo(tx, y - R * 0.15);
      ctx.lineTo(tx, y - R * 0.75);
    }, INK, Math.max(1, R * 0.06));
    blobUnion(ctx, [
      { x: tx, y: y - R * 0.85, r: R * 0.24 },
      { x: tx - R * 0.18, y: y - R * 0.7, r: R * 0.18 },
      { x: tx + R * 0.2, y: y - R * 0.72, r: R * 0.17 },
    ], grass, iw);
  }

  function totem(ctx, x, y, s, U, rand) {
    const H = 3.2 * s;
    if (H < 4) return;
    const iw = inkW(s, U);
    const w = H * 0.2;
    shadowBlob(ctx, x, y, w * 1.3, w * 0.25);
    const blocks = 3;
    const bh = (H * 0.86) / blocks;
    for (let i = 0; i < blocks; i++) {
      const by = y - (i + 1) * bh;
      const c = { h: (rand() * 360) | 0, s: 60, l: 62 };
      paint(ctx, () => ctx.roundRect(x - w, by, w * 2, bh, w * 0.3), col(c), { ink: iw, glaze: col(c, -20), edge: w * 0.3 });
      const eyes = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < eyes; k++) {
        const ex = x + (eyes === 1 ? 0 : (k / (eyes - 1) - 0.5) * w);
        paint(ctx, () => ctx.arc(ex, by + bh * 0.36, w * 0.2, 0, TAU), "#fff", { ink: iw * 0.7 });
        paint(ctx, () => ctx.arc(ex + w * 0.05, by + bh * 0.38, w * 0.09, 0, TAU), INK);
      }
      stroke(ctx, () => {
        ctx.moveTo(x - w * 0.45, by + bh * 0.7);
        ctx.quadraticCurveTo(x, by + bh * (rand() < 0.5 ? 0.92 : 0.55), x + w * 0.45, by + bh * 0.7);
      }, INK, Math.max(0.7, iw));
    }
    const topY = y - H * 0.86;
    [-1, 1].forEach((side) => {
      paint(ctx, () => {
        ctx.moveTo(x + side * w * 0.8, topY + bh * 0.3);
        ctx.quadraticCurveTo(x + side * w * 2.4, topY - bh * 0.3, x + side * w * 2.2, topY + bh * 0.4);
        ctx.quadraticCurveTo(x + side * w * 1.6, topY + bh * 0.2, x + side * w * 0.8, topY + bh * 0.6);
        ctx.closePath();
      }, col({ h: 45, s: 90, l: 66 }), { ink: iw });
    });
  }

  function mailbox(ctx, x, y, s, U, color, glyph) {
    const H = 1.3 * s;
    if (H < 3) return;
    const iw = inkW(s, U);
    const w = H * 0.32;
    shadowBlob(ctx, x, y, w, w * 0.2);
    stroke(ctx, () => {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - H * 0.7);
    }, INK, Math.max(1.4, H * 0.07) + iw * 2);
    stroke(ctx, () => {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - H * 0.7);
    }, col({ h: 30, s: 30, l: 50 }), Math.max(1.4, H * 0.07));
    const top = y - H;
    paint(ctx, () => {
      ctx.moveTo(x - w, y - H * 0.68);
      ctx.lineTo(x - w, top + w * 0.6);
      ctx.arc(x, top + w * 0.6, w, Math.PI, 0);
      ctx.lineTo(x + w, y - H * 0.68);
      ctx.closePath();
    }, col(color), { ink: iw, glaze: col(color, -20), edge: w * 0.3 });
    stroke(ctx, () => {
      ctx.moveTo(x + w, top + w * 0.5);
      ctx.lineTo(x + w * 1.5, top + w * 0.5);
    }, INK, Math.max(0.8, iw));
    paint(ctx, () => ctx.rect(x + w * 1.3, top + w * 0.1, w * 0.45, w * 0.35), "#ff4f9a", { ink: iw * 0.6 });
    if (glyph !== null && G.drawGlyph) {
      G.drawGlyph(ctx, glyph, x, top + w * 1.05, w * 1.1, INK);
    } else {
      paint(ctx, () => {
        const cx = x;
        const cy = top + w * 1.0;
        const r = w * 0.32;
        ctx.moveTo(cx, cy + r);
        ctx.bezierCurveTo(cx - r * 1.6, cy - r * 0.2, cx - r * 0.6, cy - r * 1.4, cx, cy - r * 0.4);
        ctx.bezierCurveTo(cx + r * 0.6, cy - r * 1.4, cx + r * 1.6, cy - r * 0.2, cx, cy + r);
        ctx.closePath();
      }, "#fff", { ink: iw * 0.6 });
    }
  }

  function glowCaps(ctx, x, y, s, U, rand) {
    const H = 0.45 * s;
    if (H < 1.5) return;
    const iw = inkW(s, U) * 0.8;
    const n = 3 + Math.floor(rand() * 4);
    const tone = rand() < 0.5 ? { h: 180, s: 95, l: 66 } : { h: 95, s: 90, l: 62 };
    const glow = ctx.createRadialGradient(x, y - H * 0.5, 0, x, y - H * 0.5, H * 2.2);
    glow.addColorStop(0, col(tone, 10, 0, 0.45));
    glow.addColorStop(1, col(tone, 10, 0, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x - H * 2.2, y - H * 2.7, H * 4.4, H * 4.4);
    for (let i = 0; i < n; i++) {
      const bx = x + (rand() - 0.5) * H * 2.2;
      const hh = H * (0.5 + rand() * 0.6);
      const r = hh * 0.42;
      stroke(ctx, () => {
        ctx.moveTo(bx, y);
        ctx.lineTo(bx, y - hh);
      }, "#fff6e0", Math.max(0.6, r * 0.3));
      paint(ctx, () => {
        ctx.moveTo(bx - r, y - hh + r * 0.2);
        ctx.quadraticCurveTo(bx, y - hh - r * 1.3, bx + r, y - hh + r * 0.2);
        ctx.closePath();
      }, col(tone), { ink: iw });
    }
  }

  function skyJelly(ctx, x, y, s, U, rand) {
    const R = 2.2 * s;
    if (R < 3) return;
    const iw = inkW(s, U) * 0.8;
    const c = rand() < 0.5 ? { h: 320, s: 80, l: 78 } : { h: 190, s: 80, l: 76 };
    for (let i = 0; i < 6; i++) {
      const sx = x + (i / 5 - 0.5) * R * 1.4;
      const wave = (rand() - 0.5) * R * 0.5;
      stroke(ctx, () => {
        ctx.moveTo(sx, y);
        ctx.bezierCurveTo(sx + wave, y + R * 0.6, sx - wave, y + R * 1.1, sx + wave * 0.5, y + R * (1.4 + rand() * 0.6));
      }, col(c, -14, 0, 0.75), Math.max(0.6, R * 0.05));
    }
    paint(ctx, () => {
      ctx.moveTo(x - R, y);
      ctx.bezierCurveTo(x - R, y - R * 1.2, x + R, y - R * 1.2, x + R, y);
      ctx.quadraticCurveTo(x, y - R * 0.25, x - R, y);
      ctx.closePath();
    }, col(c, 0, 0, 0.72), { ink: iw, glaze: col(c, -16), edge: R * 0.2 });
    paint(ctx, () => ctx.ellipse(x - R * 0.4, y - R * 0.55, R * 0.14, R * 0.24, -0.5, 0, TAU), "rgba(255, 255, 255, 0.7)");
  }

  // ---------- faces and windows ----------

  function quadPath(ctx, face, u0, v0, u1, v1) {
    const a = face(u0, v0);
    const b = face(u1, v0);
    const c = face(u1, v1);
    const d = face(u0, v1);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
  }

  function ellipsePath(ctx, face, cu, cv, ru, rv) {
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * TAU;
      const p = face(cu + Math.cos(a) * ru, cv + Math.sin(a) * rv);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
  }

  function archPath(ctx, face, u0, v0, u1, v1) {
    const r = (u1 - u0) / 2;
    const top = v1 - r;
    let p = face(u0, v0);
    ctx.moveTo(p.x, p.y);
    p = face(u1, v0);
    ctx.lineTo(p.x, p.y);
    p = face(u1, top);
    ctx.lineTo(p.x, p.y);
    for (let i = 1; i <= 10; i++) {
      const a = (i / 10) * Math.PI;
      p = face(u0 + r + Math.cos(a) * r, top + Math.sin(a) * r);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
  }

  function windowShape(ctx, face, style, u, v, w, h, glass, iw) {
    const frame = iw;
    if (style === "round") {
      const r = Math.min(w, h) / 2;
      paint(ctx, () => ellipsePath(ctx, face, u + w / 2, v + h / 2, r, r), glass, { ink: frame });
      paint(ctx, () => ellipsePath(ctx, face, u + w / 2 - r * 0.25, v + h / 2 + r * 0.25, r * 0.3, r * 0.3), "rgba(255,255,255,0.55)");
      return;
    }
    if (style === "arch") {
      paint(ctx, () => archPath(ctx, face, u, v, u + w, v + h), glass, { ink: frame });
      stroke(ctx, () => {
        const a = face(u + w / 2, v);
        const b = face(u + w / 2, v + h);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }, INK, frame * 0.7);
      return;
    }
    if (style === "slit") {
      for (let i = 0; i < 2; i++) {
        const sv = v + h * (0.2 + i * 0.42);
        paint(ctx, () => quadPath(ctx, face, u - w * 0.1, sv, u + w * 1.1, sv + h * 0.2), glass, { ink: frame });
      }
      return;
    }
    paint(ctx, () => quadPath(ctx, face, u, v, u + w, v + h), glass, { ink: frame });
    if (style === "grid") {
      stroke(ctx, () => {
        let a = face(u + w / 2, v);
        let b = face(u + w / 2, v + h);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        a = face(u, v + h / 2);
        b = face(u + w, v + h / 2);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }, INK, frame * 0.7);
    } else {
      paint(ctx, () => quadPath(ctx, face, u - w * 0.08, v - h * 0.1, u + w * 1.08, v), col({ h: 30, s: 20, l: 88 }), { ink: frame * 0.7 });
    }
    paint(ctx, () => quadPath(ctx, face, u + w * 0.12, v + h * 0.55, u + w * 0.3, v + h * 0.85), "rgba(255,255,255,0.45)");
  }

  function glassColor(rand) {
    const lit = rand() < 0.35;
    return lit ? col({ h: 48 + rand() * 20, s: 90, l: 76 }) : col({ h: 200 + rand() * 40, s: 50, l: 34 + rand() * 12 });
  }

  function glyphText(ctx, face, u, v, w, h, glyphs, color, iw) {
    const n = glyphs.length;
    const step = w / n;
    glyphs.forEach((g, i) => {
      const c = face(u + step * (i + 0.5), v + h / 2);
      const e = face(u + step * (i + 0.5) + step * 0.45, v + h / 2);
      const size = Math.max(3, Math.abs(e.x - c.x) * 1.8);
      G.drawGlyph(ctx, g, c.x, c.y, size, color);
    });
    void iw;
  }

  // ---------- shacks and buildings ----------

  function roofOnFront(ctx, view, b, iw, roofColor) {
    const { xa, side, z0, width: w, height: h } = b;
    const front = (u, v) => view.p(xa + side * u, z0, v);
    const shape = b.roofShape;
    const o = 0.3;
    if (!shape) {
      paint(ctx, () => quadPath(ctx, front, -0.1, h, w + 0.1, h + 0.35), col(b.wall, -14), { ink: iw });
      return;
    }
    if (shape === "flat") {
      const sideFace = (u, v) => view.p(xa - side * o, z0 + u, v);
      paint(ctx, () => quadPath(ctx, sideFace, -o, h, b.depth + o, h + 0.45), col(roofColor, -10), { ink: iw });
      paint(ctx, () => quadPath(ctx, front, -o, h, w + o, h + 0.45), col(roofColor), { ink: iw, glaze: col(roofColor, -20), edge: 3 * iw });
      return;
    }
    const peak = shape === "spike" ? w * 0.75 : shape === "dome" ? w * 0.5 : w * 0.32;
    const apexU = w / 2;
    const backZ = z0 + b.depth;
    const sideRoof = () => {
      const a = view.p(xa - side * o, z0, h);
      const bb = view.p(xa - side * o, backZ, h);
      const c = view.p(xa + side * apexU, backZ, h + peak);
      const d = view.p(xa + side * apexU, z0, h + peak);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(bb.x, bb.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
    };
    paint(ctx, sideRoof, col(roofColor, -12), { ink: iw, glaze: col(roofColor, -26), edge: 3 * iw });
    const outline = () => {
      let p = front(-o, h);
      ctx.moveTo(p.x, p.y);
      if (shape === "spike") {
        p = front(apexU, h + peak);
        ctx.lineTo(p.x, p.y);
        p = front(w + o, h);
        ctx.lineTo(p.x, p.y);
      } else {
        const steps = 14;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const a = Math.PI - t * Math.PI;
          const k = shape === "dome" ? Math.sin(a) : Math.pow(Math.sin(a), 0.6);
          p = front(-o + (w + o * 2) * t, h + peak * k);
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.closePath();
    };
    paint(ctx, outline, col(roofColor), { ink: iw, glaze: col(roofColor, -22), edge: 4 * iw });
    if (shape === "spike") {
      const top = front(apexU, h + peak);
      const tip = front(apexU, h + peak + w * 0.3);
      stroke(ctx, () => {
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(tip.x, tip.y);
      }, INK, iw * 1.4);
      paint(ctx, () => ctx.arc(tip.x, tip.y, Math.max(1.2, iw * 1.4), 0, TAU), col(roofColor, 20), { ink: iw * 0.7 });
    }
  }

  function shack(ctx, view, b, U) {
    const { xa, side, z0, width: w, depth: d, height: h, rand } = b;
    const front = (u, v) => view.p(xa + side * u, z0, v);
    const sideFace = (u, v) => view.p(xa, z0 + u, v);
    const s = view.p(xa, z0, 0).s;
    const iw = inkW(s, U);
    const base = view.p(xa + side * w * 0.5, z0, 0);
    shadowBlob(ctx, base.x, base.y, Math.abs(front(w, 0).x - front(0, 0).x) * 0.7, s * 0.4);
    paint(ctx, () => quadPath(ctx, sideFace, 0, 0, d, h), col(b.wall, -14, -6), { ink: iw, glaze: col(b.wall, -28), edge: 4 * iw });
    paint(ctx, () => quadPath(ctx, front, 0, 0, w, h), col(b.wall), { ink: iw, glaze: col(b.wall, -18), edge: 5 * iw });
    ctx.strokeStyle = col(b.wall, -24, 0, 0.45);
    ctx.lineWidth = Math.max(0.5, iw * 0.5);
    ctx.beginPath();
    for (let u = 0.6; u < w; u += 0.6) {
      const a = front(u, 0.05);
      const c = front(u, h - 0.05);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
    }
    ctx.stroke();
    const doorU = w * (0.28 + rand() * 0.2);
    paint(ctx, () => archPath(ctx, front, doorU, 0, doorU + 0.9, 2.05), col(b.wall, -40, 10), { ink: iw });
    const winU = doorU < w / 2 ? doorU + 1.3 : doorU - 1.5;
    if (winU > 0.15 && winU + 1 < w - 0.1) {
      windowShape(ctx, front, b.windowStyle, winU, 1.1, 0.95, 0.85, glassColor(rand), iw);
    }
    windowShape(ctx, sideFace, b.windowStyle, d * 0.4, 1.1, 0.95, 0.85, glassColor(rand), iw);
    if (b.awning) {
      const stripes = 6;
      for (let i = 0; i < stripes; i++) {
        const u0 = (w * i) / stripes;
        const u1 = (w * (i + 1)) / stripes;
        const c = i % 2 ? "#fff6fb" : col(b.awning);
        paint(ctx, () => {
          const a = view.p(xa + side * u0, z0, 2.35);
          const bb = view.p(xa + side * u1, z0, 2.35);
          const cc = view.p(xa + side * u1, z0 - 0.9, 2.0);
          const dd = view.p(xa + side * u0, z0 - 0.9, 2.0);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(bb.x, bb.y);
          ctx.lineTo(cc.x, cc.y);
          ctx.lineTo(dd.x, dd.y);
          ctx.closePath();
        }, c, { ink: iw * 0.8 });
      }
    }
    if (b.glyphs) {
      const board = shade(b.board, 0);
      paint(ctx, () => quadPath(ctx, front, w * 0.12, h - 0.75, w * 0.88, h - 0.12), col(board), { ink: iw, glaze: col(board, -20), edge: 3 * iw });
      glyphText(ctx, front, w * 0.16, h - 0.72, w * 0.68, 0.56, b.glyphs, INK, iw);
    }
    roofOnFront(ctx, view, b, iw, b.roof);
  }

  function building(ctx, view, b, U) {
    const { xa, side, z0, width: w, depth: d, height: h, rand } = b;
    const front = (u, v) => view.p(xa + side * u, z0, v);
    const facade = (u, v) => view.p(xa, z0 + u, v);
    const sNear = view.p(xa, z0, 0).s;
    const sFar = view.p(xa, z0 + d, 0).s;
    const iw = inkW((sNear + sFar) / 2, U);
    paint(ctx, () => quadPath(ctx, front, 0, 0, w, h), col(b.wall, -10), { ink: iw, glaze: col(b.wall, -24), edge: 4 * iw });
    paint(ctx, () => quadPath(ctx, facade, 0, 0, d, h), col(b.wall), { ink: iw, glaze: col(b.wall, -22), edge: 6 * iw });
    paint(ctx, () => quadPath(ctx, facade, 0, 0, d, 0.4), col(b.wall, -26), { ink: iw * 0.7 });
    const floors = Math.max(1, Math.floor((h - 3.4) / 3.1));
    const cols = Math.max(1, Math.floor((d - 0.8) / 2.5));
    const step = d / cols;
    for (let f = 0; f < floors; f++) {
      const v = 3.6 + f * 3.1;
      const balcony = b.balconies && f % 2 === 1;
      for (let c = 0; c < cols; c++) {
        const u = c * step + step * 0.25;
        windowShape(ctx, facade, b.windowStyle, u, v + 0.4, step * 0.5, 1.5, glassColor(rand), iw * 0.8);
        if (!balcony && rand() < 0.18) {
          paint(ctx, () => quadPath(ctx, facade, u + step * 0.05, v + 0.0, u + step * 0.4, v + 0.35), col({ h: 220, s: 10, l: 86 }), { ink: iw * 0.6 });
        }
      }
      if (balcony) {
        const out = 0.8;
        const rail = (u, v2) => view.p(xa - side * out, z0 + u, v2);
        paint(ctx, () => {
          const a = facade(0.2, v + 0.1);
          const bb = facade(d - 0.2, v + 0.1);
          const c = rail(d - 0.2, v + 0.1);
          const dd = rail(0.2, v + 0.1);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(bb.x, bb.y);
          ctx.lineTo(c.x, c.y);
          ctx.lineTo(dd.x, dd.y);
          ctx.closePath();
        }, col(b.wall, -20), { ink: iw * 0.7 });
        stroke(ctx, () => {
          const a = rail(0.2, v + 1.0);
          const bb = rail(d - 0.2, v + 1.0);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(bb.x, bb.y);
          for (let u = 0.2; u <= d - 0.2; u += 0.7) {
            const p = rail(u, v + 0.1);
            const q = rail(u, v + 1.0);
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
          }
        }, INK, iw * 0.7);
      }
    }
    const shopColor = col({ h: 48 + rand() * 30, s: 85, l: 78 });
    paint(ctx, () => quadPath(ctx, facade, 0.6, 0.4, d - 0.6, 2.7), shopColor, { ink: iw });
    stroke(ctx, () => {
      for (let u = 0.6 + 1.6; u < d - 0.6; u += 1.6) {
        const a = facade(u, 0.4);
        const c = facade(u, 2.7);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
      }
    }, INK, iw * 0.7);
    const awn = b.awning;
    const stripes = Math.max(3, Math.round(d / 0.9));
    for (let i = 0; i < stripes; i++) {
      const u0 = 0.3 + ((d - 0.6) * i) / stripes;
      const u1 = 0.3 + ((d - 0.6) * (i + 1)) / stripes;
      paint(ctx, () => {
        const a = facade(u0, 3.2);
        const bb = facade(u1, 3.2);
        const c = view.p(xa - side * 1.4, z0 + u1, 2.7);
        const dd = view.p(xa - side * 1.4, z0 + u0, 2.7);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(bb.x, bb.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(dd.x, dd.y);
        ctx.closePath();
      }, i % 2 ? "#fff6fb" : col(awn), { ink: iw * 0.7 });
    }
    if (b.pipe) {
      stroke(ctx, () => {
        const a = facade(d - 0.3, 0.3);
        const c = facade(d - 0.3, h - 0.2);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
      }, col({ h: 200, s: 10, l: 60 }), Math.max(1, iw * 1.6));
    }
    if (b.neon) {
      const zs = z0 + d * 0.15;
      const top = Math.min(h - 0.5, 4 + 6);
      const signFace = (u, v) => view.p(xa - side * (0.15 + u), zs, v);
      const neon = b.neon;
      ctx.save();
      ctx.shadowColor = col(neon, 10);
      ctx.shadowBlur = Math.max(4, sNear * 0.4);
      paint(ctx, () => quadPath(ctx, signFace, 0, top - 4.6, 1.0, top), col(neon, -30, 0), { ink: iw });
      ctx.restore();
      const glyphs = b.glyphs || [0, 1, 2];
      glyphs.slice(0, 3).forEach((g, i) => {
        const c = signFace(0.5, top - 0.8 - i * 1.4);
        const e = signFace(0.95, top - 0.8 - i * 1.4);
        const size = Math.max(3, Math.abs(e.x - c.x) * 1.9);
        ctx.save();
        ctx.shadowColor = col(neon, 20);
        ctx.shadowBlur = size * 0.5;
        G.drawGlyph(ctx, g, c.x, c.y, size, col(neon, 26));
        ctx.restore();
      });
    }
    roofOnFront(ctx, view, b, iw, b.roof);
    if (!b.roofShape && rand() < 0.5) {
      const tank = front(w * 0.5, h + 0.35);
      const r = view.p(xa, z0, 0).s * 0.8;
      paint(ctx, () => {
        ctx.rect(tank.x - r, tank.y - r * 1.6, r * 2, r * 1.6);
      }, col({ h: 200, s: 14, l: 72 }), { ink: iw });
    }
  }

  function tower(ctx, x, y, hPx, wPx, color, rand, U) {
    const iw = U * 1.1;
    paint(ctx, () => {
      ctx.moveTo(x - wPx / 2, y);
      ctx.lineTo(x - wPx * 0.35, y - hPx);
      ctx.lineTo(x + wPx * 0.35, y - hPx);
      ctx.lineTo(x + wPx / 2, y);
      ctx.closePath();
    }, col(color), { ink: iw, glaze: col(color, -14), edge: wPx * 0.2 });
    const r = wPx * (0.5 + rand() * 0.4);
    paint(ctx, () => ctx.ellipse(x, y - hPx - r * 0.3, r, r * 0.7, 0, 0, TAU), col(color, 8), { ink: iw });
    stroke(ctx, () => {
      ctx.moveTo(x, y - hPx - r);
      ctx.lineTo(x, y - hPx - r - hPx * 0.18);
    }, INK, iw);
    paint(ctx, () => ctx.arc(x, y - hPx - r - hPx * 0.18, Math.max(1.5, wPx * 0.08), 0, TAU), col({ h: 330, s: 90, l: 70 }), { ink: iw * 0.7 });
    ctx.fillStyle = col(color, 22, 0, 0.7);
    for (let i = 1; i < 8; i++) {
      ctx.fillRect(x - wPx * 0.2, y - (hPx * i) / 8, wPx * 0.4, Math.max(1, hPx * 0.015));
    }
  }

  // ---------- street furniture ----------

  function pole(ctx, view, x, z, profile, U, shown) {
    const h = 7;
    const base = view.p(x, z, 0);
    const top = view.p(x, z, h);
    const s = base.s;
    const iw = inkW(s, U);
    const w = Math.max(1, s * 0.13);
    const c = shown ? profile.poleColor : { h: 30, s: 25, l: 48 };
    paint(ctx, () => {
      ctx.moveTo(base.x - w, base.y);
      ctx.lineTo(top.x - w * 0.7, top.y);
      ctx.lineTo(top.x + w * 0.7, top.y);
      ctx.lineTo(base.x + w, base.y);
      ctx.closePath();
    }, col(c), { ink: iw });
    const arm = s * 0.9;
    const armY = top.y + s * 0.5;
    paint(ctx, () => ctx.rect(top.x - arm, armY - s * 0.07, arm * 2, Math.max(1, s * 0.14)), col(c, -12), { ink: iw * 0.8 });
    [-0.8, 0.8].forEach((k) => {
      paint(ctx, () => ctx.rect(top.x + arm * k - s * 0.05, armY - s * 0.25, s * 0.1, s * 0.2), "#fff6fb", { ink: iw * 0.6 });
    });
    if (shown) {
      const t = profile.poleTop;
      const r = Math.max(1.5, s * 0.22);
      const ty = top.y - r;
      if (t === "ball") paint(ctx, () => ctx.arc(top.x, ty, r, 0, TAU), col(profile.pathLineColor), { ink: iw });
      if (t === "ring") {
        stroke(ctx, () => ctx.arc(top.x, ty - r * 0.3, r * 1.1, 0, TAU), INK, iw + Math.max(1.5, s * 0.06));
        stroke(ctx, () => ctx.arc(top.x, ty - r * 0.3, r * 1.1, 0, TAU), col(profile.pathLineColor), Math.max(1.5, s * 0.06));
      }
      if (t === "fork") {
        stroke(ctx, () => {
          ctx.moveTo(top.x, top.y);
          ctx.lineTo(top.x - r, top.y - r * 2.2);
          ctx.moveTo(top.x, top.y);
          ctx.lineTo(top.x + r, top.y - r * 2.2);
          ctx.moveTo(top.x, top.y);
          ctx.lineTo(top.x, top.y - r * 2.6);
        }, INK, Math.max(1.2, iw * 1.3));
      }
    }
    return [
      { x: top.x - arm * 0.8, y: armY - s * 0.25 },
      { x: top.x + arm * 0.8, y: armY - s * 0.25 },
    ];
  }

  function wires(ctx, points, U) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(0.7, U * 1.1);
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1][k];
        const b = points[i][k];
        const sag = Math.abs(a.x - b.x) * 0.08 + Math.abs(a.y - b.y) * 0.2 + U * 4;
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + sag, b.x, b.y);
      }
      ctx.stroke();
    }
  }

  function sign(ctx, view, x, z, profile, U) {
    const base = view.p(x, z, 0);
    const s = base.s;
    const iw = inkW(s, U);
    const top = view.p(x, z, 2.5);
    const r = s * 0.5;
    stroke(ctx, () => {
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y + r);
    }, INK, Math.max(1.5, s * 0.08) + iw);
    stroke(ctx, () => {
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y + r);
    }, col(profile.poleColor), Math.max(1, s * 0.08));
    const cy = top.y;
    const shape = profile.signShape;
    const build = () => {
      if (shape === "circle") ctx.arc(top.x, cy, r, 0, TAU);
      else if (shape === "diamond") {
        ctx.moveTo(top.x, cy - r * 1.15);
        ctx.lineTo(top.x + r * 1.15, cy);
        ctx.lineTo(top.x, cy + r * 1.15);
        ctx.lineTo(top.x - r * 1.15, cy);
        ctx.closePath();
      } else if (shape === "triangle") {
        ctx.moveTo(top.x, cy - r * 1.2);
        ctx.lineTo(top.x + r * 1.2, cy + r * 0.85);
        ctx.lineTo(top.x - r * 1.2, cy + r * 0.85);
        ctx.closePath();
      } else {
        ctx.moveTo(top.x - r * 1.5, cy - r * 0.6);
        ctx.lineTo(top.x + r * 1.5, cy - r * 0.6);
        ctx.lineTo(top.x + r * 1.2, cy + r * 0.6);
        ctx.lineTo(top.x - r * 1.5, cy + r * 0.6);
        ctx.closePath();
      }
    };
    paint(ctx, build, col(profile.accentColor), { ink: iw * 1.2, glaze: col(profile.accentColor, -20), edge: r * 0.3 });
    const glyphInk = profile.accentColor.l > 62 ? INK : "#fff6fb";
    G.drawGlyph(ctx, profile.signGlyph, top.x, cy + (shape === "triangle" ? r * 0.1 : 0), r * 1.3, glyphInk);
  }

  function fencePiece(ctx, view, x, z0, z1, profile, U) {
    const style = profile.fence;
    const c = profile.poleColor;
    const a = view.p(x, z0, 0);
    const iw = inkW(a.s, U);
    if (style === "wall") {
      const face = (u, v) => view.p(x, z0 + u, v);
      paint(ctx, () => quadPath(ctx, face, 0, 0, z1 - z0, 0.9), col(c, -6), { ink: iw, glaze: col(c, -24), edge: 3 * iw });
      stroke(ctx, () => {
        const p = face(0, 0.45);
        const q = face(z1 - z0, 0.45);
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        for (let u = 0.6; u < z1 - z0; u += 1.2) {
          const m = face(u, 0);
          const n = face(u, 0.45);
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(n.x, n.y);
          const m2 = face(u + 0.6, 0.45);
          const n2 = face(u + 0.6, 0.9);
          ctx.moveTo(m2.x, m2.y);
          ctx.lineTo(n2.x, n2.y);
        }
      }, col(c, -30, 0, 0.7), iw * 0.6);
      return;
    }
    const posts = [];
    for (let z = z0; z <= z1 + 0.01; z += 2.4) posts.push([view.p(x, z, 0), view.p(x, z, 1.15)]);
    posts.forEach(([b, t]) => {
      stroke(ctx, () => {
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(t.x, t.y);
      }, INK, Math.max(1.4, b.s * 0.12) + iw);
      stroke(ctx, () => {
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(t.x, t.y);
      }, col(c), Math.max(1, b.s * 0.12));
    });
    for (let i = 1; i < posts.length; i++) {
      const p = posts[i - 1][1];
      const q = posts[i][1];
      if (style === "chain") {
        stroke(ctx, () => {
          ctx.moveTo(p.x, p.y);
          ctx.quadraticCurveTo((p.x + q.x) / 2, (p.y + q.y) / 2 + Math.abs(p.y - posts[i - 1][0].y) * 0.3, q.x, q.y);
        }, INK, Math.max(0.8, iw * 0.9));
      } else {
        [0, 0.45].forEach((k) => {
          const pb = posts[i - 1][0];
          const qb = posts[i][0];
          stroke(ctx, () => {
            ctx.moveTo(p.x + (pb.x - p.x) * k, p.y + (pb.y - p.y) * k);
            ctx.lineTo(q.x + (qb.x - q.x) * k, q.y + (qb.y - q.y) * k);
          }, col(c, -10), Math.max(1, iw * 1.1));
        });
      }
    }
  }

  function bunting(ctx, a, b, profile, U, rand) {
    const style = profile.banner;
    const sag = Math.abs(b.x - a.x) * 0.08 + U * 6;
    const at = (t) => ({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * sag,
    });
    stroke(ctx, () => {
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + sag * 2, b.x, b.y);
    }, INK, Math.max(0.8, U));
    const n = 12;
    const span = Math.abs(b.x - a.x) / n;
    const size = Math.max(3, span * 0.7);
    const palette = [profile.accentColor, shade(profile.accentColor, 18), { h: (profile.accentColor.h + 180) % 360, s: 70, l: 70 }];
    for (let i = 1; i < n; i++) {
      const p = at(i / n);
      const c = palette[i % palette.length];
      if (style === "flags") {
        paint(ctx, () => {
          ctx.moveTo(p.x - size / 2, p.y);
          ctx.lineTo(p.x + size / 2, p.y);
          ctx.lineTo(p.x, p.y + size * 1.1);
          ctx.closePath();
        }, col(c), { ink: Math.max(0.6, U * 0.8) });
      } else if (style === "lanterns") {
        ctx.save();
        ctx.shadowColor = col(c, 20);
        ctx.shadowBlur = size;
        paint(ctx, () => ctx.ellipse(p.x, p.y + size * 0.6, size * 0.45, size * 0.6, 0, 0, TAU), col(c, 12), { ink: Math.max(0.6, U * 0.8) });
        ctx.restore();
      } else {
        stroke(ctx, () => {
          ctx.moveTo(p.x, p.y);
          ctx.bezierCurveTo(p.x + size * 0.4, p.y + size * 0.6, p.x - size * 0.4, p.y + size * 1.1, p.x + size * 0.2, p.y + size * 1.8);
        }, col(c), Math.max(1, size * 0.28));
      }
    }
    void rand;
  }

  function barrel(ctx, x, y, s, color, U) {
    const w = s * 0.32;
    const h = s * 0.9;
    const iw = inkW(s, U);
    shadowBlob(ctx, x, y, w * 1.3, w * 0.3);
    paint(ctx, () => {
      ctx.moveTo(x - w, y);
      ctx.quadraticCurveTo(x - w * 1.25, y - h / 2, x - w, y - h);
      ctx.lineTo(x + w, y - h);
      ctx.quadraticCurveTo(x + w * 1.25, y - h / 2, x + w, y);
      ctx.closePath();
    }, col(color), { ink: iw, glaze: col(color, -22), edge: w * 0.4 });
    stroke(ctx, () => {
      ctx.moveTo(x - w * 1.18, y - h * 0.32);
      ctx.lineTo(x + w * 1.18, y - h * 0.32);
      ctx.moveTo(x - w * 1.18, y - h * 0.68);
      ctx.lineTo(x + w * 1.18, y - h * 0.68);
    }, INK, iw * 0.8);
  }

  function crate(ctx, x, y, s, U) {
    const w = s * 0.7;
    const iw = inkW(s, U);
    const c = { h: 32, s: 50, l: 62 };
    shadowBlob(ctx, x, y, w * 0.8, w * 0.12);
    paint(ctx, () => ctx.rect(x - w / 2, y - w, w, w), col(c), { ink: iw, glaze: col(c, -20), edge: w * 0.12 });
    stroke(ctx, () => {
      ctx.moveTo(x - w / 2, y - w);
      ctx.lineTo(x + w / 2, y);
      ctx.moveTo(x + w / 2, y - w);
      ctx.lineTo(x - w / 2, y);
    }, col(c, -26), iw * 0.8);
  }

  function bench(ctx, x, y, s, color, U) {
    const w = s * 1.6;
    const iw = inkW(s, U);
    shadowBlob(ctx, x, y, w * 0.6, s * 0.1);
    [-0.4, 0.4].forEach((k) => {
      stroke(ctx, () => {
        ctx.moveTo(x + w * k, y);
        ctx.lineTo(x + w * k, y - s * 0.45);
      }, INK, Math.max(1.2, s * 0.06));
    });
    paint(ctx, () => ctx.rect(x - w / 2, y - s * 0.52, w, s * 0.1), col(color), { ink: iw });
    paint(ctx, () => ctx.rect(x - w / 2, y - s * 0.95, w, s * 0.22), col(color, 8), { ink: iw });
  }

  function hoverCar(ctx, x, y, s, color, U, rand) {
    const w = s * 1.9;
    const h = s * 0.85;
    const lift = s * 0.38;
    const iw = inkW(s, U);
    const glow = ctx.createRadialGradient(x, y, 0, x, y, w * 0.7);
    glow.addColorStop(0, "rgba(95, 242, 255, 0.55)");
    glow.addColorStop(1, "rgba(95, 242, 255, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.7, w * 0.18, 0, 0, TAU);
    ctx.fill();
    const by = y - lift;
    paint(ctx, () => ctx.ellipse(x, by - h * 0.9, w * 0.3, h * 0.42, 0, Math.PI, TAU), "rgba(190, 240, 255, 0.85)", { ink: iw });
    paint(ctx, () => {
      ctx.moveTo(x - w / 2, by - h * 0.25);
      ctx.quadraticCurveTo(x - w / 2, by - h, x - w * 0.2, by - h * 0.95);
      ctx.lineTo(x + w * 0.2, by - h * 0.95);
      ctx.quadraticCurveTo(x + w / 2, by - h, x + w / 2, by - h * 0.25);
      ctx.quadraticCurveTo(x, by + h * 0.12, x - w / 2, by - h * 0.25);
      ctx.closePath();
    }, col(color), { ink: iw, glaze: col(color, -22), edge: h * 0.2 });
    [-1, 1].forEach((k) => {
      ctx.save();
      ctx.shadowColor = "#ff2d87";
      ctx.shadowBlur = s * 0.3;
      paint(ctx, () => ctx.ellipse(x + k * w * 0.34, by - h * 0.5, w * 0.08, h * 0.1, 0, 0, TAU), "#ff5a8a", { ink: iw * 0.7 });
      ctx.restore();
    });
    void rand;
  }

  function stall(ctx, x, y, s, color, U, rand) {
    const w = s * 2.6;
    const iw = inkW(s, U);
    shadowBlob(ctx, x, y, w * 0.6, s * 0.15);
    [-0.46, 0.46].forEach((k) => {
      stroke(ctx, () => {
        ctx.moveTo(x + w * k, y);
        ctx.lineTo(x + w * k, y - s * 2.3);
      }, INK, Math.max(1.2, s * 0.07));
    });
    const wood = { h: 30, s: 45, l: 58 };
    paint(ctx, () => ctx.rect(x - w / 2, y - s * 0.95, w, s * 0.95), col(wood), { ink: iw, glaze: col(wood, -20), edge: s * 0.1 });
    for (let i = 0; i < 7; i++) {
      const fx = x - w * 0.4 + (i / 6) * w * 0.8;
      const fruit = { h: rand() * 360, s: 80, l: 62 };
      paint(ctx, () => ctx.arc(fx, y - s * 1.05, s * 0.14, 0, TAU), col(fruit), { ink: iw * 0.7 });
    }
    const stripes = 6;
    for (let i = 0; i < stripes; i++) {
      const x0 = x - w * 0.55 + (i / stripes) * w * 1.1;
      const x1 = x - w * 0.55 + ((i + 1) / stripes) * w * 1.1;
      paint(ctx, () => {
        ctx.moveTo(x0, y - s * 2.3);
        ctx.lineTo(x1, y - s * 2.3);
        ctx.quadraticCurveTo((x0 + x1) / 2, y - s * 1.85, x0, y - s * 2.0);
        ctx.closePath();
      }, i % 2 ? "#fff6fb" : col(color), { ink: iw * 0.8 });
      paint(ctx, () => ctx.rect(x0, y - s * 2.75, x1 - x0, s * 0.45), i % 2 ? "#fff6fb" : col(color), { ink: iw * 0.8 });
    }
  }

  function cafe(ctx, x, y, s, color, U) {
    const iw = inkW(s, U);
    shadowBlob(ctx, x, y, s * 0.8, s * 0.12);
    stroke(ctx, () => {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - s * 2.3);
    }, INK, Math.max(1, s * 0.05));
    paint(ctx, () => ctx.ellipse(x, y - s * 0.75, s * 0.5, s * 0.12, 0, 0, TAU), "#fff6fb", { ink: iw });
    stroke(ctx, () => {
      ctx.moveTo(x, y - s * 0.75);
      ctx.lineTo(x, y);
    }, INK, Math.max(1, s * 0.05));
    paint(ctx, () => {
      ctx.moveTo(x - s * 1.1, y - s * 2.0);
      ctx.quadraticCurveTo(x, y - s * 2.9, x + s * 1.1, y - s * 2.0);
      ctx.quadraticCurveTo(x, y - s * 2.15, x - s * 1.1, y - s * 2.0);
      ctx.closePath();
    }, col(color), { ink: iw, glaze: col(color, -20), edge: s * 0.15 });
  }

  // ---------- aliens and ships ----------

  function alien(ctx, x, y, s, a, U) {
    const hM = (HEIGHT[a.profile.alienHeight] || 1.4) * (a.scale || 1);
    const hp = hM * s;
    if (hp < 3) return;
    shadowBlob(ctx, x, y, hp * 0.3, hp * 0.06);
    const sprite = G.alienSprite(a.profile.alienSpecies, a.color, a.variant || 0, a.pose || 0);
    if (!sprite) {
      paint(ctx, () => ctx.ellipse(x, y - hp * 0.45, hp * 0.3, hp * 0.45, 0, 0, TAU), a.color === "blue" ? "#5b8cff" : "#ff6fae", { ink: inkW(s, U) });
      return;
    }
    const k = hp / sprite.footY;
    ctx.save();
    ctx.translate(x, y);
    if (a.tilt) ctx.rotate(a.tilt);
    if (a.flip) ctx.scale(-1, 1);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sprite.canvas, -sprite.centerX * k, -sprite.footY * k, sprite.canvas.width * k, sprite.canvas.height * k);
    ctx.restore();
  }

  const shipCache = new Map();
  function ship(ctx, x, y, size, name, tilt) {
    if (!shipCache.has(name)) {
      const img = G.assetImage(name);
      let canvas = null;
      if (img) {
        const t = 5;
        const base = document.createElement("canvas");
        base.width = img.naturalWidth + t * 2;
        base.height = img.naturalHeight + t * 2;
        const bctx = base.getContext("2d");
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU;
          bctx.drawImage(img, t + Math.cos(a) * t, t + Math.sin(a) * t);
        }
        bctx.globalCompositeOperation = "source-in";
        bctx.fillStyle = INK;
        bctx.fillRect(0, 0, base.width, base.height);
        bctx.globalCompositeOperation = "source-over";
        bctx.drawImage(img, t, t);
        canvas = base;
      }
      shipCache.set(name, canvas);
    }
    const canvas = shipCache.get(name);
    if (!canvas) return;
    const k = size / canvas.width;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt || 0);
    ctx.drawImage(canvas, (-canvas.width * k) / 2, (-canvas.height * k) / 2, canvas.width * k, canvas.height * k);
    ctx.restore();
  }

  G.ink = { INK, TAU, clamp, col, mixC, shade, inkW, paint, stroke, leafPath, blobUnion, quadPath };
  G.props = {
    bush,
    tree,
    palm,
    mushroom,
    tentacle,
    crystal,
    fern,
    boulder,
    tuft,
    flower,
    shack,
    building,
    tower,
    pole,
    wires,
    sign,
    fencePiece,
    bunting,
    barrel,
    crate,
    bench,
    hoverCar,
    stall,
    cafe,
    alien,
    ship,
    eyestalk,
    bulb,
    spiralFern,
    balloonPod,
    jellyTree,
    tubeCoral,
    cottonTree,
    pitcher,
    snail,
    floatingRock,
    totem,
    mailbox,
    glowCaps,
    skyJelly,
  };
})(window.AlienGuessr = window.AlienGuessr || {});
