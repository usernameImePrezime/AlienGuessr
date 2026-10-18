(function (G) {
  const { INK, TAU, col, inkW, paint, stroke } = G.ink;

  const REFLECTOR = { red: "#ff3d5a", yellow: "#ffd23d", white: "#fffdf4", cyan: "#45e6ff" };
  const CHEVRON = {
    redwhite: ["#e8323f", "#fffaf2"],
    yellowblack: ["#ffd23d", "#1b1033"],
    bluewhite: ["#2f63d8", "#fffaf2"],
    pinkgreen: ["#ff4f9a", "#7cf27c"],
  };
  const PLATE = {
    blueband: { bg: "#fffaf2", text: "#1b1033", band: "#2f5fd0" },
    yellow: { bg: "#ffd84a", text: "#1b1033" },
    white: { bg: "#fffaf2", text: "#1b1033" },
    black: { bg: "#241a33", text: "#fffaf2" },
    green: { bg: "#58c76a", text: "#fffaf2" },
  };
  const TAPE = { black: "#1b1033", orange: "#ff8a3d", cyan: "#45e6ff" };
  const CURB = {
    redwhite: ["#e8323f", "#fffaf2"],
    yellow: ["#ffd23d", "#ffd23d"],
    blackwhite: ["#241a33", "#fffaf2"],
  };
  const LINE = { yellow: "#ffd23d", dashed: "#fffaf2", double: "#ffd23d" };

  // ---------- flags ----------

  function flagShape(ctx, x, y, w, h, wave) {
    const a = h * 0.08 * wave;
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + w * 0.33, y - a, x + w * 0.66, y + a, x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.bezierCurveTo(x + w * 0.66, y + h + a, x + w * 0.33, y + h - a, x, y + h);
    ctx.closePath();
  }

  function emblemPath(ctx, kind, cx, cy, r) {
    if (kind === "star") {
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 ? r * 0.45 : r;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        if (i === 0) ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        else ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      ctx.closePath();
    } else if (kind === "moon") {
      ctx.arc(cx, cy, r, Math.PI * 0.3, Math.PI * 1.7);
      ctx.arc(cx + r * 0.45, cy, r * 0.78, Math.PI * 1.55, Math.PI * 0.45, true);
      ctx.closePath();
    } else if (kind === "eye") {
      ctx.moveTo(cx - r, cy);
      ctx.quadraticCurveTo(cx, cy - r * 1.1, cx + r, cy);
      ctx.quadraticCurveTo(cx, cy + r * 1.1, cx - r, cy);
      ctx.closePath();
    } else if (kind === "zig") {
      ctx.moveTo(cx - r, cy - r * 0.2);
      ctx.lineTo(cx - r * 0.3, cy - r);
      ctx.lineTo(cx, cy - r * 0.1);
      ctx.lineTo(cx + r * 0.4, cy - r * 0.8);
      ctx.lineTo(cx + r, cy + r * 0.2);
      ctx.lineTo(cx + r * 0.3, cy + r);
      ctx.lineTo(cx, cy + r * 0.1);
      ctx.lineTo(cx - r * 0.4, cy + r * 0.8);
      ctx.closePath();
    } else {
      ctx.moveTo(cx + r, cy);
      for (let i = 1; i <= 8; i++) {
        const a = (i / 8) * TAU;
        const rr = r * (i % 2 ? 0.78 : 1);
        ctx.quadraticCurveTo(cx + Math.cos(a - 0.4) * r * 1.1, cy + Math.sin(a - 0.4) * r * 1.1, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      ctx.closePath();
    }
  }

  function drawFlag(ctx, x, y, w, h, flag, emblem, wave, iw) {
    if (!flag) return;
    const [c0, c1, c2] = flag.colors;
    const wv = wave === undefined ? 1 : wave;
    ctx.save();
    ctx.beginPath();
    flagShape(ctx, x, y, w, h, wv);
    ctx.clip();
    const pad = h * 0.2;
    const L = flag.layout;
    const rect = (c, a, b, cw, ch) => {
      ctx.fillStyle = c;
      ctx.fillRect(a, b, cw, ch);
    };
    if (L === "stripesH") {
      [c0, c1, c2].forEach((c, i) => rect(c, x - 2, y - pad + (i * (h + pad * 2)) / 3, w + 4, (h + pad * 2) / 3 + 1));
    } else if (L === "stripesV") {
      [c0, c1, c2].forEach((c, i) => rect(c, x + (i * w) / 3, y - pad, w / 3 + 1, h + pad * 2));
    } else if (L === "dot") {
      rect(c0, x - 2, y - pad, w + 4, h + pad * 2);
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.arc(x + w * 0.5, y + h * 0.5, h * 0.34, 0, TAU);
      ctx.fill();
      ctx.fillStyle = c1;
      ctx.beginPath();
      ctx.arc(x + w * 0.5, y + h * 0.5, h * 0.24, 0, TAU);
      ctx.fill();
    } else if (L === "cross") {
      rect(c0, x - 2, y - pad, w + 4, h + pad * 2);
      rect(c1, x + w * 0.28, y - pad, h * 0.3, h + pad * 2);
      rect(c1, x - 2, y + h * 0.35, w + 4, h * 0.3);
      rect(c2, x + w * 0.28 + h * 0.08, y - pad, h * 0.14, h + pad * 2);
      rect(c2, x - 2, y + h * 0.43, w + 4, h * 0.14);
    } else if (L === "diagonal") {
      rect(c0, x - 2, y - pad, w + 4, h + pad * 2);
      ctx.fillStyle = c1;
      ctx.beginPath();
      ctx.moveTo(x + w + 2, y - pad);
      ctx.lineTo(x + w + 2, y + h + pad);
      ctx.lineTo(x - 2, y + h + pad);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = c2;
      ctx.lineWidth = h * 0.2;
      ctx.beginPath();
      ctx.moveTo(x - 2, y + h + pad * 0.5);
      ctx.lineTo(x + w + 2, y - pad * 0.5);
      ctx.stroke();
    } else {
      rect(c1, x - 2, y - pad, w + 4, h / 2 + pad);
      rect(c2, x - 2, y + h / 2, w + 4, h / 2 + pad);
      ctx.fillStyle = c0;
      ctx.beginPath();
      ctx.moveTo(x - 2, y - pad);
      ctx.lineTo(x + w * 0.45, y + h / 2);
      ctx.lineTo(x - 2, y + h + pad);
      ctx.closePath();
      ctx.fill();
    }
    if (emblem) {
      const r = h * 0.17;
      const ex = x + r * 1.5;
      const ey = y + r * 1.45;
      ctx.fillStyle = "rgba(255, 252, 244, 0.95)";
      ctx.beginPath();
      ctx.arc(ex, ey, r * 1.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = emblem.color;
      ctx.beginPath();
      emblemPath(ctx, emblem.emblem, ex, ey, r);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(0.6, iw * 0.5);
      ctx.stroke();
    }
    if (G.wc && G.wc.active()) G.wc.texture(ctx, x - 2, y - pad, w + 4, h + pad * 2, 0.5);
    ctx.restore();
    stroke(ctx, () => flagShape(ctx, x, y, w, h, wv), INK, iw);
  }

  function flagpole(ctx, x, y, s, flag, emblem, U, flip) {
    const iw = inkW(s, U);
    const h = s * 5.4;
    const fw = s * 1.7 * (flip ? -1 : 1);
    stroke(ctx, () => {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - h);
    }, INK, Math.max(1.6, s * 0.09) + iw);
    stroke(ctx, () => {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - h);
    }, "#e8e4f0", Math.max(1, s * 0.09));
    paint(ctx, () => ctx.arc(x, y - h - s * 0.1, Math.max(1.5, s * 0.12), 0, TAU), "#ffd84a", { ink: iw * 0.8 });
    ctx.save();
    if (flip) {
      ctx.translate(x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-x, 0);
    }
    drawFlag(ctx, x, y - h + s * 0.1, Math.abs(fw), s * 1.05, flag, emblem, 1, iw);
    ctx.restore();
  }

  // ---------- roadside ----------

  function bollard(ctx, x, y, s, spec, U) {
    if (!spec || s < 2) return;
    const iw = inkW(s, U) * 0.9;
    const h = s * 1.0;
    const w = s * 0.2;
    const body = "#fbf7ef";
    const dark = "#2a2038";
    const refl = REFLECTOR[spec.reflector] || REFLECTOR.red;
    ctx.fillStyle = "rgba(27, 16, 51, 0.2)";
    ctx.beginPath();
    ctx.ellipse(x, y, w * 1.2, w * 0.3, 0, 0, TAU);
    ctx.fill();
    if (spec.shape === "pill") {
      paint(ctx, () => ctx.roundRect(x - w / 2, y - h, w, h, w / 2), body, { ink: iw });
      paint(ctx, () => ctx.rect(x - w / 2, y - h * 0.82, w, h * 0.16), dark);
      paint(ctx, () => ctx.roundRect(x - w * 0.3, y - h * 0.8, w * 0.6, h * 0.12, w * 0.1), refl);
    } else if (spec.shape === "cap") {
      paint(ctx, () => ctx.rect(x - w * 0.4, y - h * 0.86, w * 0.8, h * 0.86), body, { ink: iw });
      paint(ctx, () => ctx.ellipse(x, y - h * 0.86, w * 0.75, w * 0.42, 0, Math.PI, TAU), dark, { ink: iw });
      paint(ctx, () => ctx.arc(x, y - h * 0.66, w * 0.24, 0, TAU), refl, { ink: iw * 0.6 });
    } else if (spec.shape === "square") {
      paint(ctx, () => {
        ctx.moveTo(x - w / 2, y);
        ctx.lineTo(x - w / 2, y - h * 0.92);
        ctx.lineTo(x + w / 2, y - h);
        ctx.lineTo(x + w / 2, y);
        ctx.closePath();
      }, body, { ink: iw });
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - w / 2, y - h, w, h);
      ctx.clip();
      ctx.strokeStyle = dark;
      ctx.lineWidth = w * 0.32;
      ctx.beginPath();
      ctx.moveTo(x - w, y - h * 0.5);
      ctx.lineTo(x + w, y - h * 0.82);
      ctx.stroke();
      ctx.restore();
      paint(ctx, () => ctx.rect(x - w * 0.32, y - h * 0.4, w * 0.64, h * 0.1), refl, { ink: iw * 0.5 });
    } else {
      paint(ctx, () => {
        ctx.moveTo(x - w * 0.5, y);
        ctx.bezierCurveTo(x - w * 0.9, y - h * 0.5, x - w * 0.4, y - h * 1.05, x + w * 0.1, y - h);
        ctx.bezierCurveTo(x + w * 0.8, y - h * 0.95, x + w * 0.7, y - h * 0.4, x + w * 0.5, y);
        ctx.closePath();
      }, "#ffd6ec", { ink: iw });
      paint(ctx, () => ctx.ellipse(x, y - h * 0.72, w * 0.26, w * 0.34, 0.3, 0, TAU), refl, { ink: iw * 0.6 });
    }
    if (s > 30) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.beginPath();
      ctx.ellipse(x - w * 0.22, y - h * 0.5, w * 0.08, h * 0.18, 0, 0, TAU);
      ctx.fill();
    }
  }

  function chevron(ctx, x, y, s, scheme, dir, U) {
    if (!scheme || s < 2) return;
    const iw = inkW(s, U);
    const [bg, fg] = CHEVRON[scheme] || CHEVRON.redwhite;
    const w = s * 0.9;
    const h = s * 0.62;
    const top = y - s * 1.9;
    stroke(ctx, () => {
      ctx.moveTo(x, y);
      ctx.lineTo(x, top + h);
    }, INK, Math.max(1.4, s * 0.07) + iw);
    stroke(ctx, () => {
      ctx.moveTo(x, y);
      ctx.lineTo(x, top + h);
    }, "#cfc8dc", Math.max(1, s * 0.07));
    paint(ctx, () => ctx.rect(x - w / 2, top, w, h), bg, { ink: iw });
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - w / 2, top, w, h);
    ctx.clip();
    ctx.fillStyle = fg;
    for (let k = -1; k <= 1; k++) {
      const cx = x + k * w * 0.3;
      const d = dir || 1;
      ctx.beginPath();
      ctx.moveTo(cx - d * w * 0.12, top + h * 0.12);
      ctx.lineTo(cx + d * w * 0.06, top + h * 0.5);
      ctx.lineTo(cx - d * w * 0.12, top + h * 0.88);
      ctx.lineTo(cx - d * w * 0.02, top + h * 0.88);
      ctx.lineTo(cx + d * w * 0.16, top + h * 0.5);
      ctx.lineTo(cx - d * w * 0.02, top + h * 0.12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function guardrail(ctx, view, xAt, z0, z1, style, U) {
    if (!style) return;
    const X = typeof xAt === "function" ? xAt : () => xAt;
    const v = { p: (x, z, y) => view.p(X(z), z, y) };
    const step = style === "logs" ? 2.2 : 2;
    const posts = [];
    for (let z = z0; z <= z1 + 0.01; z += step) posts.push(z);
    if (posts[posts.length - 1] < z1 - 0.01) posts.push(z1);
    guardrailPosts(ctx, v, posts, style, U);
  }

  function guardrailPosts(ctx, view, posts, style, U) {
    const x = 0;
    const z0 = posts[0];
    const height = style === "cable" ? 0.85 : 0.75;
    const iw = inkW(view.p(x, z0, 0).s, U);
    const postColor = style === "logs" ? { h: 28, s: 45, l: 42 } : { h: 240, s: 8, l: 58 };
    posts.forEach((z) => {
      const b = view.p(x, z, 0);
      const t = view.p(x, z, height + 0.05);
      stroke(ctx, () => {
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(t.x, t.y);
      }, INK, Math.max(1.4, b.s * 0.1) + iw * 0.8);
      stroke(ctx, () => {
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(t.x, t.y);
      }, col(postColor), Math.max(1, b.s * 0.1));
    });
    const rail = (y0, y1, fill, ink) => {
      paint(ctx, () => {
        posts.forEach((z, i) => {
          const p = view.p(x, z, y1);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        for (let i = posts.length - 1; i >= 0; i--) {
          const p = view.p(x, posts[i], y0);
          ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
      }, fill, { ink: ink });
    };
    const line = (y, color, w) => stroke(ctx, () => {
      posts.forEach((z, i) => {
        const p = view.p(x, z, y);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
    }, color, w);
    if (style === "wbeam") {
      rail(height - 0.32, height, col({ h: 230, s: 10, l: 78 }), iw);
      line(height - 0.16, "rgba(80, 70, 110, 0.6)", Math.max(0.8, iw * 0.7));
      line(height - 0.05, "rgba(255, 255, 255, 0.8)", Math.max(0.6, iw * 0.5));
    } else if (style === "cable") {
      [0.35, 0.58, 0.8].forEach((y) => line(y, INK, Math.max(0.7, iw * 0.7)));
    } else if (style === "logs") {
      rail(height - 0.22, height, col({ h: 30, s: 48, l: 52 }), iw);
      line(height - 0.11, "rgba(90, 50, 20, 0.5)", Math.max(0.6, iw * 0.5));
    } else {
      [0.38, 0.7].forEach((y) => {
        line(y, INK, Math.max(1.8, view.p(x, z0, 0).s * 0.1) + iw);
        line(y, "#ff8ac0", Math.max(1.2, view.p(x, z0, 0).s * 0.1));
      });
    }
  }

  function kmMarker(ctx, x, y, s, style, number, U) {
    if (!style || s < 2) return;
    const iw = inkW(s, U);
    const label = String(number);
    const text = (cx, cy, size, color) => {
      if (size < 5) return;
      ctx.save();
      ctx.font = `700 ${size}px Fredoka, "Segoe UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      ctx.fillText(label, cx, cy);
      ctx.restore();
    };
    ctx.fillStyle = "rgba(27, 16, 51, 0.2)";
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.3, s * 0.07, 0, 0, TAU);
    ctx.fill();
    if (style === "slab") {
      const w = s * 0.42;
      const h = s * 0.62;
      paint(ctx, () => ctx.rect(x - w / 2, y - h, w, h), "#fbf7ef", { ink: iw });
      paint(ctx, () => ctx.rect(x - w / 2, y - h, w, h * 0.3), "#e8323f", { ink: iw * 0.7 });
      text(x, y - h * 0.42, w * 0.42, INK);
    } else if (style === "stripe") {
      const w = s * 0.2;
      const h = s * 1.1;
      paint(ctx, () => ctx.rect(x - w / 2, y - h, w, h), "#fbf7ef", { ink: iw });
      paint(ctx, () => ctx.rect(x - w / 2, y - h, w, h * 0.18), "#241a33");
      paint(ctx, () => ctx.rect(x - w / 2, y - h * 0.58, w, h * 0.08), "#ffd23d");
      text(x, y - h * 0.35, w * 0.6, INK);
    } else if (style === "round") {
      const w = s * 0.46;
      const h = s * 0.6;
      paint(ctx, () => {
        ctx.moveTo(x - w / 2, y);
        ctx.lineTo(x - w / 2, y - h + w / 2);
        ctx.arc(x, y - h + w / 2, w / 2, Math.PI, TAU);
        ctx.lineTo(x + w / 2, y);
        ctx.closePath();
      }, "#e9e2d6", { ink: iw });
      paint(ctx, () => ctx.arc(x, y - h + w / 2, w / 2, Math.PI, TAU), "#ffd23d", { ink: iw * 0.7 });
      text(x, y - h * 0.38, w * 0.38, INK);
    } else {
      const w = s * 0.5;
      const h = s * 0.42;
      const top = y - s * 1.3;
      stroke(ctx, () => {
        ctx.moveTo(x, y);
        ctx.lineTo(x, top + h);
      }, INK, Math.max(1.2, s * 0.06) + iw);
      paint(ctx, () => ctx.roundRect(x - w / 2, top, w, h, w * 0.1), "#2f63d8", { ink: iw });
      text(x, top + h * 0.54, h * 0.56, "#fffaf2");
    }
  }

  function phoneIcon(ctx, x, y, r, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x - r, y - r * 0.15, r * 2, r * 0.95, r * 0.25);
    ctx.fill();
    ctx.lineWidth = r * 0.42;
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(x, y + r * 0.05, r * 0.85, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    ctx.restore();
  }

  function billboard(ctx, x, y, s, spec, U) {
    if (s < 2) return;
    const iw = inkW(s, U);
    const w = s * (spec.small ? 1.5 : 3.2);
    const h = s * (spec.small ? 1.0 : 1.7);
    const bottom = y - s * (spec.small ? 0.55 : 2.1);
    const top = bottom - h;
    const legs = spec.small ? [-0.36, 0.36] : [-0.32, 0.32];
    legs.forEach((k) => {
      stroke(ctx, () => {
        ctx.moveTo(x + w * k, y);
        ctx.lineTo(x + w * k, bottom);
      }, INK, Math.max(1.6, s * 0.08) + iw);
      stroke(ctx, () => {
        ctx.moveTo(x + w * k, y);
        ctx.lineTo(x + w * k, bottom);
      }, "#9c8fb4", Math.max(1, s * 0.08));
    });
    const bg = spec.bg || { h: 48, s: 90, l: 72 };
    paint(ctx, () => ctx.roundRect(x - w / 2, top, w, h, h * 0.08), col(bg), { ink: iw * 1.2, glaze: col(bg, -18), edge: h * 0.1 });
    paint(ctx, () => ctx.roundRect(x - w / 2 + h * 0.06, top + h * 0.06, w - h * 0.12, h * 0.34, h * 0.05), col(spec.accent || { h: 330, s: 85, l: 64 }));
    const lines = [];
    if (spec.phone) lines.push({ phone: true, text: spec.phone });
    if (spec.domain) lines.push({ text: spec.domain });
    if (!lines.length) lines.push({ text: spec.word || "ZORP" });
    const titleSize = h * 0.24;
    if (titleSize >= 4) {
      ctx.save();
      ctx.font = `${titleSize}px "Luckiest Guy", Fredoka, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fffaf2";
      ctx.fillText(spec.word || "ZORP", x, top + h * 0.24);
      ctx.restore();
    }
    const area = { y0: top + h * 0.44, y1: top + h * 0.95 };
    const rowH = (area.y1 - area.y0) / lines.length;
    lines.forEach((row, i) => {
      const cy = area.y0 + rowH * (i + 0.5);
      const size = Math.min(rowH * 0.78, (w * 0.82) / Math.max(5, row.text.length * 0.56 + (row.phone ? 1.6 : 0)));
      if (size < 4.5) return;
      ctx.save();
      ctx.font = `700 ${size}px Fredoka, "Segoe UI", sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const tw = ctx.measureText(row.text).width;
      const icon = row.phone ? size * 1.15 : 0;
      const start = x - (tw + icon) / 2;
      if (row.phone) phoneIcon(ctx, start + size * 0.45, cy, size * 0.42, INK);
      ctx.fillStyle = INK;
      ctx.fillText(row.text, start + icon, cy + size * 0.04);
      ctx.restore();
    });
  }

  function plate(ctx, x, y, w, spec, U) {
    if (!spec || w < 4) return;
    const p = PLATE[spec.style] || PLATE.white;
    const h = w * 0.36;
    paint(ctx, () => ctx.roundRect(x - w / 2, y - h / 2, w, h, h * 0.18), p.bg, { ink: Math.max(0.6, U * 0.8) });
    if (p.band) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - h / 2, w, h, h * 0.18);
      ctx.clip();
      ctx.fillStyle = p.band;
      ctx.fillRect(x - w / 2, y - h / 2, w * 0.16, h);
      ctx.restore();
    }
    const size = h * 0.66;
    if (size < 4) return;
    ctx.save();
    ctx.font = `700 ${size}px Fredoka, "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = p.text;
    ctx.fillText(spec.text, x + (p.band ? w * 0.07 : 0), y + size * 0.05);
    ctx.restore();
  }

  // ---------- probe car ----------

  function probeCar(ctx, W, H, spec, sky, U) {
    if (!spec) return;
    const cx = W * 0.5;
    const top = H * 0.9;
    const hw = W * 0.4;
    const hood = () => {
      ctx.moveTo(cx - hw * 1.2, H + 4);
      ctx.bezierCurveTo(cx - hw * 1.05, top + H * 0.02, cx - hw * 0.6, top, cx, top);
      ctx.bezierCurveTo(cx + hw * 0.6, top, cx + hw * 1.05, top + H * 0.02, cx + hw * 1.2, H + 4);
      ctx.closePath();
    };
    const body = { h: 36, s: 42, l: 48 };
    const g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, col(body, 8));
    g.addColorStop(0.4, col(body, 0));
    g.addColorStop(1, col(body, -18));
    paint(ctx, hood, g, { ink: 2.2 * U, glaze: col(body, -24), edge: 18 * U });
    ctx.save();
    ctx.beginPath();
    hood();
    ctx.clip();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = col(sky, 6);
    ctx.beginPath();
    ctx.ellipse(cx - hw * 0.15, top + H * 0.03, hw * 0.55, H * 0.018, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    const tape = TAPE[spec.tape];
    if (tape) {
      ctx.fillStyle = tape;
      [-1, 1].forEach((side) => {
        ctx.save();
        ctx.translate(cx + side * hw * 0.55, top + H * 0.05);
        ctx.rotate(side * 0.18);
        ctx.fillRect(-hw * 0.08, -H * 0.04, hw * 0.16, H * 0.12);
        ctx.restore();
      });
    }
    ctx.restore();
    const ax = cx + hw * 0.78;
    const ay = top + H * 0.035;
    const iw = 2 * U;
    if (spec.antenna === "snorkel") {
      const tubeBuild = () => {
        ctx.moveTo(ax, ay + 6 * U);
        ctx.lineTo(ax, ay - 70 * U);
        ctx.quadraticCurveTo(ax, ay - 92 * U, ax - 20 * U, ay - 92 * U);
      };
      stroke(ctx, tubeBuild, INK, 15 * U);
      stroke(ctx, tubeBuild, "#3a3248", 11 * U);
      paint(ctx, () => ctx.roundRect(ax - 30 * U, ay - 101 * U, 14 * U, 18 * U, 4 * U), "#3a3248", { ink: iw });
    } else if (spec.antenna === "dish") {
      stroke(ctx, () => {
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax, ay - 40 * U);
      }, INK, 4 * U);
      paint(ctx, () => ctx.ellipse(ax, ay - 52 * U, 24 * U, 14 * U, -0.5, 0, TAU), "#f4f0fa", { ink: iw });
      stroke(ctx, () => {
        ctx.moveTo(ax, ay - 52 * U);
        ctx.lineTo(ax + 14 * U, ay - 70 * U);
      }, INK, 2 * U);
      paint(ctx, () => ctx.arc(ax + 14 * U, ay - 70 * U, 3.5 * U, 0, TAU), "#ff4f9a", { ink: iw * 0.6 });
    } else if (spec.antenna === "whip") {
      stroke(ctx, () => {
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(ax - 4 * U, ay - 80 * U, ax - 26 * U, ay - 150 * U);
      }, INK, 2.6 * U);
      paint(ctx, () => ctx.arc(ax - 26 * U, ay - 152 * U, 4 * U, 0, TAU), "#ffd84a", { ink: iw * 0.6 });
    } else {
      stroke(ctx, () => {
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax, ay - 34 * U);
      }, INK, 4 * U);
      paint(ctx, () => ctx.arc(ax, ay - 46 * U, 13 * U, 0, TAU), "#5ff2ff", { ink: iw, glaze: "#2fb8d0", edge: 4 * U });
      paint(ctx, () => ctx.arc(ax - 4 * U, ay - 50 * U, 3.5 * U, 0, TAU), "rgba(255, 255, 255, 0.85)");
    }
    paint(ctx, () => ctx.roundRect(ax - 9 * U, ay - 4 * U, 18 * U, 9 * U, 3 * U), "#3a3248", { ink: iw * 0.7 });
    stroke(ctx, () => {
      ctx.moveTo(cx - hw * 0.7, top + H * 0.02);
      ctx.lineTo(cx + hw * 0.7, top + H * 0.02);
    }, "#39f3ff", Math.max(2, 2.4 * U));
  }

  // ---------- sun ----------

  function sun(ctx, x, y, r, U) {
    const halo = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 4);
    halo.addColorStop(0, "rgba(255, 244, 196, 0.75)");
    halo.addColorStop(0.35, "rgba(255, 226, 150, 0.3)");
    halo.addColorStop(1, "rgba(255, 220, 140, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    stroke(ctx, () => {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + 0.13;
        ctx.moveTo(x + Math.cos(a) * r * 1.25, y + Math.sin(a) * r * 1.25);
        ctx.lineTo(x + Math.cos(a) * r * (i % 2 ? 1.55 : 1.8), y + Math.sin(a) * r * (i % 2 ? 1.55 : 1.8));
      }
    }, "rgba(255, 200, 90, 0.85)", Math.max(1.5, r * 0.12));
    paint(ctx, () => ctx.arc(x, y, r, 0, TAU), "#fff1a6", { ink: 1.6 * U, glaze: "#ffc64a", edge: r * 0.35 });
    paint(ctx, () => ctx.arc(x - r * 0.3, y - r * 0.32, r * 0.22, 0, TAU), "rgba(255, 255, 255, 0.8)");
  }

  function sunGlow(ctx, W, H, side, strength) {
    const x = side < 0 ? 0 : W;
    const g = ctx.createRadialGradient(x, H * 0.18, 0, x, H * 0.18, W * 0.55);
    g.addColorStop(0, `rgba(255, 240, 190, ${0.55 * strength})`);
    g.addColorStop(0.5, `rgba(255, 222, 160, ${0.2 * strength})`);
    g.addColorStop(1, "rgba(255, 220, 160, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * 0.6);
  }

  Object.assign(G.props, {
    drawFlag,
    flagpole,
    bollard,
    chevron,
    guardrail,
    kmMarker,
    billboard,
    plate,
    probeCar,
    sun,
    sunGlow,
  });
  G.metaColors = { REFLECTOR, CHEVRON, PLATE, TAPE, CURB, LINE };
})(window.ProbeDrop = window.ProbeDrop || {});
