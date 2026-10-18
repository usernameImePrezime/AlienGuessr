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
    if (G.wc && G.wc.active()) {
      G.wc.paint(ctx, build, fill, o);
      return;
    }
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
    if (color === INK && G.wc && G.wc.active()) {
      G.wc.line(ctx, build, width);
      return;
    }
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

  function blobUnion(ctx, blobs, color, iw, o) {
    const opts = o || {};
    const wc = G.wc && G.wc.active();
    if (wc) {
      blobs.forEach((b) => G.wc.line(ctx, () => ctx.arc(b.x, b.y, b.r + iw * 0.45, 0, TAU), iw * 1.7));
    } else {
      ctx.fillStyle = INK;
      blobs.forEach((b) => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + iw, 0, TAU);
        ctx.fill();
      });
    }
    let l = Infinity;
    let r = -Infinity;
    let t = Infinity;
    let btm = -Infinity;
    ctx.beginPath();
    blobs.forEach((b) => {
      ctx.moveTo(b.x + b.r, b.y);
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      l = Math.min(l, b.x - b.r);
      r = Math.max(r, b.x + b.r);
      t = Math.min(t, b.y - b.r);
      btm = Math.max(btm, b.y + b.r);
    });
    ctx.save();
    ctx.clip();
    ctx.fillStyle = col(color, -15, 6);
    if (wc) ctx.globalAlpha = 0.92;
    ctx.fillRect(l - 2, t - 2, r - l + 4, btm - t + 4);
    ctx.globalAlpha = 1;
    ctx.fillStyle = col(color);
    blobs.forEach((b) => {
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.1, b.y - b.r * 0.17, b.r * 0.9, 0, TAU);
      ctx.fill();
    });
    ctx.fillStyle = col(color, 11, -4, 0.75);
    blobs.forEach((b) => {
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.36, b.r * 0.4, 0, TAU);
      ctx.fill();
    });
    ctx.lineCap = "round";
    ctx.strokeStyle = col(color, 28, -10, 0.85);
    blobs.forEach((b) => {
      if (b.r < 3) return;
      ctx.lineWidth = Math.max(0.8, b.r * 0.09);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.76, Math.PI * 1.12, Math.PI * 1.42);
      ctx.stroke();
    });
    if (!opts.smooth) {
      ctx.strokeStyle = col(color, -26, 8, 0.6);
      blobs.forEach((b, i) => {
        if (b.r < 5) return;
        ctx.lineWidth = Math.max(0.6, b.r * 0.05);
        const sx = b.x + b.r * (i % 2 ? 0.3 : -0.05);
        const sy = b.y + b.r * (i % 2 ? 0.05 : 0.32);
        ctx.beginPath();
        ctx.arc(sx, sy, b.r * 0.16, Math.PI * 0.15, Math.PI * 0.85);
        ctx.moveTo(sx + b.r * 0.42, sy - b.r * 0.12);
        ctx.arc(sx + b.r * 0.28, sy - b.r * 0.12, b.r * 0.14, 0, Math.PI * 0.85);
        ctx.stroke();
      });
    }
    if (wc) G.wc.texture(ctx, l - 2, t - 2, r - l + 4, btm - t + 4, 0.6);
    ctx.restore();
  }

  function shadowBlob(ctx, x, y, rx, ry) {
    const light = G.light || { dx: 0, dy: 0 };
    const stretch = 1 + Math.abs(light.dx) * 0.6;
    ctx.fillStyle = "rgba(27, 16, 51, 0.22)";
    ctx.beginPath();
    ctx.ellipse(x + light.dx * rx * 0.55, y + light.dy * ry * 0.5, rx * stretch, ry * (1 + Math.max(0, light.dy) * 0.4), 0, 0, TAU);
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
    const iw = inkW(s, U);
    blobUnion(ctx, blobs, color, iw);
    const belly = blobs[Math.floor(blobs.length / 2)] || blobs[0];
    paint(ctx, () => ctx.ellipse(belly.x, belly.y + belly.r * 0.25, belly.r * 0.7, belly.r * 0.35, 0, 0, TAU), col(color, -14), { ink: iw * 0.55 });
    if (r0 > 6 && rand() < 0.4) {
      const berry = rand() < 0.5 ? { h: 340, s: 85, l: 62 } : { h: 210, s: 85, l: 64 };
      const count = 3 + Math.floor(rand() * 4);
      for (let i = 0; i < count; i++) {
        const b = blobs[i % blobs.length];
        const a = rand() * TAU;
        const bx = b.x + Math.cos(a) * b.r * 0.5;
        const by = b.y + Math.sin(a) * b.r * 0.5;
        const br = Math.max(1, r0 * 0.07);
        paint(ctx, () => ctx.arc(bx, by, br, 0, TAU), col(berry), { ink: iw * 0.7 });
        paint(ctx, () => ctx.arc(bx - br * 0.35, by - br * 0.35, br * 0.3, 0, TAU), "rgba(255, 255, 255, 0.85)");
      }
    }
  }

  function tree(ctx, x, y, s, h, color, trunk, rand, U) {
    const H = h * s;
    if (H < 2) return;
    const iw = Math.max(1.5, inkW(s, U));
    const flip = rand() < 0.5 ? -1 : 1;
    const kind = Math.floor(rand() * 3);
    const tx = x;
    const ty = y - H * 0.46;
    paint(ctx, () => {
      ctx.moveTo(x - H * 0.045, y);
      ctx.lineTo(tx - H * 0.03, ty + H * 0.16);
      ctx.lineTo(tx + H * 0.03, ty + H * 0.16);
      ctx.lineTo(x + H * 0.045, y);
      ctx.closePath();
    }, col(trunk), { ink: iw });
    const crown = () => {
      ctx.beginPath();
      if (kind === 0) {
        ctx.moveTo(tx - H * 0.34, ty + H * 0.08);
        ctx.quadraticCurveTo(tx - H * 0.38, ty - H * 0.22, tx - H * 0.08, ty - H * 0.34);
        ctx.quadraticCurveTo(tx, ty - H * 0.48, tx + H * 0.12, ty - H * 0.32);
        ctx.quadraticCurveTo(tx + H * 0.4, ty - H * 0.2, tx + H * 0.32, ty + H * 0.08);
        ctx.quadraticCurveTo(tx, ty + H * 0.16, tx - H * 0.34, ty + H * 0.08);
        ctx.closePath();
      } else if (kind === 1) {
        ctx.moveTo(tx, ty + H * 0.12);
        ctx.bezierCurveTo(tx - flip * H * 0.52, ty - H * 0.02, tx - flip * H * 0.28, ty - H * 0.52, tx, ty - H * 0.28);
        ctx.bezierCurveTo(tx + flip * H * 0.28, ty - H * 0.52, tx + flip * H * 0.52, ty - H * 0.02, tx, ty + H * 0.12);
        ctx.closePath();
      } else {
        ctx.moveTo(tx + H * 0.26, ty + H * 0.02);
        ctx.arc(tx, ty + H * 0.02, H * 0.26, 0, TAU);
        ctx.moveTo(tx + flip * H * 0.12 + H * 0.18, ty - H * 0.22);
        ctx.arc(tx + flip * H * 0.12, ty - H * 0.22, H * 0.18, 0, TAU);
      }
    };
    paint(ctx, crown, col(color), { ink: iw });
    paint(ctx, () => ctx.ellipse(tx - flip * H * 0.06, ty - H * 0.2, H * 0.11, H * 0.07, -0.5, 0, TAU), col(color, 16), { ink: iw * 0.6 });
    paint(ctx, () => ctx.ellipse(tx + flip * H * 0.05, ty + H * 0.02, H * 0.14, H * 0.06, 0.2, 0, TAU), col(color, -16), { ink: iw * 0.55 });
    paint(ctx, () => ctx.arc(tx + flip * H * 0.1, ty - H * 0.08, Math.max(1.2, H * 0.035), 0, TAU), col(color, 22), { ink: iw * 0.45 });
  }

  function blossom(ctx, x, y, r, hue, iw) {
    ctx.fillStyle = col({ h: hue, s: 88, l: 72 });
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      ctx.moveTo(x + Math.cos(a) * r + r * 0.6, y + Math.sin(a) * r);
      ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.6, 0, TAU);
    }
    ctx.fill();
    stroke(ctx, () => {
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU;
        ctx.moveTo(x + Math.cos(a) * r + r * 0.6, y + Math.sin(a) * r);
        ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.6, 0, TAU);
      }
    }, INK, Math.max(0.5, iw * 0.4));
    ctx.fillStyle = hue === 48 ? "#ff5fa8" : "#ffd84a";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, 0, TAU);
    ctx.fill();
  }

  function googly(ctx, x, y, r, rand, iw) {
    if (r < 1.2) return;
    paint(ctx, () => ctx.arc(x, y, r, 0, TAU), "#fffdf8", { ink: Math.max(0.6, iw * 0.6) });
    const a = rand() * TAU;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.42, y + Math.sin(a) * r * 0.42, r * 0.48, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.42 - r * 0.15, y + Math.sin(a) * r * 0.42 - r * 0.15, r * 0.14, 0, TAU);
    ctx.fill();
  }

  function tube(ctx, build, w, color, iw) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = G.wc && G.wc.active() ? (G.wc.patternFor(ctx, "graphite")) : INK;
    ctx.lineWidth = w + iw * 1.6;
    ctx.beginPath();
    build();
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.restore();
  }

  function lollipopTree(ctx, x, y, s, h, color, trunk, pop, rand, U) {
    const H = h * s;
    if (H < 3) return;
    const iw = inkW(s, U);
    const R = H * (0.24 + rand() * 0.06);
    const cy = y - H + R;
    const w = Math.max(1, H * 0.035);
    shadowBlob(ctx, x, y, R * 0.7, R * 0.14);
    const stick = () => ctx.rect(x - w, cy, w * 2, y - cy);
    paint(ctx, stick, "#fff4e6", { ink: iw * 0.9 });
    ctx.save();
    ctx.beginPath();
    stick();
    ctx.clip();
    ctx.strokeStyle = col(pop, -6);
    ctx.lineWidth = w * 0.9;
    ctx.beginPath();
    for (let yy = cy; yy < y + w * 3; yy += w * 3) {
      ctx.moveTo(x - w * 1.5, yy + w * 1.4);
      ctx.lineTo(x + w * 1.5, yy - w * 1.4);
    }
    ctx.stroke();
    ctx.restore();
    const disc = () => ctx.arc(x, cy, R, 0, TAU);
    paint(ctx, disc, col(color, 6));
    ctx.save();
    ctx.beginPath();
    disc();
    ctx.clip();
    const spin = rand() < 0.5 ? 1 : -1;
    const swirl = () => {
      for (let t = 0; t < 1; t += 0.02) {
        const a = t * TAU * 2.6 * spin;
        const rr = R * t * 1.05;
        if (t === 0) ctx.moveTo(x, cy);
        else ctx.lineTo(x + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
    };
    ctx.beginPath();
    swirl();
    ctx.strokeStyle = col(pop, 4);
    ctx.lineWidth = R * 0.24;
    ctx.stroke();
    stroke(ctx, swirl, INK, Math.max(0.5, iw * 0.45));
    if (G.wc && G.wc.active()) G.wc.bloom(ctx, x - R * 0.4, cy - R * 0.4, R * 0.25, "#fffaf2", 0.75);
    ctx.restore();
    stroke(ctx, disc, INK, iw);
  }

  function noodleTree(ctx, x, y, s, h, color, trunk, pop, rand, U) {
    const H = h * s;
    if (H < 3) return;
    const iw = inkW(s, U);
    const w = Math.max(1.2, H * 0.05);
    const wig = (rand() < 0.5 ? 1 : -1) * H * 0.12;
    const top = { x: x + wig * 0.4, y: y - H * 0.7 };
    shadowBlob(ctx, x, y, H * 0.22, H * 0.04);
    const trunkPath = () => {
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + wig, y - H * 0.25, x - wig, y - H * 0.45, top.x, top.y);
    };
    tube(ctx, trunkPath, w, col(trunk, 8), iw);
    const n = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.4;
      const len = H * (0.22 + rand() * 0.12);
      const ex = top.x + Math.cos(a) * len;
      const ey = top.y + Math.sin(a) * len * 0.9;
      const branch = () => {
        ctx.moveTo(top.x, top.y);
        ctx.quadraticCurveTo(top.x + Math.cos(a - 0.8) * len * 0.6, top.y + Math.sin(a - 0.8) * len * 0.6, ex, ey);
      };
      tube(ctx, branch, w * 0.6, col(trunk, 8), iw);
      const pr = H * (0.08 + rand() * 0.05);
      paint(ctx, () => ctx.arc(ex, ey, pr, 0, TAU), col(i % 2 ? pop : color, 4), { ink: iw });
      if (G.wc && G.wc.active()) G.wc.bloom(ctx, ex - pr * 0.35, ey - pr * 0.35, pr * 0.3, "#fffaf2", 0.7);
    }
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
    paint(ctx, () => ctx.ellipse(tx - rx * 0.5, ty - ry * 0.5, rx * 0.16, ry * 0.08, -0.6, 0, TAU), "rgba(255, 255, 255, 0.7)");
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
    const n = 3;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.18 + (i / (n - 1)) * 0.64);
      const len = H * (0.85 + rand() * 0.2);
      const ex = x + Math.cos(a) * len;
      const ey = y + Math.sin(a) * len * 0.72 + len * 0.12;
      paint(ctx, () => leafPath(ctx, x, y, ex, ey, len * 0.28, Math.cos(a) > 0 ? -0.15 : 0.15), col(color), { ink: iw });
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
    if (R > 10 && rand() < 0.06) {
      googly(ctx, x - R * 0.3, y - R * 0.45, R * 0.2, rand, iw);
      googly(ctx, x + R * 0.08, y - R * 0.5, R * 0.17, rand, iw);
    }
  }

  function tuft(ctx, x, y, s, size, color, rand, U) {
    const H = size * s;
    if (H < 1) return;
    const iw = Math.max(1, inkW(s, U));
    const n = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const dx = (i - (n - 1) / 2) * H * 0.55;
      const jitter = (rand() - 0.5) * H * 0.2;
      const tip = H * (0.85 + rand() * 0.35);
      paint(ctx, () => {
        ctx.moveTo(x + dx * 0.15, y);
        ctx.quadraticCurveTo(x + dx * 0.1, y - tip * 0.55, x + dx + jitter, y - tip);
        ctx.quadraticCurveTo(x + dx * 0.9, y - tip * 0.4, x + dx * 0.7, y);
        ctx.closePath();
      }, col(color), { ink: iw * 0.75 });
    }
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
    blobUnion(ctx, puffs, { h: color.h, s: clamp(color.s, 40, 70), l: clamp(color.l + 18, 70, 88) }, iw, { smooth: true });
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

  function polyFace(ctx, face, pts) {
    pts.forEach(([u, v], i) => {
      const p = face(u, v);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
  }

  const FRAME = "#fff4e6";

  function stain(ctx, face, u, v, w, rand) {
    if (!(G.wc && G.wc.active())) return;
    const drops = [];
    for (let k = 0; k < 3; k++) drops.push([u + w * (0.18 + k * 0.3 + (rand() - 0.5) * 0.12), 0.25 + rand() * 0.6]);
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "rgba(90, 40, 110, 0.16)";
    ctx.beginPath();
    let p = face(u + w * 0.08, v);
    ctx.moveTo(p.x, p.y);
    drops.forEach(([du, len]) => {
      const a = face(du - w * 0.06, v - len * 0.3);
      const b = face(du, v - len);
      const c = face(du + w * 0.06, v - len * 0.3);
      ctx.lineTo(a.x, a.y);
      ctx.quadraticCurveTo(b.x - (c.x - a.x) * 0.6, b.y, b.x, b.y);
      ctx.quadraticCurveTo(b.x + (c.x - a.x) * 0.6, b.y, c.x, c.y);
    });
    p = face(u + w * 0.92, v);
    ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function windowShape(ctx, face, style, u, v, w, h, glass, iw) {
    const frame = iw;
    if (style === "round") {
      const r = Math.min(w, h) / 2;
      paint(ctx, () => ellipsePath(ctx, face, u + w / 2, v + h / 2, r * 1.22, r * 1.22), FRAME, { ink: frame });
      paint(ctx, () => ellipsePath(ctx, face, u + w / 2, v + h / 2, r, r), glass, { ink: frame });
      paint(ctx, () => ellipsePath(ctx, face, u + w / 2 - r * 0.3, v + h / 2 + r * 0.3, r * 0.28, r * 0.28), "rgba(255,255,255,0.7)");
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
    const fw = Math.min(w, h) * 0.14;
    paint(ctx, () => quadPath(ctx, face, u - fw, v - fw * 1.6, u + w + fw, v + h + fw), FRAME, { ink: frame });
    paint(ctx, () => quadPath(ctx, face, u, v, u + w, v + h), glass, { ink: frame });
    paint(ctx, () => quadPath(ctx, face, u + w * 0.12, v + h * 0.14, u + w * 0.38, v + h * 0.42), "rgba(255,255,255,0.55)");
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
      paint(ctx, () => quadPath(ctx, face, u - w * 0.2, v - h * 0.22, u + w * 1.2, v - fw * 0.8), col({ h: 30, s: 20, l: 88 }), { ink: frame * 0.8 });
    }
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
    const peak = shape === "spike" ? w * 0.68 : shape === "dome" ? w * 0.42 : w * 0.26;
    const apexU = w * 0.4;
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
          const sag = 1 - 0.22 * Math.sin(t * Math.PI);
          const k = (shape === "dome" ? Math.sin(a) : Math.pow(Math.sin(a), 0.6)) * sag;
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
    for (let u = 0; u < w - 0.2; u += Math.max(1.8, w / 3)) {
      const a = front(u, 0.05);
      const c = front(u, h - 0.05);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
    }
    ctx.stroke();
    paint(ctx, () => quadPath(ctx, front, 0, 0, w, 0.3), "rgba(27, 16, 51, 0.16)");
    paint(ctx, () => quadPath(ctx, sideFace, 0, 0, d, 0.3), "rgba(27, 16, 51, 0.2)");
    const doorU = w * (0.28 + rand() * 0.2);
    const doorColor = col(b.wall, -40, 10);
    paint(ctx, () => archPath(ctx, front, doorU - 0.1, 0, doorU + 1.0, 2.2), FRAME, { ink: iw });
    paint(ctx, () => archPath(ctx, front, doorU, 0, doorU + 0.9, 2.05), doorColor, { ink: iw, glaze: col(b.wall, -55, 10), edge: 3 * iw });
    const knob = front(doorU + 0.72, 1.0);
    paint(ctx, () => ctx.arc(knob.x, knob.y, Math.max(1, s * 0.09), 0, TAU), "#ffd84a", { ink: iw * 0.7 });
    paint(ctx, () => quadPath(ctx, front, doorU - 0.25, -0.02, doorU + 1.15, 0.16), col({ h: 30, s: 12, l: 70 }), { ink: iw * 0.8 });
    if (rand() < 0.6) {
      const potU = doorU < w / 2 ? doorU + 1.35 : doorU - 0.55;
      if (potU > 0.1 && potU < w - 0.4) {
        paint(ctx, () => polyFace(ctx, front, [[potU, 0], [potU + 0.36, 0], [potU + 0.42, 0.42], [potU - 0.06, 0.42]]), col({ h: 18, s: 60, l: 55 }), { ink: iw * 0.8 });
        const petal = rand() < 0.5 ? { h: 330, s: 85, l: 68 } : { h: 50, s: 95, l: 66 };
        [[0.0, 0.62], [0.18, 0.75], [0.36, 0.6]].forEach(([du, dv]) => {
          const p = front(potU + du, dv);
          paint(ctx, () => ctx.arc(p.x, p.y, Math.max(1, s * 0.13), 0, TAU), col(petal), { ink: iw * 0.6 });
          paint(ctx, () => ctx.arc(p.x, p.y, Math.max(0.5, s * 0.05), 0, TAU), "#fff3a8");
        });
      }
    }
    const winU = doorU < w / 2 ? doorU + 1.3 : doorU - 1.5;
    if (winU > 0.15 && winU + 1 < w - 0.1) {
      stain(ctx, front, winU, 1.1, 0.95, rand);
      windowShape(ctx, front, b.windowStyle, winU, 1.1, 0.95, 0.85, glassColor(rand), iw);
    }
    stain(ctx, sideFace, d * 0.4, 1.1, 0.95, rand);
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
    const shape = b.roofShape;
    const peak = shape === "spike" ? w * 0.75 : shape === "dome" ? w * 0.5 : w * 0.32;
    roofOnFront(ctx, view, b, iw, b.roof);
    if (shape && shape !== "flat" && shape !== "dome" && rand() < 0.55) {
      const cu = w * 0.7;
      const mid = cu + 0.22;
      const roofV = h + peak * (shape === "spike"
        ? (w + 0.3 - mid) / (w / 2 + 0.3)
        : Math.pow(Math.sin(((mid + 0.3) / (w + 0.6)) * Math.PI), 0.6));
      const top = roofV + 0.9;
      const lean = (rand() - 0.5) * 0.4;
      paint(ctx, () => polyFace(ctx, front, [[cu, roofV - 0.25], [cu + 0.45, roofV - 0.25], [cu + 0.45 + lean, top], [cu + lean, top]]), col({ h: 10, s: 45, l: 52 }), {
        ink: iw, glaze: col({ h: 10, s: 45, l: 38 }), edge: 3 * iw,
      });
      paint(ctx, () => polyFace(ctx, front, [[cu - 0.08 + lean, top - 0.12 - lean * 0.2], [cu + 0.53 + lean, top - 0.12 + lean * 0.2], [cu + 0.53 + lean, top + 0.1 + lean * 0.2], [cu - 0.08 + lean, top + 0.1 - lean * 0.2]]), col({ h: 10, s: 30, l: 32 }), { ink: iw });
      const puff = front(cu + 0.22 + lean, top + 0.55);
      const pr = Math.max(1.5, s * 0.22);
      [[0, 0, 1], [0.7, -1.2, 1.25], [1.7, -2.5, 1.5]].forEach(([dx, dy, m]) => {
        paint(ctx, () => ctx.arc(puff.x + dx * pr, puff.y + dy * pr, pr * m, 0, TAU), "rgba(250, 246, 255, 0.85)", { ink: iw * 0.6 });
      });
    }
  }

  function building(ctx, view, b, U) {
    const { xa, side, z0, width: w, depth: d, height: h, rand } = b;
    const front = (u, v) => view.p(xa + side * u, z0, v);
    const facade = (u, v) => view.p(xa, z0 + u, v);
    const sNear = view.p(xa, z0, 0).s;
    const sFar = view.p(xa, z0 + d, 0).s;
    const iw = inkW((sNear + sFar) / 2, U);
    paint(ctx, () => quadPath(ctx, front, 0, 0, w, h), col(b.wall, -18), { ink: iw, glaze: col(b.wall, -30), edge: 4 * iw });
    paint(ctx, () => quadPath(ctx, facade, 0, 0, d, h), col(b.wall), { ink: iw, glaze: col(b.wall, -22), edge: 6 * iw });
    stroke(ctx, () => {
      for (let k = 1; k <= 5; k++) {
        const v = 0.55 + ((h - 1.1) * k) / 6;
        const a = facade(0.08, v);
        const c = facade(d - 0.08, v);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
      }
    }, col(b.wall, -16), Math.max(1, iw * 0.75));
    paint(ctx, () => quadPath(ctx, facade, 0, 0, d, 0.4), col(b.wall, -26), { ink: iw * 0.7 });
    paint(ctx, () => quadPath(ctx, front, 0, 0, w, 0.5), "rgba(27, 16, 51, 0.2)");
    stroke(ctx, () => {
      const a = facade(0.05, h - 0.2);
      const c = facade(0.05, 0.5);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
    }, col(b.wall, 16, -6, 0.8), Math.max(1, iw * 1.4));
    const glass = glassColor(rand);
    const floors = Math.max(1, Math.floor((h - 3.6) / 4.6));
    const cols = Math.min(2, Math.max(1, Math.floor(d / 4.4)));
    const step = d / cols;
    for (let f = 0; f < floors; f++) {
      const v = 3.8 + f * 4.6;
      const balcony = b.balconies && f % 2 === 1;
      for (let c = 0; c < cols; c++) {
        const u = c * step + step * 0.18;
        windowShape(ctx, facade, b.windowStyle, u, v + 0.35, step * 0.64, 2.15, glass, iw);
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
          const a = rail(0.2, v + 1.05);
          const bb = rail(d - 0.2, v + 1.05);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(bb.x, bb.y);
        }, INK, Math.max(1.4, iw));
      }
    }
    const shop = b.awning || b.wall;
    paint(ctx, () => quadPath(ctx, facade, 0.45, 0.35, d - 0.45, 2.85), col(shop, 8), { ink: iw });
    const doorU = d * 0.42;
    const doorW = Math.min(1.3, d * 0.22);
    paint(ctx, () => quadPath(ctx, facade, doorU, 0.35, doorU + doorW, 2.55), col(b.wall, -32), { ink: iw * 0.85 });
    const lamp = facade(Math.min(d - 0.3, doorU + doorW + 0.35), 2.35);
    paint(ctx, () => ctx.arc(lamp.x, lamp.y, Math.max(2, sNear * 0.12), 0, TAU), "#ffe56a", { ink: iw * 0.7 });
    paint(ctx, () => ctx.arc(lamp.x - sNear * 0.03, lamp.y - sNear * 0.03, Math.max(1, sNear * 0.04), 0, TAU), "#fff");
    const awn = b.awning;
    const stripes = Math.min(4, Math.max(3, Math.round(d / 2.4)));
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
    const topper = !b.roofShape || b.roofShape === "flat" ? rand() : 1;
    const r = view.p(xa, z0, 0).s * 0.8;
    const metal = col({ h: 220, s: 14, l: 78 });
    if (topper < 0.3) {
      const tank = front(w * 0.5, h + 0.35);
      paint(ctx, () => ctx.rect(tank.x - r, tank.y - r * 1.6, r * 2, r * 1.6), col({ h: 200, s: 14, l: 72 }), {
        ink: iw, glaze: col({ h: 200, s: 14, l: 56 }), edge: 3 * iw,
      });
      paint(ctx, () => ctx.ellipse(tank.x, tank.y - r * 1.6, r, r * 0.3, 0, 0, TAU), col({ h: 200, s: 14, l: 82 }), { ink: iw });
    } else if (topper < 0.6) {
      const base = front(w * 0.45, h + 0.4);
      stroke(ctx, () => {
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(base.x + r * 0.2, base.y - r * 1.2);
      }, INK, iw * 1.2);
      ctx.save();
      ctx.translate(base.x + r * 0.2, base.y - r * 1.3);
      ctx.rotate(-0.6);
      paint(ctx, () => {
        ctx.ellipse(0, 0, r * 1.3, r * 0.55, 0, 0, Math.PI);
        ctx.closePath();
      }, metal, { ink: iw, glaze: col({ h: 220, s: 14, l: 60 }), edge: 3 * iw });
      stroke(ctx, () => {
        ctx.moveTo(0, r * 0.1);
        ctx.lineTo(0, -r * 0.7);
      }, INK, iw);
      paint(ctx, () => ctx.arc(0, -r * 0.75, Math.max(1, r * 0.18), 0, TAU), "#ff4f9a", { ink: iw * 0.7 });
      ctx.restore();
    } else if (topper < 0.85) {
      const base = front(w * 0.6, h + 0.4);
      const kink = (rand() < 0.5 ? -1 : 1) * r * 0.5;
      const tip = { x: base.x + kink, y: base.y - r * 3.4 };
      stroke(ctx, () => {
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(base.x - kink * 0.3, base.y - r * 1.5);
        ctx.lineTo(tip.x, tip.y);
        ctx.moveTo(tip.x - r * 0.7, tip.y + r * 0.7);
        ctx.lineTo(tip.x + r * 0.7, tip.y + r * 1.1);
        ctx.moveTo(tip.x - r * 0.45 - kink * 0.2, tip.y + r * 1.4);
        ctx.lineTo(tip.x + r * 0.45 - kink * 0.2, tip.y + r * 1.8);
      }, INK, iw * 1.1);
      paint(ctx, () => ctx.arc(tip.x, tip.y, Math.max(1.2, r * 0.25), 0, TAU), "#5ff2ff", { ink: iw * 0.7 });
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
    const body = shown ? profile.poleBody : null;
    const wood = { h: 28, s: 42, l: 44 };
    let c = shown ? profile.poleColor : { h: 30, s: 25, l: 48 };
    if (body === "wood" || body === "crossbar") c = wood;
    if (body === "holes") c = { h: 240, s: 6, l: 74 };
    if (body === "lattice") c = { h: 250, s: 12, l: 40 };
    const shaft = () => {
      ctx.moveTo(base.x - w, base.y);
      ctx.lineTo(top.x - w * 0.7, top.y);
      ctx.lineTo(top.x + w * 0.7, top.y);
      ctx.lineTo(base.x + w, base.y);
      ctx.closePath();
    };
    const along = (t) => ({ x: base.x + (top.x - base.x) * t, y: base.y + (top.y - base.y) * t, w: w * (1 - 0.3 * t) });
    if (body === "lattice") {
      const lw = Math.max(1, s * 0.035);
      [-1, 1].forEach((k) => stroke(ctx, () => {
        ctx.moveTo(base.x + k * w * 1.3, base.y);
        ctx.lineTo(top.x + k * w * 0.5, top.y);
      }, INK, lw + iw * 0.6));
      stroke(ctx, () => {
        for (let i = 0; i < 9; i++) {
          const a = along(i / 9);
          const b = along((i + 1) / 9);
          const ka = 1.3 - (i / 9) * 0.8;
          const kb = 1.3 - ((i + 1) / 9) * 0.8;
          ctx.moveTo(a.x - w * ka, a.y);
          ctx.lineTo(b.x + w * kb, b.y);
          ctx.moveTo(a.x + w * ka, a.y);
          ctx.lineTo(b.x - w * kb, b.y);
        }
      }, col(c), Math.max(0.8, lw * 0.8));
    } else {
      const brass = { h: 36, s: 42, l: 46 };
      paint(ctx, shaft, col(body === "wood" || body === "crossbar" ? c : brass), { ink: iw });
      if (body !== "wood" && body !== "crossbar") {
        stroke(ctx, () => {
          ctx.moveTo(base.x - w * 0.15, base.y);
          ctx.lineTo(top.x - w * 0.1, top.y);
        }, col(c, 8), Math.max(1.4, w * 0.35));
      }
      if (body === "holes" && s > 6) {
        ctx.fillStyle = "rgba(40, 30, 60, 0.75)";
        for (let t = 0.1; t < 0.9; t += 0.09) {
          const p = along(t);
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.w * 0.32, Math.max(0.8, s * 0.06), 0, 0, TAU);
          ctx.fill();
        }
      } else if ((body === "wood" || body === "crossbar") && s > 6) {
        stroke(ctx, () => {
          [-0.35, 0.2].forEach((k) => {
            ctx.moveTo(base.x + w * k, base.y);
            ctx.lineTo(top.x + w * k * 0.7, top.y);
          });
        }, col(wood, -16, 0, 0.7), Math.max(0.6, s * 0.02));
      } else if (body === "tube") {
        stroke(ctx, () => {
          ctx.moveTo(base.x - w * 0.4, base.y);
          ctx.lineTo(top.x - w * 0.3, top.y);
        }, "rgba(255, 255, 255, 0.7)", Math.max(0.8, w * 0.35));
      }
    }
    const arm = s * 0.9;
    const armY = top.y + s * 0.5;
    const count = (shown && profile.insulators) || 2;
    const armAt = (y, span) => paint(ctx, () => ctx.rect(top.x - span, y - s * 0.07, span * 2, Math.max(1, s * 0.14)), col(c, -12), { ink: iw * 0.8 });
    armAt(armY, arm);
    if (body === "crossbar") armAt(armY + s * 0.8, arm * 0.75);
    const slots = count === 1 ? [0] : Array.from({ length: count }, (_, i) => -0.8 + (1.6 * i) / (count - 1));
    slots.forEach((k) => {
      const ix = top.x + arm * k;
      paint(ctx, () => ctx.rect(ix - s * 0.05, armY - s * 0.25, s * 0.1, s * 0.2), "#fff6fb", { ink: iw * 0.6 });
      if (s > 14) {
        stroke(ctx, () => {
          for (let r = 0; r < 2; r++) {
            ctx.moveTo(ix - s * 0.07, armY - s * (0.11 + r * 0.07));
            ctx.lineTo(ix + s * 0.07, armY - s * (0.11 + r * 0.07));
          }
        }, INK, Math.max(0.6, iw * 0.5));
      }
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
    const first = slots[0];
    const last = slots[slots.length - 1];
    return [
      { x: top.x + arm * first, y: armY - s * 0.25 },
      { x: top.x + arm * last, y: armY - s * (count === 1 ? 0.6 : 0.25) },
    ];
  }

  function wires(ctx, points, U) {
    const sagLine = (k) => {
      ctx.beginPath();
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1][k];
        const b = points[i][k];
        const sag = Math.abs(a.x - b.x) * 0.08 + Math.abs(a.y - b.y) * 0.2 + U * 4;
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + sag, b.x, b.y);
      }
    };
    ctx.lineCap = "round";
    ctx.strokeStyle = "#6a4a32";
    ctx.lineWidth = Math.max(1.4, U * 1.5);
    for (let k = 0; k < 2; k++) {
      sagLine(k);
      ctx.stroke();
    }
    ctx.strokeStyle = "#39f3ff";
    ctx.lineWidth = Math.max(0.7, U * 0.7);
    for (let k = 0; k < 2; k++) {
      sagLine(k);
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
        for (let u = 1.6; u < z1 - z0; u += 2.4) {
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
    for (let z = z0; z <= z1 + 0.01; z += 3.6) posts.push([view.p(x, z, 0), view.p(x, z, 1.25)]);
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
    const palette = profile.flag
      ? profile.flag.colors
      : [col(profile.accentColor), col(shade(profile.accentColor, 18)), col({ h: (profile.accentColor.h + 180) % 360, s: 70, l: 70 })];
    for (let i = 1; i < n; i++) {
      const p = at(i / n);
      const c = palette[i % palette.length];
      if (style === "flags" && profile.flag && i % 4 === 2 && size > 8) {
        G.props.drawFlag(ctx, p.x - size * 0.6, p.y, size * 1.2, size * 0.8, profile.flag, profile.provinceFlag, 0.6, Math.max(0.6, U * 0.8));
        continue;
      }
      if (style === "flags") {
        paint(ctx, () => {
          ctx.moveTo(p.x - size / 2, p.y);
          ctx.lineTo(p.x + size / 2, p.y);
          ctx.lineTo(p.x, p.y + size * 1.1);
          ctx.closePath();
        }, c, { ink: Math.max(0.6, U * 0.8) });
      } else if (style === "lanterns") {
        ctx.save();
        ctx.shadowColor = c;
        ctx.shadowBlur = size;
        paint(ctx, () => ctx.ellipse(p.x, p.y + size * 0.6, size * 0.45, size * 0.6, 0, 0, TAU), c, { ink: Math.max(0.6, U * 0.8) });
        ctx.restore();
      } else {
        stroke(ctx, () => {
          ctx.moveTo(p.x, p.y);
          ctx.bezierCurveTo(p.x + size * 0.4, p.y + size * 0.6, p.x - size * 0.4, p.y + size * 1.1, p.x + size * 0.2, p.y + size * 1.8);
        }, c, Math.max(1, size * 0.28));
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

  function hoverCar(ctx, x, y, s, color, U, rand, plateSpec) {
    const w = s * 2.15;
    const h = s * 0.72;
    const lift = s * 0.46;
    const iw = Math.max(2.2, inkW(s, U) * 1.15);
    const brass = { h: 38, s: 48, l: 52 };
    const hull = mixC(brass, color || brass, 0.35);
    const glow = ctx.createRadialGradient(x, y - lift * 0.15, 0, x, y, w * 0.55);
    glow.addColorStop(0, "rgba(57, 243, 255, 0.45)");
    glow.addColorStop(1, "rgba(57, 243, 255, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(x, y - s * 0.02, w * 0.38, Math.max(3, s * 0.1), 0, 0, TAU);
    ctx.fill();
    const by = y - lift;
    paint(ctx, () => {
      ctx.moveTo(x - w * 0.48, by - h * 0.15);
      ctx.lineTo(x - w * 0.32, by - h * 0.85);
      ctx.lineTo(x + w * 0.22, by - h * 0.85);
      ctx.lineTo(x + w * 0.5, by - h * 0.2);
      ctx.lineTo(x + w * 0.46, by + h * 0.05);
      ctx.lineTo(x - w * 0.46, by + h * 0.05);
      ctx.closePath();
    }, col(hull), { ink: iw });
    paint(ctx, () => {
      ctx.moveTo(x - w * 0.22, by - h * 0.82);
      ctx.lineTo(x - w * 0.08, by - h * 1.28);
      ctx.lineTo(x + w * 0.16, by - h * 1.28);
      ctx.lineTo(x + w * 0.28, by - h * 0.82);
      ctx.closePath();
    }, "#b7fbff", { ink: iw * 0.85 });
    stroke(ctx, () => {
      ctx.moveTo(x - w * 0.4, by - h * 0.35);
      ctx.lineTo(x + w * 0.36, by - h * 0.35);
    }, "#39f3ff", Math.max(2, iw * 0.65));
    [-1, 1].forEach((k) => {
      paint(ctx, () => ctx.arc(x + k * w * 0.34, by - h * 0.05, h * 0.16, 0, TAU), "#24160f", { ink: iw * 0.7 });
      paint(ctx, () => ctx.arc(x + k * w * 0.34, by - h * 0.05, h * 0.07, 0, TAU), col(brass, 10), { ink: iw * 0.45 });
    });
    paint(ctx, () => ctx.ellipse(x + w * 0.42, by - h * 0.48, w * 0.06, h * 0.08, 0, 0, TAU), "#ffe27a", { ink: iw * 0.5 });
    if (plateSpec && G.props.plate) G.props.plate(ctx, x - w * 0.02, by - h * 0.08, w * 0.28, plateSpec, U);
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
    const dx = -sprite.centerX * k;
    const dy = -sprite.footY * k;
    const dw = sprite.canvas.width * k;
    const dh = sprite.canvas.height * k;
    ctx.save();
    ctx.translate(x, y);
    if (a.tilt) ctx.rotate(a.tilt);
    if (a.flip) ctx.scale(-1, 1);
    ctx.imageSmoothingQuality = "high";
    ctx.shadowColor = "#3c345c";
    ctx.shadowBlur = 0;
    const halo = 1.4;
    [[halo, 0], [-halo, 0], [0, halo], [0, -halo], [halo, halo], [halo, -halo], [-halo, halo], [-halo, -halo]].forEach(([ox, oy]) => {
      ctx.shadowOffsetX = ox;
      ctx.shadowOffsetY = oy;
      ctx.drawImage(sprite.canvas, dx, dy, dw, dh);
    });
    ctx.shadowColor = "transparent";
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.drawImage(sprite.canvas, dx, dy, dw, dh);
    ctx.restore();
  }

  function ship(ctx, x, y, size, name, tilt) {
    const r = size / 2;
    if (r < 3) return;
    const pink = name.indexOf("Pink") >= 0;
    const manned = name.indexOf("manned") >= 0;
    const hull = pink ? { h: 330, s: 85, l: 70 } : { h: 220, s: 85, l: 68 };
    const iw = Math.max(1, r * 0.06);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt || 0);
    const beam = ctx.createLinearGradient(0, r * 0.2, 0, r * 1.6);
    beam.addColorStop(0, "rgba(255, 240, 150, 0.35)");
    beam.addColorStop(1, "rgba(255, 240, 150, 0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(-r * 0.35, r * 0.2);
    ctx.lineTo(-r * 0.7, r * 1.6);
    ctx.lineTo(r * 0.7, r * 1.6);
    ctx.lineTo(r * 0.35, r * 0.2);
    ctx.closePath();
    ctx.fill();
    paint(ctx, () => ctx.arc(0, -r * 0.1, r * 0.42, Math.PI, 0), "rgba(200, 250, 255, 0.85)", { ink: iw });
    if (manned) {
      paint(ctx, () => ctx.ellipse(0, -r * 0.2, r * 0.2, r * 0.24, 0, 0, TAU), pink ? "#62a0ff" : "#ff7ab6", { ink: iw * 0.8 });
      paint(ctx, () => ctx.arc(0, -r * 0.24, r * 0.09, 0, TAU), "#fff", { ink: iw * 0.6 });
      paint(ctx, () => ctx.arc(r * 0.02, -r * 0.23, r * 0.045, 0, TAU), INK);
    }
    paint(ctx, () => ctx.arc(-r * 0.18, -r * 0.3, r * 0.08, 0, TAU), "rgba(255, 255, 255, 0.8)");
    paint(ctx, () => ctx.ellipse(0, 0, r, r * 0.3, 0, 0, TAU), col(hull), { ink: iw, glaze: col(hull, -22), edge: r * 0.12 });
    paint(ctx, () => ctx.ellipse(0, r * 0.12, r * 0.5, r * 0.1, 0, 0, TAU), col(hull, -20));
    for (let i = -3; i <= 3; i++) {
      paint(ctx, () => ctx.arc(i * r * 0.26, r * 0.02, r * 0.06, 0, TAU), i % 2 ? "#ffe56b" : "#5ff2ff", { ink: iw * 0.5 });
    }
    ctx.restore();
  }

  function kitTree(ctx, x, y, s, h, color, trunk, style, U) {
    const H = Math.max(8, h * s);
    const iw = Math.max(2.6, inkW(s, U) * 1.3);
    const kind = style || "oak";
    const lean = H * 0.14;
    const top = y - H * 0.42;
    if (kind !== "cactus") paint(ctx, () => {
      ctx.moveTo(x - H * 0.08, y);
      ctx.lineTo(x - H * 0.02 + lean, top);
      ctx.lineTo(x + H * 0.06 + lean, top);
      ctx.lineTo(x + H * 0.08, y);
      ctx.closePath();
    }, col(trunk), { ink: iw });
    const fillBlob = (cx, cy, rx, ry, c) => {
      paint(ctx, () => ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU), col(c));
    };
    if (kind === "cactus") {
      paint(ctx, () => {
        ctx.moveTo(x - H * 0.12, y);
        ctx.lineTo(x - H * 0.12, top - H * 0.38);
        ctx.quadraticCurveTo(x, top - H * 0.56, x + H * 0.12, top - H * 0.38);
        ctx.lineTo(x + H * 0.12, y);
        ctx.closePath();
      }, col(color), { ink: iw });
      paint(ctx, () => {
        ctx.moveTo(x - H * 0.12, top);
        ctx.lineTo(x - H * 0.38, top);
        ctx.lineTo(x - H * 0.38, top - H * 0.28);
        ctx.quadraticCurveTo(x - H * 0.24, top - H * 0.4, x - H * 0.12, top - H * 0.22);
        ctx.closePath();
      }, col(color), { ink: iw });
      paint(ctx, () => {
        ctx.moveTo(x + H * 0.12, top - H * 0.08);
        ctx.lineTo(x + H * 0.34, top - H * 0.08);
        ctx.quadraticCurveTo(x + H * 0.44, top - H * 0.28, x + H * 0.28, top - H * 0.32);
        ctx.lineTo(x + H * 0.12, top - H * 0.2);
        ctx.closePath();
      }, col(color), { ink: iw });
      fillBlob(x + H * 0.02, top + H * 0.08, H * 0.1, H * 0.05, shade(color, -16));
      return;
    }
    if (kind === "lollipop") {
      fillBlob(x + lean * 0.4, top - H * 0.3, H * 0.42, H * 0.3, color);
      fillBlob(x + H * 0.08 + lean * 0.2, top - H * 0.08, H * 0.16, H * 0.1, shade(color, -16));
      paint(ctx, () => ctx.ellipse(x + lean * 0.4, top - H * 0.3, H * 0.42, H * 0.3, 0, 0, TAU), "rgba(0,0,0,0)", { ink: iw });
      return;
    }
    const lobes = kind === "jelly"
      ? [[0, -0.28, 0.26, 0.2], [-0.18, -0.14, 0.16, 0.14], [0.18, -0.12, 0.15, 0.13], [0.02, -0.02, 0.2, 0.12], [-0.08, -0.36, 0.12, 0.1]]
      : [[0, -0.34, 0.2, 0.16], [-0.2, -0.16, 0.16, 0.14], [0.2, -0.14, 0.15, 0.13], [-0.06, -0.22, 0.14, 0.12], [0.08, -0.06, 0.16, 0.12], [-0.12, -0.02, 0.12, 0.1], [0.16, -0.26, 0.1, 0.09]];
    lobes.forEach(([ox, oy, rx, ry], index) => {
      const bulge = index === 0 ? 1.28 : 1;
      fillBlob(x + ox * H + lean * 0.35, top + oy * H, rx * H * bulge, ry * H, color);
    });
    fillBlob(x, top + H * 0.02, H * 0.22, H * 0.08, shade(color, -16));
    paint(ctx, () => {
      ctx.moveTo(x, top - H * 0.52);
      ctx.bezierCurveTo(x - H * 0.22, top - H * 0.5, x - H * 0.4, top - H * 0.22, x - H * 0.34, top - H * 0.04);
      ctx.bezierCurveTo(x - H * 0.42, top + H * 0.12, x - H * 0.16, top + H * 0.16, x, top + H * 0.1);
      ctx.bezierCurveTo(x + H * 0.18, top + H * 0.18, x + H * 0.4, top + H * 0.04, x + H * 0.36, top - H * 0.12);
      ctx.bezierCurveTo(x + H * 0.44, top - H * 0.36, x + H * 0.16, top - H * 0.56, x, top - H * 0.52);
      ctx.closePath();
    }, "rgba(0,0,0,0)", { ink: iw });
  }

  function paneWindow(ctx, face, u, v, wu, hv, panes, glass, iw) {
    const frame = Math.min(wu, hv) * 0.14;
    paint(ctx, () => quadPath(ctx, face, u - frame, v - frame, u + wu + frame, v + hv + frame), "#f4efe4", { ink: iw });
    paint(ctx, () => quadPath(ctx, face, u, v, u + wu, v + hv), glass, { ink: iw * 0.7 });
    stroke(ctx, () => {
      const cols = panes === 3 ? 3 : 2;
      for (let i = 1; i < cols; i++) {
        const a = face(u + (wu * i) / cols, v);
        const c = face(u + (wu * i) / cols, v + hv);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
      }
      if (panes !== 3) {
        const a = face(u, v + hv / 2);
        const c = face(u + wu, v + hv / 2);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
      }
    }, INK, Math.max(1.3, iw * 0.42));
    paint(ctx, () => quadPath(ctx, face, u + wu * 0.12, v + hv * 0.58, u + wu * 0.4, v + hv * 0.86), "rgba(255,255,255,0.5)");
  }

  function kitHouse(ctx, view, b, U) {
    const side = b.side < 0 ? -1 : 1;
    const z0 = b.z0 || 0;
    const w = b.width || 4.4;
    const d = b.depth || 8;
    const h = b.height || 5.4;
    const inner = b.xa;
    const front = (u, v) => view.p(inner + side * u, z0, v);
    const wall = (u, v) => view.p(inner, z0 + u, v);
    const s = view.p(inner, z0, 0).s;
    if (s < 1.1) return;
    const iw = Math.max(2.6, inkW(s, U) * 1.15);
    const material = b.material || "wood";
    const style = b.style || "siding";
    const color = b.wall || { h: 30, s: 20, l: 70 };
    const panes = b.panes || 2;
    const glass = material === "metal" ? "#7ef0ff" : col({ h: 198, s: 42, l: 74 });
    paint(ctx, () => {
      const a = wall(0, 0);
      const b = wall(d, 0);
      const c = wall(d, h * 0.86);
      const dd = wall(0, h);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(dd.x, dd.y);
      ctx.closePath();
    }, col(color, -18), { ink: iw });
    paint(ctx, () => quadPath(ctx, wall, 0, 0, d, 0.4), col(color, -32), { ink: iw * 0.65 });
    if (material === "metal") {
      stroke(ctx, () => {
        for (let k = 1; k <= 5; k++) {
          const u = (d * k) / 6;
          const a = wall(u, 0.45);
          const c = wall(u, h - 0.2);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(c.x, c.y);
        }
      }, col(color, 18), Math.max(1.3, iw * 0.45));
      const neonA = wall(0.3, h * 0.78);
      const neonB = wall(d - 0.3, h * 0.78);
      stroke(ctx, () => {
        ctx.moveTo(neonA.x, neonA.y);
        ctx.lineTo(neonB.x, neonB.y);
      }, "#39f3ff", Math.max(2, iw * 0.7));
    } else if (material === "stone") {
      stroke(ctx, () => {
        for (let k = 1; k <= 4; k++) {
          const v = (h * k) / 5;
          const a = wall(0.15, v);
          const c = wall(d - 0.15, v);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(c.x, c.y);
        }
        for (let k = 1; k <= 4; k++) {
          const u = (d * k) / 5;
          const a = wall(u, 0.4);
          const c = wall(u, h - 0.15);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(c.x, c.y);
        }
      }, col(color, -22), Math.max(1.2, iw * 0.4));
    } else {
      stroke(ctx, () => {
        for (let k = 1; k <= 6; k++) {
          const v = 0.32 + ((h - 0.7) * k) / 7 + (k % 2 ? 0.16 : -0.06);
          const a = wall(0.15, v);
          const c = wall(d - 0.15, v);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(c.x, c.y);
        }
      }, "#4a2c16", Math.max(1.5, iw * 0.5));
    }
    const along = d > 8 ? 2 : 1;
    for (let i = 0; i < along; i++) {
      paneWindow(ctx, wall, 0.9 + i * (d * 0.4), h * 0.42, Math.min(1.3, d * 0.15), 1.3, panes, glass, iw);
    }
    const doorU = d * 0.48;
    const doorW = Math.min(1.1, d * 0.13);
    paint(ctx, () => quadPath(ctx, wall, doorU, 0, doorU + doorW, 2.2), col(color, -36), { ink: iw });
    paint(ctx, () => quadPath(ctx, wall, doorU + doorW * 0.18, 0.4, doorU + doorW * 0.82, 1.2), col(color, -20), { ink: iw * 0.55 });
    const knob = wall(doorU + doorW * 0.78, 1.05);
    paint(ctx, () => ctx.arc(knob.x, knob.y, Math.max(1.5, s * 0.065), 0, TAU), "#f2d15a", { ink: iw * 0.5 });
    if (b.awning) {
      for (let i = 0; i < 4; i++) {
        const u0 = doorU - 0.25 + ((doorW + 0.6) * i) / 4;
        const u1 = doorU - 0.25 + ((doorW + 0.6) * (i + 1)) / 4;
        paint(ctx, () => {
          const a = view.p(inner, z0 + u0, 2.4);
          const bb = view.p(inner, z0 + u1, 2.4);
          const cc = view.p(inner - side * 0.85, z0 + u1, 2.02);
          const dd = view.p(inner - side * 0.85, z0 + u0, 2.02);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(bb.x, bb.y);
          ctx.lineTo(cc.x, cc.y);
          ctx.lineTo(dd.x, dd.y);
          ctx.closePath();
        }, i % 2 ? "#fff6ea" : col(b.awning), { ink: iw * 0.6 });
      }
    }
    paint(ctx, () => quadPath(ctx, front, 0, 0, w, h), col(color), { ink: iw });
    paint(ctx, () => quadPath(ctx, front, 0, 0, w, 0.4), col(color, -28), { ink: iw * 0.65 });
    paneWindow(ctx, front, w * 0.16, h * 0.46, Math.min(1.35, w * 0.32), 1.4, panes, glass, iw);
    if (w > 4.4) paneWindow(ctx, front, w * 0.58, h * 0.5, Math.min(1.2, w * 0.26), 1.25, panes, glass, iw);
    paint(ctx, () => {
      const a = view.p(inner + side * 0.04, z0 - 0.08, h);
      const bb = view.p(inner + side * 0.04, z0 + d, h);
      const c = view.p(inner - side * 0.38, z0 + d, h - 0.1);
      const dd = view.p(inner - side * 0.38, z0 - 0.08, h - 0.1);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(bb.x, bb.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(dd.x, dd.y);
      ctx.closePath();
    }, col(b.roof || color, -6), { ink: iw * 0.85 });
    if (b.balcony) {
      const yv = Math.max(1.8, h * 0.48);
      paint(ctx, () => {
        const a = view.p(inner, z0 + 0.25, yv);
        const bb = view.p(inner, z0 + d * 0.78, yv);
        const c = view.p(inner - side * 1.35, z0 + d * 0.78, yv - 0.12);
        const dd = view.p(inner - side * 1.35, z0 + 0.25, yv - 0.12);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(bb.x, bb.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(dd.x, dd.y);
        ctx.closePath();
      }, col(b.awning || color, 16), { ink: iw * 0.75 });
      stroke(ctx, () => {
        const a = view.p(inner - side * 1.35, z0 + 0.3, yv + 0.55);
        const bb = view.p(inner - side * 1.35, z0 + d * 0.75, yv + 0.55);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(bb.x, bb.y);
      }, INK, Math.max(2, iw * 0.7));
    }
    if (b.roofKind && b.roofKind !== "flat") {
      const peak = b.roofKind === "spike" ? h * 0.55 : b.roofKind === "dome" ? h * 0.22 : h * 0.34;
      paint(ctx, () => {
        const a = wall(0.05, h);
        const mid = wall(d * 0.5, h + peak);
        const c = wall(d - 0.05, h * 0.9);
        ctx.moveTo(a.x, a.y);
        if (b.roofKind === "dome") ctx.quadraticCurveTo(mid.x, mid.y, c.x, c.y);
        else {
          ctx.lineTo(mid.x, mid.y);
          ctx.lineTo(c.x, c.y);
        }
        ctx.closePath();
      }, col(b.roof || color, 8), { ink: iw });
    }
    b.width = w;
    b.height = h;
    b.depth = d;
    b.roofShape = b.roofKind || (material === "metal" ? "flat" : "gable");
    roofOnFront(ctx, view, b, iw, b.roof || color);
    if (b.chimney) {
      paint(ctx, () => quadPath(ctx, front, w * 0.62, h * 0.78, w * 0.62 + 0.5, h + 1.25), col({ h: 12, s: 36, l: 40 }), { ink: iw * 0.75 });
    }
  }

  function kitWreck(ctx, x, y, s, color, U) {
    const w = s * 2.4;
    const h = s * 0.9;
    const iw = Math.max(2.4, inkW(s, U) * 1.3);
    const body = color || { h: 18, s: 36, l: 48 };
    [ -0.62, 0.62 ].forEach((k) => {
      paint(ctx, () => ctx.ellipse(x + w * k, y - h * 0.12, h * 0.28, h * 0.28, 0, 0, TAU), "#2a241c", { ink: iw });
      paint(ctx, () => ctx.ellipse(x + w * k, y - h * 0.12, h * 0.12, h * 0.12, 0, 0, TAU), "#c4b6a4", { ink: iw * 0.6 });
    });
    paint(ctx, () => {
      ctx.moveTo(x - w * 0.7, y - h * 0.2);
      ctx.lineTo(x - w * 0.55, y - h * 0.85);
      ctx.lineTo(x + w * 0.15, y - h * 0.85);
      ctx.lineTo(x + w * 0.72, y - h * 0.35);
      ctx.lineTo(x + w * 0.72, y - h * 0.15);
      ctx.closePath();
    }, col(body, -8), { ink: iw });
    paint(ctx, () => ctx.ellipse(x - w * 0.05, y - h * 0.95, w * 0.22, h * 0.22, 0, 0, TAU), col(body, 8), { ink: iw });
    paint(ctx, () => {
      ctx.moveTo(x - w * 0.22, y - h * 0.7);
      ctx.lineTo(x + w * 0.05, y - h * 0.7);
      ctx.lineTo(x + w * 0.02, y - h * 0.42);
      ctx.lineTo(x - w * 0.2, y - h * 0.42);
      ctx.closePath();
    }, "#d7e7f2", { ink: iw * 0.7 });
  }

  function codePost(ctx, x, y, s, code, U) {
    const iw = Math.max(2, inkW(s, U));
    paint(ctx, () => {
      ctx.moveTo(x - s * 0.08, y);
      ctx.lineTo(x - s * 0.045, y - s * 1.25);
      ctx.lineTo(x + s * 0.045, y - s * 1.25);
      ctx.lineTo(x + s * 0.08, y);
      ctx.closePath();
    }, "#f6f1e4", { ink: iw });
    const bw = s * 1.05;
    const bh = s * 0.46;
    const by = y - s * 1.55;
    paint(ctx, () => ctx.rect(x - bw / 2, by, bw, bh), "#241833", { ink: iw });
    ctx.save();
    ctx.fillStyle = "#fff4c8";
    ctx.font = `700 ${Math.max(9, s * 0.34)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(code), x, by + bh * 0.54);
    ctx.restore();
  }

  function wonderPlaque(ctx, x, y, s, U) {
    const iw = Math.max(1.6, inkW(s, U) * 0.8);
    const w = s * 2.4;
    const h = s * 0.42;
    paint(ctx, () => ctx.rect(x - w / 2, y - h, w, h), "#f3e2b0", { ink: iw });
    ctx.save();
    ctx.fillStyle = "#2a1a12";
    ctx.font = `700 ${Math.max(8, s * 0.22)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Left for Earth", x, y - h * 0.48);
    ctx.restore();
  }

  function wonder(ctx, cam, x, z, id, U) {
    const base = cam.p(x, z, 0);
    const s = base.s;
    if (s < 2) return;
    const iw = Math.max(2.4, inkW(s, U));
    const ground = base.y;
    if (id === "mound") {
      [[1.6, 0.7, "#c47a45"], [1.15, 1.15, "#d89255"], [0.7, 1.55, "#e2a868"]].forEach(([w, h, fill]) => {
        paint(ctx, () => {
          ctx.moveTo(base.x - s * w, ground);
          ctx.lineTo(base.x - s * w * 0.45, ground - s * h);
          ctx.lineTo(base.x + s * w * 0.45, ground - s * h);
          ctx.lineTo(base.x + s * w, ground);
          ctx.closePath();
        }, fill, { ink: iw });
      });
    } else if (id === "spine") {
      for (let i = -3; i <= 3; i++) {
        const h = 0.7 + (i % 2 ? 0.35 : 0.15);
        paint(ctx, () => {
          ctx.rect(base.x + s * i * 0.55, ground - s * h, s * 0.5, s * h);
        }, i % 2 ? "#c9b59a" : "#b7a288", { ink: iw * 0.8 });
      }
    } else if (id === "tilt") {
      ctx.save();
      ctx.translate(base.x, ground);
      ctx.rotate(-0.12);
      paint(ctx, () => ctx.rect(-s * 0.45, -s * 3.1, s * 0.9, s * 3.1), "#e7d7c4", { ink: iw });
      paint(ctx, () => ctx.rect(-s * 0.28, -s * 2.5, s * 0.28, s * 0.4), "#9fd0e8", { ink: iw * 0.6 });
      paint(ctx, () => ctx.rect(-s * 0.28, -s * 1.6, s * 0.28, s * 0.4), "#9fd0e8", { ink: iw * 0.6 });
      ctx.restore();
    } else if (id === "ring") {
      for (let i = -3; i <= 3; i++) {
        const h = 1.1 + Math.abs(i) * 0.12;
        paint(ctx, () => ctx.rect(base.x + s * i * 0.48 - s * 0.1, ground - s * h, s * 0.2, s * h), "#8d8478", { ink: iw * 0.75 });
      }
      paint(ctx, () => ctx.ellipse(base.x, ground - s * 0.15, s * 1.7, s * 0.28, 0, 0, TAU), "#6d655c", { ink: iw * 0.7 });
    } else {
      paint(ctx, () => ctx.rect(base.x - s * 1.35, ground - s * 2.2, s * 0.28, s * 2.2), "#d7c4a4", { ink: iw });
      paint(ctx, () => ctx.rect(base.x + s * 1.05, ground - s * 2.2, s * 0.28, s * 2.2), "#d7c4a4", { ink: iw });
      paint(ctx, () => ctx.rect(base.x - s * 1.5, ground - s * 2.45, s * 3, s * 0.32), "#e6d3ae", { ink: iw });
    }
    wonderPlaque(ctx, base.x, ground - s * 0.05, s, U);
  }

  // Latitude flora. Fills go through paint() so the outline stays a thin pencil and the wash puddles.
  function floraInk(U) {
    return 1.55 * (U || 1);
  }

  const FLORA = {
    magenta: { h: 324, s: 80, l: 56 },
    teal: { h: 174, s: 74, l: 44 },
    acid: { h: 63, s: 96, l: 58 },
    lavender: { h: 274, s: 56, l: 74 },
    copper: { h: 22, s: 72, l: 48 },
  };

  function tube(ctx, pts, w0, w1, color, iw) {
    if (!pts || pts.length < 2) return;
    const left = [];
    const right = [];
    for (let i = 0; i < pts.length; i++) {
      const o = pts[Math.max(0, i - 1)];
      const q = pts[Math.min(pts.length - 1, i + 1)];
      let dx = q.x - o.x;
      let dy = q.y - o.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const t = i / (pts.length - 1);
      const w = w0 + (w1 - w0) * t;
      left.push({ x: pts[i].x - dy * w, y: pts[i].y + dx * w });
      right.push({ x: pts[i].x + dy * w, y: pts[i].y - dx * w });
    }
    paint(ctx, () => {
      ctx.moveTo(left[0].x, left[0].y);
      for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
      for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
      ctx.closePath();
    }, col(color), { ink: iw });
  }

  function bead(ctx, x, y, r, color, iw) {
    const rr = Math.max(0.8, r);
    paint(ctx, () => ctx.arc(x, y, rr, 0, TAU), col(color), { ink: iw });
    paint(ctx, () => ctx.arc(x - rr * 0.28, y - rr * 0.32, Math.max(0.4, rr * 0.28), 0, TAU), "rgba(255, 252, 246, 0.7)");
  }

  function flare(ctx, x0, y0, x1, y1, w0, w1, color, iw) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const px = dx / len;
    const py = dy / len;
    paint(ctx, () => {
      ctx.moveTo(x0 + nx * w0, y0 + ny * w0);
      ctx.lineTo(x1 + nx * w1, y1 + ny * w1);
      ctx.quadraticCurveTo(x1 + px * w1 * 0.45, y1 + py * w1 * 0.45, x1 - nx * w1, y1 - ny * w1);
      ctx.lineTo(x0 - nx * w0, y0 - ny * w0);
      ctx.closePath();
    }, col(color), { ink: iw });
  }

  function copperFunnel(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const lean = (rand() - 0.5) * H * 0.16;
    const mouths = [0.38, 0.66, 0.94].map((t, i) => ({
      y: y - H * t,
      x: x + lean * t,
      w: H * (0.08 + i * 0.055),
      neck: H * (0.035 + i * 0.008),
      drip: rand() < 0.75,
    }));
    shadowBlob(ctx, x, y, H * 0.2, H * 0.045);
    paint(ctx, () => ctx.ellipse(x, y - H * 0.02, H * 0.16, H * 0.045, 0, 0, TAU), col(FLORA.copper, -8), { ink: iw });
    tube(ctx, [{ x, y }, { x: x + lean * 0.5, y: y - H * 0.5 }, mouths[2]], H * 0.04, H * 0.028, FLORA.copper, iw);
    mouths.forEach((m) => {
      flare(ctx, m.x, m.y - H * 0.06, m.x, m.y + H * 0.02, m.neck, m.w, FLORA.copper, iw);
      paint(ctx, () => ctx.ellipse(m.x, m.y + H * 0.01, m.w * 0.72, m.w * 0.28, 0, 0, TAU), col(FLORA.magenta), { ink: iw });
      if (m.drip) bead(ctx, m.x + m.w * 0.2, m.y + H * 0.08, H * 0.022, FLORA.magenta, iw);
    });
    bead(ctx, mouths[2].x, mouths[2].y - H * 0.1, H * 0.03, FLORA.acid, iw);
  }

  function acidLantern(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const hook = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      hook.push({ x: x + Math.sin(t * 2.4) * H * 0.2, y: y - Math.pow(t, 0.92) * H });
    }
    const lamps = [0.34, 0.58, 0.84].map((t) => {
      const p = hook[Math.round(t * 16)];
      return {
        x: p.x + H * (0.12 + rand() * 0.06),
        y: p.y,
        rx: H * (0.065 + rand() * 0.02),
        ry: H * (0.095 + rand() * 0.025),
        hang: p,
      };
    });
    shadowBlob(ctx, x, y, H * 0.14, H * 0.04);
    tube(ctx, hook, H * 0.032, H * 0.018, FLORA.teal, iw);
    lamps.forEach((lamp) => {
      tube(ctx, [lamp.hang, { x: lamp.x, y: lamp.y - lamp.ry }], H * 0.01, H * 0.01, FLORA.copper, iw);
      paint(ctx, () => ctx.ellipse(lamp.x, lamp.y, lamp.rx * 1.15, H * 0.018, 0, 0, TAU), col(FLORA.copper), { ink: iw });
      paint(ctx, () => ctx.ellipse(lamp.x, lamp.y, lamp.rx, lamp.ry, 0, 0, TAU), col(FLORA.acid), { ink: iw });
      paint(ctx, () => ctx.ellipse(lamp.x - lamp.rx * 0.2, lamp.y - lamp.ry * 0.25, lamp.rx * 0.28, lamp.ry * 0.35, -0.4, 0, TAU), col(FLORA.acid, 16, -30, 0.75));
      stroke(ctx, () => {
        ctx.moveTo(lamp.x - lamp.rx * 0.7, lamp.y);
        ctx.quadraticCurveTo(lamp.x, lamp.y + lamp.ry * 0.15, lamp.x + lamp.rx * 0.7, lamp.y);
      }, INK, iw * 0.75);
      tube(ctx, [
        { x: lamp.x, y: lamp.y + lamp.ry },
        { x: lamp.x + H * 0.03, y: lamp.y + lamp.ry + H * 0.07 },
      ], H * 0.008, H * 0.016, FLORA.lavender, iw);
    });
  }

  function magentaBellows(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const n = 5 + Math.floor(rand() * 2);
    const lean = (rand() - 0.5) * H * 0.2;
    const folds = [];
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      folds.push({
        x: x + lean * t0,
        y0: y - H * 0.78 * t0,
        y1: y - H * 0.78 * t1,
        w: H * (i % 2 ? 0.09 : 0.2),
      });
    }
    shadowBlob(ctx, x, y, H * 0.22, H * 0.045);
    paint(ctx, () => ctx.ellipse(x, y - H * 0.02, H * 0.12, H * 0.04, 0, 0, TAU), col(FLORA.copper, -6), { ink: iw });
    folds.forEach((f) => {
      paint(ctx, () => {
        ctx.moveTo(f.x - f.w, f.y0);
        ctx.lineTo(f.x - f.w * 0.72, f.y1);
        ctx.lineTo(f.x + f.w * 0.72, f.y1);
        ctx.lineTo(f.x + f.w, f.y0);
        ctx.closePath();
      }, col(iTone(f.w, H)), { ink: iw });
      bead(ctx, f.x + f.w * 0.82, (f.y0 + f.y1) / 2, H * 0.016, FLORA.copper, iw);
    });
    const top = folds[folds.length - 1];
    paint(ctx, () => ctx.rect(top.x - H * 0.04, top.y1 - H * 0.08, H * 0.08, H * 0.08), col(FLORA.teal), { ink: iw });
    paint(ctx, () => ctx.ellipse(top.x, top.y1 - H * 0.1, H * 0.07, H * 0.03, 0, 0, TAU), col(FLORA.acid), { ink: iw });
    function iTone(w, height) {
      return w > height * 0.14 ? FLORA.magenta : shade(FLORA.magenta, -8, 6);
    }
  }

  function lavenderSpoon(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const lean = (rand() - 0.5) * 0.35;
    const spoons = [-0.85, 0.05, 0.8].map((tilt, i) => {
      const hy = H * (0.4 + i * 0.22);
      return {
        x: x + lean * hy * 0.12,
        y: y - hy,
        rot: tilt * 1.05,
        bowl: H * (0.15 + rand() * 0.02),
        handle: H * (0.22 + i * 0.03),
      };
    });
    shadowBlob(ctx, x, y, H * 0.12, H * 0.04);
    tube(ctx, [{ x, y }, { x: x + lean * H * 0.08, y: y - H }], H * 0.028, H * 0.016, FLORA.copper, iw);
    spoons.forEach((sp) => {
      const hx = sp.x + Math.cos(sp.rot) * sp.handle;
      const hy = sp.y + Math.sin(sp.rot) * sp.handle * 0.35;
      tube(ctx, [{ x: sp.x, y: sp.y }, { x: hx, y: hy }], H * 0.012, H * 0.02, FLORA.lavender, iw);
      paint(ctx, () => ctx.ellipse(hx, hy, sp.bowl, sp.bowl * 0.62, sp.rot, 0, TAU), col(FLORA.lavender, 4), { ink: iw });
      bead(ctx, hx - Math.cos(sp.rot) * sp.bowl * 0.15, hy - sp.bowl * 0.05, sp.bowl * 0.32, FLORA.acid, iw);
    });
  }

  function tealCorkscrew(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const turns = 3 + Math.floor(rand() * 2);
    const pts = [];
    const beads = [];
    const n = 32;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = t * turns * TAU + 0.4;
      pts.push({
        x: x + Math.cos(a) * H * (0.1 + t * 0.05),
        y: y - t * H * 0.92,
      });
      if (i % 5 === 3) beads.push(pts[pts.length - 1]);
    }
    shadowBlob(ctx, x, y, H * 0.2, H * 0.045);
    paint(ctx, () => ctx.ellipse(x, y - H * 0.015, H * 0.16, H * 0.04, 0, 0, TAU), col(FLORA.copper), { ink: iw });
    for (let i = 0; i < pts.length - 1; i += 2) {
      tube(ctx, [pts[i], pts[i + 1]], H * 0.03, H * 0.024, FLORA.teal, iw);
    }
    beads.forEach((b, i) => bead(ctx, b.x, b.y, H * 0.028, i % 2 ? FLORA.magenta : FLORA.acid, iw));
    const tip = pts[pts.length - 1];
    paint(ctx, () => {
      ctx.moveTo(tip.x, tip.y - H * 0.07);
      ctx.lineTo(tip.x + H * 0.045, tip.y);
      ctx.lineTo(tip.x, tip.y + H * 0.02);
      ctx.lineTo(tip.x - H * 0.045, tip.y);
      ctx.closePath();
    }, col(FLORA.acid), { ink: iw });
  }

  function yolkUmbrella(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const lean = (rand() - 0.5) * H * 0.12;
    const top = { x: x + lean, y: y - H * 0.72 };
    const rx = H * (0.34 + rand() * 0.06);
    const scallops = 7;
    shadowBlob(ctx, x, y, H * 0.16, H * 0.04);
    tube(ctx, [{ x, y }, { x: x + lean * 0.4, y: y - H * 0.4 }, top], H * 0.03, H * 0.02, FLORA.copper, iw);
    paint(ctx, () => {
      ctx.moveTo(top.x - rx, top.y);
      ctx.ellipse(top.x, top.y, rx, rx * 0.72, 0, Math.PI, TAU, false);
      ctx.closePath();
    }, col(FLORA.acid), { ink: iw });
    for (let i = 0; i < scallops; i++) {
      const t = (i + 0.5) / scallops;
      const a = Math.PI + t * Math.PI;
      const sx = top.x + Math.cos(a) * rx * 0.92;
      const sy = top.y + Math.sin(a) * rx * 0.62;
      bead(ctx, sx, sy + H * 0.03, H * 0.018, i % 2 ? FLORA.teal : FLORA.magenta, iw);
    }
    stroke(ctx, () => {
      for (let i = 1; i < 4; i++) {
        const dx = (i - 2) * rx * 0.28;
        ctx.moveTo(top.x + dx * 0.15, top.y - rx * 0.05);
        ctx.quadraticCurveTo(top.x + dx, top.y - rx * 0.4, top.x + dx * 1.15, top.y - rx * 0.62);
      }
    }, INK, iw * 0.7);
    paint(ctx, () => ctx.ellipse(top.x, top.y - rx * 0.08, H * 0.04, H * 0.025, 0, 0, TAU), col(FLORA.lavender), { ink: iw });
  }

  function zipperVine(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const dir = rand() < 0.5 ? -1 : 1;
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      pts.push({
        x: x + dir * Math.sin(t * Math.PI) * H * 0.28,
        y: y - t * H * 0.95,
      });
    }
    const teeth = [];
    for (let i = 2; i < pts.length - 2; i += 2) {
      const p = pts[i];
      const q = pts[i + 1];
      const dx = q.x - pts[i - 1].x;
      const dy = q.y - pts[i - 1].y;
      const len = Math.hypot(dx, dy) || 1;
      const side = i % 4 === 2 ? 1 : -1;
      teeth.push({
        x: p.x + (-dy / len) * side * H * 0.07,
        y: p.y + (dx / len) * side * H * 0.07,
        w: H * 0.028,
      });
    }
    const pull = pts[6];
    shadowBlob(ctx, x, y, H * 0.12, H * 0.04);
    tube(ctx, pts, H * 0.045, H * 0.03, FLORA.magenta, iw);
    teeth.forEach((t, i) => {
      paint(ctx, () => {
        ctx.moveTo(t.x, t.y - t.w);
        ctx.lineTo(t.x + t.w, t.y + t.w * 0.6);
        ctx.lineTo(t.x - t.w, t.y + t.w * 0.6);
        ctx.closePath();
      }, col(i % 2 ? FLORA.copper : FLORA.acid), { ink: iw });
    });
    paint(ctx, () => ctx.rect(pull.x - H * 0.03, pull.y - H * 0.06, H * 0.1, H * 0.12), col(FLORA.teal), { ink: iw });
    paint(ctx, () => ctx.arc(pull.x + H * 0.02, pull.y, H * 0.018, 0, TAU), col(FLORA.lavender), { ink: iw });
  }

  function bubbleChimney(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const n = 4 + Math.floor(rand() * 2);
    const bubbles = [];
    let yy = y - H * 0.08;
    for (let i = 0; i < n; i++) {
      const r = H * (0.16 - i * 0.018);
      yy -= r * 1.15;
      bubbles.push({ x: x + (rand() - 0.5) * H * 0.04, y: yy, r });
      yy -= r * 0.55;
    }
    shadowBlob(ctx, x, y, H * 0.18, H * 0.04);
    paint(ctx, () => {
      ctx.moveTo(x - H * 0.12, y);
      ctx.lineTo(x - H * 0.08, y - H * 0.12);
      ctx.lineTo(x + H * 0.08, y - H * 0.12);
      ctx.lineTo(x + H * 0.12, y);
      ctx.closePath();
    }, col(FLORA.teal), { ink: iw });
    bubbles.forEach((b, i) => {
      paint(ctx, () => ctx.arc(b.x, b.y, b.r, 0, TAU), col(FLORA.lavender, i * 2), { ink: iw });
      paint(ctx, () => ctx.ellipse(b.x - b.r * 0.28, b.y - b.r * 0.32, b.r * 0.22, b.r * 0.16, -0.5, 0, TAU), "rgba(255, 252, 246, 0.55)");
    });
    const mid = bubbles[1] || bubbles[0];
    paint(ctx, () => ctx.rect(mid.x - mid.r * 1.05, mid.y - H * 0.018, mid.r * 2.1, H * 0.036), col(FLORA.copper), { ink: iw });
    const top = bubbles[bubbles.length - 1];
    [-0.4, 0.1, 0.45].forEach((dx, i) => {
      bead(ctx, top.x + dx * H * 0.12, top.y - top.r - H * (0.04 + i * 0.02), H * (0.03 - i * 0.004), FLORA.acid, iw);
    });
  }

  function hornedPod(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const rot = (rand() - 0.5) * 0.4;
    const horns = [-1, 1].map((side) => {
      const a = -1.1 + side * 0.45 + (rand() - 0.5) * 0.2;
      return [
        { x: x + side * H * 0.08, y: y - H * 0.55 },
        { x: x + side * H * 0.22 + Math.cos(a) * H * 0.12, y: y - H * 0.78 },
        { x: x + Math.cos(a) * H * 0.28 * side, y: y - H * (0.95 + rand() * 0.08) },
      ];
    });
    shadowBlob(ctx, x, y, H * 0.2, H * 0.045);
    tube(ctx, [{ x: x - H * 0.04, y }, { x, y: y - H * 0.2 }], H * 0.04, H * 0.05, FLORA.teal, iw);
    paint(ctx, () => ctx.ellipse(x, y - H * 0.42, H * 0.2, H * 0.28, rot, 0, TAU), col(FLORA.copper), { ink: iw });
    paint(ctx, () => ctx.ellipse(x - H * 0.06, y - H * 0.52, H * 0.06, H * 0.1, rot - 0.4, 0, TAU), col(FLORA.copper, 14, -10, 0.65));
    horns.forEach((pts) => tube(ctx, pts, H * 0.028, H * 0.012, FLORA.lavender, iw));
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      stroke(ctx, () => {
        const yy = y - H * (0.28 + t * 0.28);
        ctx.moveTo(x - H * 0.08, yy);
        ctx.lineTo(x + H * 0.08, yy + H * 0.03);
      }, INK, iw * 0.65);
    }
    bead(ctx, x, y - H * 0.42, H * 0.03, FLORA.magenta, iw);
  }

  function tromboneBloom(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const dir = rand() < 0.5 ? -1 : 1;
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const a = t * Math.PI * 1.35;
      pts.push({
        x: x + dir * (Math.sin(a) * H * 0.28 + t * H * 0.05),
        y: y - t * H * 0.78 - Math.cos(a) * H * 0.06,
      });
    }
    const bell = pts[pts.length - 1];
    const prev = pts[pts.length - 4];
    shadowBlob(ctx, x, y, H * 0.14, H * 0.04);
    tube(ctx, pts, H * 0.032, H * 0.02, FLORA.copper, iw);
    flare(ctx, prev.x, prev.y, bell.x + dir * H * 0.04, bell.y - H * 0.02, H * 0.03, H * 0.11, FLORA.magenta, iw);
    paint(ctx, () => ctx.ellipse(bell.x + dir * H * 0.08, bell.y - H * 0.02, H * 0.05, H * 0.1, dir * 0.4, 0, TAU), col(FLORA.magenta, 8), { ink: iw });
    for (let i = 0; i < 3; i++) {
      const p = pts[8 + i * 2];
      bead(ctx, p.x + dir * H * 0.06, p.y, H * 0.018, FLORA.teal, iw);
    }
    paint(ctx, () => ctx.rect(x - H * 0.05, y - H * 0.08, H * 0.14, H * 0.035), col(FLORA.acid), { ink: iw });
  }

  function stackedHats(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const lean = (rand() - 0.5) * H * 0.08;
    const hats = [0.34, 0.58, 0.84].map((t, i) => ({
      x: x + lean * t,
      y: y - H * t,
      brim: H * (0.2 - i * 0.03),
      crown: H * (0.14 - i * 0.015),
    }));
    shadowBlob(ctx, x, y, H * 0.16, H * 0.04);
    tube(ctx, [{ x, y }, hats[2]], H * 0.026, H * 0.016, FLORA.teal, iw);
    hats.forEach((hat) => {
      paint(ctx, () => ctx.ellipse(hat.x, hat.y, hat.brim, hat.brim * 0.28, 0, 0, TAU), col(FLORA.acid), { ink: iw });
      paint(ctx, () => {
        ctx.moveTo(hat.x - hat.crown * 0.55, hat.y);
        ctx.lineTo(hat.x - hat.crown * 0.4, hat.y - hat.crown);
        ctx.lineTo(hat.x + hat.crown * 0.4, hat.y - hat.crown);
        ctx.lineTo(hat.x + hat.crown * 0.55, hat.y);
        ctx.closePath();
      }, col(FLORA.acid, 6), { ink: iw });
      paint(ctx, () => ctx.rect(hat.x - hat.crown * 0.48, hat.y - hat.crown * 0.42, hat.crown * 0.96, hat.crown * 0.16), col(FLORA.lavender), { ink: iw * 0.8 });
    });
    bead(ctx, hats[2].x, hats[2].y - hats[2].crown - H * 0.02, H * 0.035, FLORA.magenta, iw);
  }

  function waffleFan(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const hub = { x, y: y - H * 0.62 };
    const discs = [];
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i / (n - 1)) * Math.PI;
      discs.push({
        x: hub.x + Math.cos(a) * H * 0.24,
        y: hub.y + Math.sin(a) * H * 0.16 - H * 0.05,
        r: H * (0.09 + rand() * 0.015),
      });
    }
    shadowBlob(ctx, x, y, H * 0.12, H * 0.04);
    tube(ctx, [{ x, y }, { x: x + H * 0.02, y: hub.y }], H * 0.028, H * 0.02, FLORA.magenta, iw);
    discs.forEach((d) => {
      paint(ctx, () => ctx.arc(d.x, d.y, d.r, 0, TAU), col(FLORA.lavender), { ink: iw });
      stroke(ctx, () => {
        ctx.moveTo(d.x - d.r * 0.7, d.y);
        ctx.lineTo(d.x + d.r * 0.7, d.y);
        ctx.moveTo(d.x, d.y - d.r * 0.7);
        ctx.lineTo(d.x, d.y + d.r * 0.7);
      }, INK, iw * 0.6);
    });
    bead(ctx, hub.x, hub.y, H * 0.045, FLORA.copper, iw);
    bead(ctx, hub.x, hub.y, H * 0.02, FLORA.acid, iw);
  }

  function coilFountain(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const coils = 4 + Math.floor(rand() * 2);
    const rings = [];
    for (let i = 0; i < coils; i++) {
      rings.push({
        y: y - H * (0.16 + i * 0.12),
        rx: H * (0.12 + (i % 2) * 0.035),
        ry: H * 0.045,
      });
    }
    const drops = [-0.2, 0.05, 0.22].map((dx, i) => ({
      x: x + dx * H,
      y: y - H * (0.78 + i * 0.06 + rand() * 0.04),
      r: H * (0.028 + (i % 2) * 0.008),
    }));
    shadowBlob(ctx, x, y, H * 0.22, H * 0.045);
    paint(ctx, () => ctx.ellipse(x, y - H * 0.04, H * 0.22, H * 0.07, 0, 0, TAU), col(FLORA.copper), { ink: iw });
    paint(ctx, () => ctx.ellipse(x, y - H * 0.06, H * 0.12, H * 0.035, 0, 0, TAU), col(FLORA.teal, -8), { ink: iw });
    rings.forEach((r) => {
      paint(ctx, () => {
        ctx.ellipse(x, r.y, r.rx, r.ry, 0, 0, TAU, false);
        ctx.ellipse(x, r.y, r.rx * 0.62, r.ry * 0.55, 0, 0, TAU, true);
      }, col(FLORA.teal), { ink: iw });
    });
    drops.forEach((d) => bead(ctx, d.x, d.y, d.r, FLORA.magenta, iw));
    bead(ctx, x, rings[rings.length - 1].y - H * 0.08, H * 0.03, FLORA.acid, iw);
  }

  function mittenShrub(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const mittens = [-1.1, -0.35, 0.4, 1.15].map((t) => ({
      x: x + t * H * 0.16,
      y: y - H * (0.15 + rand() * 0.12),
      rot: t * 0.35 + (rand() - 0.5) * 0.2,
      w: H * (0.11 + rand() * 0.02),
      hh: H * (0.28 + rand() * 0.08),
      flip: t > 0 ? 1 : -1,
    }));
    shadowBlob(ctx, x, y, H * 0.28, H * 0.045);
    mittens.forEach((m) => {
      tube(ctx, [{ x: m.x, y }, { x: m.x, y: m.y }], H * 0.02, H * 0.028, FLORA.copper, iw);
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.rot);
      paint(ctx, () => {
        ctx.moveTo(-m.w * 0.45, 0);
        ctx.quadraticCurveTo(-m.w * 0.7, -m.hh * 0.45, -m.w * 0.2, -m.hh * 0.82);
        ctx.quadraticCurveTo(m.w * 0.15, -m.hh, m.w * 0.35, -m.hh * 0.62);
        ctx.lineTo(m.w * 0.4, -m.hh * 0.4);
        ctx.quadraticCurveTo(m.flip * m.w * 1.15, -m.hh * 0.55, m.flip * m.w * 0.95, -m.hh * 0.22);
        ctx.quadraticCurveTo(m.w * 0.45, -m.hh * 0.12, m.w * 0.42, 0);
        ctx.closePath();
      }, col(FLORA.magenta), { ink: iw });
      paint(ctx, () => ctx.rect(-m.w * 0.42, -m.hh * 0.16, m.w * 0.84, m.hh * 0.1), col(FLORA.lavender), { ink: iw * 0.75 });
      ctx.restore();
    });
  }

  function dishBloom(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const lean = (rand() - 0.5) * H * 0.1;
    const bowl = { x: x + lean, y: y - H * 0.62 };
    const rx = H * 0.28;
    const focus = { x: bowl.x + H * 0.02, y: bowl.y - H * 0.16 };
    shadowBlob(ctx, x, y, H * 0.2, H * 0.045);
    [-0.7, 0, 0.7].forEach((t) => {
      tube(ctx, [
        { x: x + t * H * 0.12, y },
        { x: bowl.x + t * H * 0.04, y: bowl.y },
      ], H * 0.018, H * 0.012, FLORA.teal, iw);
    });
    paint(ctx, () => {
      ctx.moveTo(bowl.x - rx, bowl.y);
      ctx.ellipse(bowl.x, bowl.y, rx, rx * 0.55, 0, 0, Math.PI, false);
      ctx.closePath();
    }, col(FLORA.copper), { ink: iw });
    for (let i = 0; i < 5; i++) {
      const a = (i / 4) * Math.PI;
      bead(ctx, bowl.x - rx + (rx * 2 * i) / 4, bowl.y + Math.sin(a) * rx * 0.08, H * 0.012, FLORA.lavender, iw);
    }
    tube(ctx, [bowl, focus], H * 0.012, H * 0.01, FLORA.teal, iw);
    bead(ctx, focus.x, focus.y, H * 0.04, FLORA.acid, iw);
  }

  function accordionKelp(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const n = 8 + Math.floor(rand() * 3);
    const amp = H * (0.1 + rand() * 0.04);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      pts.push({
        x: x + (i % 2 ? amp : -amp * 0.35),
        y: y - (i / n) * H * 0.92,
      });
    }
    shadowBlob(ctx, x, y, H * 0.12, H * 0.04);
    tube(ctx, pts, H * 0.055, H * 0.03, FLORA.lavender, iw);
    pts.forEach((p, i) => {
      if (i % 2 === 1) bead(ctx, p.x + amp * 0.55, p.y, H * 0.016, FLORA.copper, iw);
    });
    const tip = pts[pts.length - 1];
    paint(ctx, () => {
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(tip.x + H * 0.12, tip.y - H * 0.03);
      ctx.lineTo(tip.x + H * 0.02, tip.y + H * 0.05);
      ctx.closePath();
    }, col(FLORA.teal), { ink: iw });
  }

  function parasolSquid(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const top = y - H * 0.78;
    const rx = H * (0.32 + rand() * 0.05);
    const n = 4 + Math.floor(rand() * 2);
    const tassels = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const bx = x - rx * 0.8 + t * rx * 1.6;
      tassels.push({
        x: bx,
        y0: top + H * 0.02,
        y1: top + H * (0.16 + rand() * 0.1),
        sway: (rand() - 0.5) * H * 0.06,
      });
    }
    shadowBlob(ctx, x, y, H * 0.2, H * 0.04);
    tube(ctx, [{ x, y }, { x, y: top + H * 0.05 }], H * 0.03, H * 0.022, FLORA.copper, iw);
    paint(ctx, () => {
      ctx.moveTo(x - rx, top);
      ctx.ellipse(x, top, rx, rx * 0.62, 0, Math.PI, TAU, false);
      ctx.closePath();
    }, col(FLORA.teal), { ink: iw });
    bead(ctx, x, top - rx * 0.55, H * 0.035, FLORA.lavender, iw);
    tassels.forEach((t) => {
      tube(ctx, [{ x: t.x, y: t.y0 }, { x: t.x + t.sway, y: t.y1 }], H * 0.012, H * 0.008, FLORA.copper, iw);
      bead(ctx, t.x + t.sway, t.y1 + H * 0.01, H * 0.02, FLORA.magenta, iw);
    });
  }

  function sporkFern(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const n = 3;
    const sporks = [];
    for (let i = 0; i < n; i++) {
      const a = -2.4 + (i / (n - 1)) * 1.5;
      const len = H * (0.55 + rand() * 0.2);
      sporks.push({
        x: x + Math.cos(a) * len,
        y: y + Math.sin(a) * len * 0.85,
        a,
        len,
      });
    }
    shadowBlob(ctx, x, y, H * 0.16, H * 0.04);
    paint(ctx, () => ctx.ellipse(x, y - H * 0.04, H * 0.1, H * 0.05, 0, 0, TAU), col(FLORA.lavender), { ink: iw });
    sporks.forEach((sp) => {
      const ux = Math.cos(sp.a);
      const uy = Math.sin(sp.a);
      const px = Math.cos(sp.a + Math.PI / 2);
      const py = Math.sin(sp.a + Math.PI / 2);
      const bowl = { x: sp.x - ux * H * 0.02, y: sp.y - uy * H * 0.02 };
      tube(ctx, [{ x, y: y - H * 0.02 }, { x: bowl.x - ux * H * 0.1, y: bowl.y - uy * H * 0.1 }], H * 0.018, H * 0.026, FLORA.acid, iw);
      paint(ctx, () => ctx.ellipse(bowl.x, bowl.y, H * 0.11, H * 0.07, sp.a, 0, TAU), col(FLORA.acid, 10), { ink: iw });
      paint(ctx, () => ctx.ellipse(bowl.x - px * H * 0.02, bowl.y - py * H * 0.02, H * 0.05, H * 0.03, sp.a, 0, TAU), col(FLORA.lavender, 6), { ink: iw * 0.7 });
      for (let k = -1; k <= 1; k++) {
        const bx = bowl.x + ux * H * 0.07 + px * k * H * 0.035;
        const by = bowl.y + uy * H * 0.07 + py * k * H * 0.035;
        flare(ctx, bx, by, bx + ux * H * 0.09, by + uy * H * 0.09, H * 0.012, H * 0.008, FLORA.copper, iw);
      }
    });
  }

  function ringNest(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const n = 5;
    const rings = [];
    for (let i = 0; i < n; i++) {
      rings.push({
        y: y - H * (0.16 + i * 0.14),
        rx: H * (0.2 - i * 0.02 + rand() * 0.01),
        ry: H * (0.07 - i * 0.004),
        tilt: (rand() - 0.5) * 0.3,
      });
    }
    shadowBlob(ctx, x, y, H * 0.22, H * 0.045);
    tube(ctx, [{ x, y }, { x, y: y - H * 0.2 }], H * 0.04, H * 0.03, FLORA.copper, iw);
    rings.forEach((r, i) => {
      paint(ctx, () => {
        ctx.ellipse(x, r.y, r.rx, r.ry, r.tilt, 0, TAU, false);
        ctx.ellipse(x, r.y, r.rx * 0.58, r.ry * 0.5, r.tilt, 0, TAU, true);
      }, col(i % 2 ? FLORA.lavender : shade(FLORA.lavender, -6, 8)), { ink: iw });
    });
    const mid = rings[2];
    bead(ctx, x, mid.y, H * 0.04, FLORA.magenta, iw);
    bead(ctx, x, rings[n - 1].y - H * 0.06, H * 0.028, FLORA.acid, iw);
  }

  function trumpetChoir(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const horns = [];
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = -2.6 + (i / (n - 1)) * 2.2 + (rand() - 0.5) * 0.15;
      const len = H * (0.42 + rand() * 0.22);
      horns.push({
        x: x + Math.cos(a) * len,
        y: y - H * 0.2 + Math.sin(a) * len * 0.75,
        a,
      });
    }
    shadowBlob(ctx, x, y, H * 0.18, H * 0.045);
    paint(ctx, () => ctx.arc(x, y - H * 0.16, H * 0.1, 0, TAU), col(FLORA.copper), { ink: iw });
    paint(ctx, () => ctx.arc(x - H * 0.06, y - H * 0.08, H * 0.07, 0, TAU), col(FLORA.copper, -6), { ink: iw });
    horns.forEach((horn) => {
      const bx = x + Math.cos(horn.a) * H * 0.08;
      const by = y - H * 0.16 + Math.sin(horn.a) * H * 0.06;
      flare(ctx, bx, by, horn.x, horn.y, H * 0.018, H * 0.055, FLORA.magenta, iw);
      paint(ctx, () => ctx.ellipse(horn.x, horn.y, H * 0.04, H * 0.055, horn.a, 0, TAU), col(FLORA.magenta, 8), { ink: iw });
      bead(ctx, bx, by, H * 0.014, FLORA.teal, iw);
    });
  }

  function jellyComb(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    shadowBlob(ctx, x, y, H * 0.2, H * 0.04);
    tube(ctx, [{ x, y }, { x, y: y - H * 0.35 }], H * 0.04, H * 0.03, FLORA.copper, iw);
    for (let row = 0; row < 3; row++) {
      for (let cell = 0; cell < 3 - (row % 2); cell++) {
        const cx = x + (cell - 1 + (row % 2) * 0.5) * H * 0.12;
        const cy = y - H * (0.48 + row * 0.14);
        paint(ctx, () => ctx.arc(cx, cy, H * 0.07, 0, TAU), col(row % 2 ? FLORA.acid : FLORA.magenta), { ink: iw });
      }
    }
    void rand;
  }

  function corkHorn(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const tip = { x: x + H * 0.22, y: y - H * 0.78 };
    shadowBlob(ctx, x, y, H * 0.16, H * 0.04);
    flare(ctx, x, y - H * 0.08, tip.x, tip.y, H * 0.05, H * 0.02, FLORA.copper, iw);
    bead(ctx, tip.x, tip.y, H * 0.05, FLORA.magenta, iw);
    bead(ctx, x + H * 0.08, y - H * 0.4, H * 0.03, FLORA.acid, iw);
    void rand;
  }

  function marbleReed(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    shadowBlob(ctx, x, y, H * 0.12, H * 0.04);
    for (let i = 0; i < 4; i++) {
      const lean = (i - 1.5) * H * 0.08;
      tube(ctx, [{ x: x + lean * 0.2, y }, { x: x + lean, y: y - H * (0.55 + rand() * 0.25) }], H * 0.02, H * 0.012, FLORA.teal, iw);
      bead(ctx, x + lean, y - H * (0.62 + i * 0.04), H * 0.035, i % 2 ? FLORA.lavender : FLORA.acid, iw);
    }
  }

  function puffLadder(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    shadowBlob(ctx, x, y, H * 0.14, H * 0.04);
    tube(ctx, [{ x: x - H * 0.06, y }, { x: x - H * 0.06, y: y - H * 0.8 }], H * 0.02, H * 0.016, FLORA.copper, iw);
    tube(ctx, [{ x: x + H * 0.06, y }, { x: x + H * 0.06, y: y - H * 0.8 }], H * 0.02, H * 0.016, FLORA.copper, iw);
    for (let i = 0; i < 4; i++) {
      const yy = y - H * (0.2 + i * 0.16);
      paint(ctx, () => ctx.ellipse(x, yy, H * 0.1, H * 0.035, 0, 0, TAU), col(i % 2 ? FLORA.magenta : FLORA.lavender), { ink: iw });
    }
    void rand;
  }

  function sawBloom(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const cy = y - H * 0.55;
    shadowBlob(ctx, x, y, H * 0.18, H * 0.04);
    tube(ctx, [{ x, y }, { x, y: cy + H * 0.1 }], H * 0.03, H * 0.02, FLORA.teal, iw);
    paint(ctx, () => {
      ctx.moveTo(x, cy - H * 0.22);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU - Math.PI / 2;
        const r = i % 2 ? H * 0.2 : H * 0.1;
        ctx.lineTo(x + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath();
    }, col(FLORA.acid), { ink: iw });
    bead(ctx, x, cy, H * 0.04, FLORA.magenta, iw);
    void rand;
  }

  function cupStack(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    shadowBlob(ctx, x, y, H * 0.16, H * 0.04);
    for (let i = 0; i < 3; i++) {
      const yy = y - H * (0.2 + i * 0.22);
      const rx = H * (0.16 - i * 0.03);
      paint(ctx, () => ctx.ellipse(x, yy, rx, rx * 0.35, 0, 0, TAU), col(i % 2 ? FLORA.lavender : FLORA.teal), { ink: iw });
    }
    bead(ctx, x, y - H * 0.86, H * 0.04, FLORA.acid, iw);
    void rand;
  }

  function ribbonKelp(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    shadowBlob(ctx, x, y, H * 0.2, H * 0.04);
    [-1, 0, 1].forEach((side, i) => {
      const sway = side * H * (0.12 + rand() * 0.05);
      tube(ctx, [
        { x, y },
        { x: x + sway, y: y - H * 0.4 },
        { x: x - sway * 0.4, y: y - H * 0.75 },
      ], H * 0.03, H * 0.015, i === 1 ? FLORA.magenta : FLORA.teal, iw);
    });
  }

  function orbitPod(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const cy = y - H * 0.55;
    shadowBlob(ctx, x, y, H * 0.14, H * 0.04);
    tube(ctx, [{ x, y }, { x, y: cy }], H * 0.025, H * 0.02, FLORA.copper, iw);
    paint(ctx, () => ctx.ellipse(x, cy, H * 0.16, H * 0.07, 0.2, 0, TAU), "rgba(0,0,0,0)", { ink: iw });
    bead(ctx, x + H * 0.1, cy - H * 0.05, H * 0.045, FLORA.acid, iw);
    bead(ctx, x - H * 0.08, cy + H * 0.02, H * 0.03, FLORA.magenta, iw);
    void rand;
  }

  function clawFern(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    shadowBlob(ctx, x, y, H * 0.18, H * 0.04);
    for (let i = 0; i < 5; i++) {
      const a = -2.4 + i * 0.55;
      const len = H * (0.35 + rand() * 0.15);
      flare(ctx, x, y - H * 0.1, x + Math.cos(a) * len, y - H * 0.15 + Math.sin(a) * len * 0.8, H * 0.03, H * 0.012, FLORA.teal, iw);
    }
    bead(ctx, x, y - H * 0.12, H * 0.04, FLORA.copper, iw);
  }

  function drumVine(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    shadowBlob(ctx, x, y, H * 0.16, H * 0.04);
    tube(ctx, [{ x, y }, { x: x + H * 0.05, y: y - H * 0.7 }], H * 0.02, H * 0.016, FLORA.lavender, iw);
    [[0.25, 0.16], [0.48, -0.1], [0.7, 0.12]].forEach(([t, dx], i) => {
      bead(ctx, x + dx * H, y - H * t, H * (0.05 - i * 0.008), i % 2 ? FLORA.magenta : FLORA.acid, iw);
    });
    void rand;
  }

  function petalGear(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const cy = y - H * 0.58;
    shadowBlob(ctx, x, y, H * 0.16, H * 0.04);
    tube(ctx, [{ x, y }, { x, y: cy + H * 0.12 }], H * 0.028, H * 0.02, FLORA.copper, iw);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      paint(ctx, () => ctx.ellipse(x + Math.cos(a) * H * 0.12, cy + Math.sin(a) * H * 0.12, H * 0.06, H * 0.035, a, 0, TAU), col(i % 2 ? FLORA.magenta : FLORA.lavender), { ink: iw });
    }
    bead(ctx, x, cy, H * 0.035, FLORA.acid, iw);
    void rand;
  }

  function strawNest(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    shadowBlob(ctx, x, y, H * 0.22, H * 0.045);
    paint(ctx, () => ctx.ellipse(x, y - H * 0.18, H * 0.22, H * 0.1, 0, 0, TAU), col(FLORA.copper), { ink: iw });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      stroke(ctx, () => {
        ctx.moveTo(x + Math.cos(a) * H * 0.08, y - H * 0.2);
        ctx.quadraticCurveTo(x + Math.cos(a) * H * 0.2, y - H * 0.35, x + Math.cos(a + 0.4) * H * 0.16, y - H * 0.42);
      }, col(FLORA.lavender), iw);
    }
    bead(ctx, x, y - H * 0.28, H * 0.04, FLORA.acid, iw);
    void rand;
  }

  function blobPalm(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const top = y - H * 0.62;
    shadowBlob(ctx, x, y, H * 0.14, H * 0.04);
    tube(ctx, [{ x, y }, { x: x + H * 0.04, y: top }], H * 0.04, H * 0.03, FLORA.copper, iw);
    for (let i = 0; i < 5; i++) {
      const a = -2.6 + i * 0.7;
      paint(ctx, () => ctx.ellipse(top + Math.cos(a) * H * 0.16, top + Math.sin(a) * H * 0.1, H * 0.1, H * 0.05, a, 0, TAU), col(i % 2 ? FLORA.teal : FLORA.acid), { ink: iw });
    }
    void rand;
  }

  function zigTulip(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    shadowBlob(ctx, x, y, H * 0.12, H * 0.04);
    tube(ctx, [
      { x, y },
      { x: x - H * 0.08, y: y - H * 0.25 },
      { x: x + H * 0.08, y: y - H * 0.5 },
      { x, y: y - H * 0.72 },
    ], H * 0.025, H * 0.016, FLORA.teal, iw);
    paint(ctx, () => {
      ctx.moveTo(x, y - H * 0.7);
      ctx.quadraticCurveTo(x - H * 0.12, y - H * 0.95, x, y - H * 0.88);
      ctx.quadraticCurveTo(x + H * 0.12, y - H * 0.95, x, y - H * 0.7);
      ctx.closePath();
    }, col(FLORA.magenta), { ink: iw });
    void rand;
  }

  function moonFan(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const cy = y - H * 0.5;
    shadowBlob(ctx, x, y, H * 0.16, H * 0.04);
    tube(ctx, [{ x, y }, { x, y: cy }], H * 0.025, H * 0.02, FLORA.lavender, iw);
    paint(ctx, () => ctx.arc(x, cy, H * 0.18, Math.PI, TAU), col(FLORA.acid), { ink: iw });
    bead(ctx, x, cy, H * 0.03, FLORA.copper, iw);
    void rand;
  }

  function pipeBouquet(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    shadowBlob(ctx, x, y, H * 0.18, H * 0.04);
    for (let i = 0; i < 4; i++) {
      const a = -2.2 + i * 0.5;
      const ex = x + Math.cos(a) * H * 0.28;
      const ey = y - H * 0.25 + Math.sin(a) * H * 0.35;
      tube(ctx, [{ x, y }, { x: ex, y: ey }], H * 0.03, H * 0.045, i % 2 ? FLORA.magenta : FLORA.teal, iw);
      bead(ctx, ex, ey - H * 0.04, H * 0.03, FLORA.acid, iw);
    }
    void rand;
  }

  function candySpine(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    shadowBlob(ctx, x, y, H * 0.1, H * 0.04);
    tube(ctx, [{ x, y }, { x: x + (rand() - 0.5) * H * 0.08, y: y - H * 0.82 }], H * 0.03, H * 0.02, FLORA.lavender, iw);
    for (let i = 0; i < 6; i++) {
      const yy = y - H * (0.15 + i * 0.11);
      const side = i % 2 ? 1 : -1;
      paint(ctx, () => ctx.ellipse(x + side * H * 0.06, yy, H * 0.045, H * 0.025, side * 0.6, 0, TAU), col(i % 3 ? FLORA.magenta : FLORA.acid), { ink: iw * 0.8 });
    }
  }

  function loopShrub(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    shadowBlob(ctx, x, y, H * 0.2, H * 0.04);
    paint(ctx, () => ctx.ellipse(x, y - H * 0.28, H * 0.16, H * 0.2, 0, 0, TAU), col(FLORA.teal), { ink: iw });
    paint(ctx, () => ctx.ellipse(x + H * 0.08, y - H * 0.42, H * 0.1, H * 0.12, 0.4, 0, TAU), col(FLORA.acid), { ink: iw });
    paint(ctx, () => ctx.ellipse(x - H * 0.06, y - H * 0.48, H * 0.07, H * 0.09, -0.3, 0, TAU), col(FLORA.magenta), { ink: iw });
    void rand;
  }

  function bellTower(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    shadowBlob(ctx, x, y, H * 0.12, H * 0.04);
    tube(ctx, [{ x, y }, { x, y: y - H * 0.55 }], H * 0.035, H * 0.028, FLORA.copper, iw);
    paint(ctx, () => {
      ctx.moveTo(x - H * 0.1, y - H * 0.55);
      ctx.quadraticCurveTo(x, y - H * 0.95, x + H * 0.1, y - H * 0.55);
      ctx.closePath();
    }, col(FLORA.lavender), { ink: iw });
    bead(ctx, x, y - H * 0.62, H * 0.025, FLORA.acid, iw);
    void rand;
  }

  function speckPod(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    const cy = y - H * 0.4;
    shadowBlob(ctx, x, y, H * 0.16, H * 0.04);
    tube(ctx, [{ x, y }, { x, y: cy + H * 0.12 }], H * 0.025, H * 0.02, FLORA.teal, iw);
    paint(ctx, () => ctx.ellipse(x, cy, H * 0.14, H * 0.18, 0, 0, TAU), col(FLORA.magenta), { ink: iw });
    for (let i = 0; i < 4; i++) bead(ctx, x + (rand() - 0.5) * H * 0.12, cy + (rand() - 0.4) * H * 0.16, H * 0.018, FLORA.acid, iw);
  }

  function curlCactus(ctx, x, y, s, h, rand, U) {
    const H = h * s;
    if (H < 4) return;
    const iw = floraInk(U);
    shadowBlob(ctx, x, y, H * 0.14, H * 0.04);
    tube(ctx, [{ x, y }, { x, y: y - H * 0.45 }, { x: x + H * 0.16, y: y - H * 0.62 }], H * 0.05, H * 0.03, FLORA.acid, iw);
    tube(ctx, [{ x, y: y - H * 0.28 }, { x: x - H * 0.18, y: y - H * 0.48 }], H * 0.035, H * 0.02, FLORA.teal, iw);
    bead(ctx, x + H * 0.16, y - H * 0.66, H * 0.035, FLORA.magenta, iw);
    void rand;
  }

  const EXOTIC_DRAW = {
    copperFunnel,
    acidLantern,
    magentaBellows,
    lavenderSpoon,
    tealCorkscrew,
    yolkUmbrella,
    zipperVine,
    bubbleChimney,
    hornedPod,
    tromboneBloom,
    stackedHats,
    waffleFan,
    coilFountain,
    mittenShrub,
    dishBloom,
    accordionKelp,
    parasolSquid,
    sporkFern,
    ringNest,
    trumpetChoir,
    jellyComb,
    corkHorn,
    marbleReed,
    puffLadder,
    sawBloom,
    cupStack,
    ribbonKelp,
    orbitPod,
    clawFern,
    drumVine,
    petalGear,
    strawNest,
    blobPalm,
    zigTulip,
    moonFan,
    pipeBouquet,
    candySpine,
    loopShrub,
    bellTower,
    speckPod,
    curlCactus,
  };

  // Eight belts of 125 across world Y. Neighbors share one design; others do not.
  const EXOTIC_BELTS = [
    ["copperFunnel", "acidLantern", "magentaBellows", "lavenderSpoon", "tealCorkscrew", "jellyComb"],
    ["jellyComb", "yolkUmbrella", "zipperVine", "bubbleChimney", "hornedPod", "corkHorn"],
    ["corkHorn", "tromboneBloom", "stackedHats", "waffleFan", "coilFountain", "marbleReed"],
    ["marbleReed", "mittenShrub", "dishBloom", "accordionKelp", "parasolSquid", "puffLadder"],
    ["puffLadder", "sporkFern", "ringNest", "trumpetChoir", "sawBloom", "cupStack"],
    ["cupStack", "ribbonKelp", "orbitPod", "clawFern", "drumVine", "petalGear"],
    ["petalGear", "strawNest", "blobPalm", "zigTulip", "moonFan", "pipeBouquet"],
    ["pipeBouquet", "candySpine", "loopShrub", "bellTower", "speckPod", "curlCactus"],
  ];

  function exoticBelt(y) {
    const t = Math.max(0, Math.min(999.999, Number(y) || 0));
    return Math.min(EXOTIC_BELTS.length - 1, Math.floor(t / 125));
  }

  function exoticFamily(y) {
    return EXOTIC_BELTS[exoticBelt(y)];
  }

  function drawExotic(ctx, name, x, y, s, h, rand, U) {
    const fn = EXOTIC_DRAW[name];
    if (fn) fn(ctx, x, y, s, h, rand, U);
  }

  G.ink = { INK, TAU, clamp, col, mixC, shade, inkW, paint, stroke, leafPath, blobUnion, quadPath };
  G.props = {
    bush,
    tree,
    kitTree,
    kitHouse,
    kitWreck,
    codePost,
    wonder,
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
    lollipopTree,
    noodleTree,
    tubeCoral,
    cottonTree,
    pitcher,
    snail,
    floatingRock,
    totem,
    mailbox,
    glowCaps,
    skyJelly,
    copperFunnel,
    acidLantern,
    magentaBellows,
    lavenderSpoon,
    tealCorkscrew,
    yolkUmbrella,
    zipperVine,
    bubbleChimney,
    hornedPod,
    tromboneBloom,
    stackedHats,
    waffleFan,
    coilFountain,
    mittenShrub,
    dishBloom,
    accordionKelp,
    parasolSquid,
    sporkFern,
    ringNest,
    trumpetChoir,
    drawExotic,
    exoticBelt,
    exoticFamily,
    exoticBelts: EXOTIC_BELTS,
  };
})(window.ProbeDrop = window.ProbeDrop || {});
