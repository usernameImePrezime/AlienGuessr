(function (G) {
  const INK = "#1b1033";
  const TAU = Math.PI * 2;
  const IW = 11;
  const W = 400;
  const H = 470;
  const GY = 450;
  const CX = 200;

  const TINTS = {
    pink: [
      { base: "#ff7ab6", shade: "#e0509a", light: "#ffc8e2", belly: "#ffd9ea" },
      { base: "#ff97c6", shade: "#e66aa8", light: "#ffd6ea", belly: "#ffe4f0" },
      { base: "#f562a6", shade: "#c93d84", light: "#ffb6d8", belly: "#ffcfe5" },
    ],
    blue: [
      { base: "#62a0ff", shade: "#3d6fdc", light: "#c2d9ff", belly: "#d6e6ff" },
      { base: "#80b6ff", shade: "#568ae6", light: "#d4e5ff", belly: "#e3eeff" },
      { base: "#4f86f2", shade: "#335fc8", light: "#adc9ff", belly: "#cadcff" },
    ],
    yellow: [
      { base: "#ffd84a", shade: "#e0a92a", light: "#fff1a8", belly: "#fff6c8" },
      { base: "#ffe36e", shade: "#e6b844", light: "#fff5bd", belly: "#fffad8" },
      { base: "#f7c933", shade: "#cc9418", light: "#ffe58c", belly: "#fff0b8" },
    ],
    green: [
      { base: "#6fdc6a", shade: "#45b04a", light: "#c4f5b8", belly: "#dcf9d2" },
      { base: "#8ce884", shade: "#5fbe60", light: "#d2f8c8", belly: "#e6fbe0" },
      { base: "#52c75a", shade: "#349a3e", light: "#a8eda0", belly: "#c8f4c0" },
    ],
  };

  const BODY = {
    A: { w: 150, h: 190, name: "Bean" },
    B: { w: 168, h: 180, name: "Pear" },
    C: { w: 104, h: 232, name: "Noodle" },
    D: { w: 164, h: 166, name: "Gumdrop" },
    E: { w: 154, h: 156, name: "Marshmallow" },
    F: { w: 172, h: 172, name: "Ball" },
    G: { w: 86, h: 268, name: "Stalk" },
    H: { w: 220, h: 96, name: "Pancake" },
    I: { w: 150, h: 230, name: "Stack" },
    J: { w: 118, h: 248, name: "Sausage" },
  };
  const LEG_LEN = { A: 72, B: 62, C: 78, D: 26, E: 112 };
  const ARM_LEN = { A: 84, B: 74, C: 84, D: 28, E: 124 };
  const SHOES = { A: "#2b1d44", B: "#ffffff", C: "#ffe56b", D: null, E: "#2b1d44" };

  const EYE_NAMES = {
    cute_light: "shiny eyes",
    human: "brown eyes",
    psycho_light: "tiny-pupil eyes",
    yellow: "slit eyes",
    red: "red eyes",
    blue: "blue eyes",
    angry_blue: "grumpy eyes",
    human_green: "sleepy green eyes",
    cute_dark: "dot eyes",
  };
  const DETAIL_NAMES = {
    antenna_large: "long antenna",
    antenna_small: "short antennae",
    ear: "pointy ears",
    ear_round: "round ears",
    horn_large: "big horns",
    horn_small: "little horns",
    none: "bald",
  };

  function makeCanvas(w, h) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }

  function pen(ctx, build, width) {
    G.wc.line(ctx, build, width || IW);
  }

  function inked(ctx, build, fill, width) {
    G.wc.wash(ctx, build, fill, { mottle: 0.5 });
    if ((width === undefined ? IW : width) > 0.05) pen(ctx, build, width || IW);
  }

  function noodle(ctx, build, color, width) {
    pen(ctx, build, 2);
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    build();
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = G.wc.patternFor(ctx, "mottle");
    ctx.stroke();
    ctx.save();
    ctx.translate(width * 0.22, width * 0.12);
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = "rgb(90, 40, 120)";
    ctx.lineWidth = width * 0.42;
    ctx.beginPath();
    build();
    ctx.stroke();
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
    ctx.translate(-width * 0.2, -width * 0.12);
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = "#fffaf2";
    ctx.lineWidth = width * 0.2;
    ctx.beginPath();
    build();
    ctx.stroke();
    ctx.restore();
  }

  function glow(ctx, x, y, r, rgb) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb}, 0.55)`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  function outside(ctx, build) {
    ctx.beginPath();
    ctx.rect(-1e4, -1e4, 2e4, 2e4);
    build();
    ctx.clip("evenodd");
  }

  // ---------- bodies ----------

  function bodyPath(ctx, kind, cx, by, bw, bh) {
    const top = by - bh;
    const hw = bw / 2;
    if (kind === "A") {
      ctx.moveTo(cx - hw * 0.1, top);
      ctx.bezierCurveTo(cx + hw * 1.05, top - bh * 0.02, cx + hw * 1.08, by - bh * 0.35, cx + hw * 0.82, by - bh * 0.06);
      ctx.bezierCurveTo(cx + hw * 0.6, by + bh * 0.03, cx - hw * 0.7, by + bh * 0.03, cx - hw * 0.92, by - bh * 0.1);
      ctx.bezierCurveTo(cx - hw * 1.1, by - bh * 0.45, cx - hw * 0.95, top + bh * 0.02, cx - hw * 0.1, top);
    } else if (kind === "B") {
      ctx.moveTo(cx, top);
      ctx.bezierCurveTo(cx + hw * 0.62, top, cx + hw * 0.5, top + bh * 0.38, cx + hw * 0.92, by - bh * 0.3);
      ctx.bezierCurveTo(cx + hw * 1.12, by - bh * 0.1, cx + hw * 0.8, by + bh * 0.02, cx, by + bh * 0.02);
      ctx.bezierCurveTo(cx - hw * 0.8, by + bh * 0.02, cx - hw * 1.12, by - bh * 0.1, cx - hw * 0.92, by - bh * 0.3);
      ctx.bezierCurveTo(cx - hw * 0.5, top + bh * 0.38, cx - hw * 0.62, top, cx, top);
    } else if (kind === "C") {
      ctx.moveTo(cx - hw, top + hw);
      ctx.arc(cx, top + hw, hw, Math.PI, 0);
      ctx.bezierCurveTo(cx + hw * 1.05, top + bh * 0.5, cx + hw * 1.1, by - hw * 0.4, cx + hw * 0.9, by - hw * 0.1);
      ctx.quadraticCurveTo(cx, by + hw * 0.12, cx - hw * 0.9, by - hw * 0.1);
      ctx.bezierCurveTo(cx - hw * 1.1, by - hw * 0.4, cx - hw * 1.05, top + bh * 0.5, cx - hw, top + hw);
    } else if (kind === "D") {
      ctx.moveTo(cx - hw * 1.02, by);
      ctx.bezierCurveTo(cx - hw * 1.05, top + bh * 0.1, cx - hw * 0.3, top - bh * 0.04, cx, top);
      ctx.bezierCurveTo(cx + hw * 0.3, top - bh * 0.04, cx + hw * 1.05, top + bh * 0.1, cx + hw * 1.02, by);
      ctx.quadraticCurveTo(cx, by + bh * 0.06, cx - hw * 1.02, by);
    } else if (kind === "E") {
      const r = bw * 0.26;
      ctx.moveTo(cx - hw + r, top);
      ctx.quadraticCurveTo(cx, top - bh * 0.04, cx + hw - r, top);
      ctx.quadraticCurveTo(cx + hw, top, cx + hw, top + r);
      ctx.quadraticCurveTo(cx + hw * 1.04, top + bh * 0.5, cx + hw, by - r);
      ctx.quadraticCurveTo(cx + hw, by, cx + hw - r, by);
      ctx.quadraticCurveTo(cx, by + bh * 0.04, cx - hw + r, by);
      ctx.quadraticCurveTo(cx - hw, by, cx - hw, by - r);
      ctx.quadraticCurveTo(cx - hw * 1.04, top + bh * 0.5, cx - hw, top + r);
      ctx.quadraticCurveTo(cx - hw, top, cx - hw + r, top);
    } else if (kind === "G") {
      ctx.moveTo(cx - hw * 0.32, by);
      ctx.lineTo(cx - hw * 0.48, top + bh * 0.34);
      ctx.quadraticCurveTo(cx - hw * 0.95, top + bh * 0.1, cx, top);
      ctx.quadraticCurveTo(cx + hw * 0.95, top + bh * 0.1, cx + hw * 0.48, top + bh * 0.34);
      ctx.lineTo(cx + hw * 0.32, by);
    } else if (kind === "H") {
      ctx.ellipse(cx, by - bh * 0.46, hw, bh * 0.42, 0, 0, TAU);
    } else if (kind === "I") {
      ctx.ellipse(cx, by - bh * 0.24, hw * 0.95, bh * 0.24, 0, 0, TAU);
      ctx.moveTo(cx + hw * 0.58, by - bh * 0.7);
      ctx.ellipse(cx, by - bh * 0.7, hw * 0.58, bh * 0.2, 0, 0, TAU);
    } else if (kind === "J") {
      const r = hw * 0.78;
      ctx.moveTo(cx - r, top + r);
      ctx.arc(cx, top + r, r, Math.PI, 0);
      ctx.lineTo(cx + r, by - r);
      ctx.arc(cx, by - r, r, 0, Math.PI);
    } else {
      ctx.moveTo(cx + hw, by - bh / 2);
      ctx.ellipse(cx, by - bh / 2, hw, bh / 2, 0, 0, TAU);
    }
    ctx.closePath();
  }

  function drawBody(ctx, kind, cx, by, bw, bh, tint, variant) {
    const build = () => bodyPath(ctx, kind, cx, by, bw, bh);
    const lit = () => bodyPath(ctx, kind, cx - bw * 0.12, by - bh * 0.06, bw * 0.98, bh * 0.98);
    G.wc.wash(ctx, build, tint.shade, { mottle: 0.65 });
    ctx.save();
    ctx.beginPath();
    build();
    ctx.clip();
    G.wc.wash(ctx, lit, tint.base, { mottle: 0.55, bleed: 1.6 });
    if (kind === "A" || kind === "B" || kind === "D" || kind === "E" || kind === "F" || kind === "H" || kind === "I" || kind === "J" || kind === "C" || kind === "G") {
      G.wc.wash(ctx, () => ctx.ellipse(cx - bw * 0.02, by - bh * 0.22, bw * 0.28, bh * 0.16, 0, 0, TAU), tint.belly, { alpha: 0.8 });
      pen(ctx, () => ctx.arc(cx - bw * 0.02, by - bh * 0.16, bw * 0.02, 0.2, Math.PI - 0.2), 2);
    }
    for (let i = 0; i < 4; i++) {
      const fx = cx + bw * ((i % 2 ? 0.16 : -0.12) + (i > 1 ? 0.05 : 0));
      const fy = by - bh * (0.34 + (i % 3) * 0.08);
      G.wc.wash(ctx, () => ctx.arc(fx, fy, bw * 0.035, 0, TAU), tint.shade, { alpha: 0.7 });
    }
    G.wc.bloom(ctx, cx + bw * 0.2, by - bh * 0.42, bw * 0.13, tint.shade, 0.3);
    G.wc.bloom(ctx, cx - bw * 0.1, by - bh * 0.55, bw * 0.1, tint.light, 0.4);
    G.wc.bloom(ctx, cx - bw * 0.22, by - bh * 0.72, bw * 0.13, "#fffaf2", 0.85);
    G.wc.bloom(ctx, cx - bw * 0.05, by - bh * 0.85, bw * 0.04, "#fffaf2", 0.9);
    if (variant === 1) {
      for (let i = 0; i < 7; i++) {
        const fx = cx + bw * (0.1 + (i % 4) * 0.07);
        const fy = by - bh * (0.14 + Math.floor(i / 4) * 0.09 + (i % 2) * 0.02);
        G.wc.wash(ctx, () => ctx.arc(fx, fy, bw * (0.018 + (i % 3) * 0.006), 0, TAU), tint.shade, { flat: true, bleed: 0.4 });
      }
    } else if (variant === 2) {
      [[0.24, 0.3, 0.07], [0.3, 0.5, 0.045], [-0.32, 0.35, 0.05]].forEach(([dx, dy, r]) => {
        G.wc.wash(ctx, () => ctx.ellipse(cx + bw * dx, by - bh * dy, bw * r, bw * r * 0.8, 0.4, 0, TAU), tint.light, { alpha: 0.8, mottle: 0.3 });
      });
    }
    ctx.save();
    outside(ctx, lit);
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = G.wc.PEN;
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let k = -bh; k < bw + bh; k += 8) {
      ctx.moveTo(cx - bw / 2 + k, by + 12);
      ctx.lineTo(cx - bw / 2 + k + bh * 0.7, by - bh * 0.7);
    }
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  // ---------- head details ----------

  function drawDetail(ctx, kind, cx, top, bw, tint) {
    if (kind === "none") return;
    const sides = [-1, 1];
    if (kind === "antenna_large") {
      const build = () => {
        ctx.moveTo(cx, top + 6);
        ctx.bezierCurveTo(cx - 6, top - 30, cx + 34, top - 40, cx + 22, top - 72);
      };
      noodle(ctx, build, tint.base, 7);
      glow(ctx, cx + 22, top - 80, 34, "255, 229, 107");
      inked(ctx, () => ctx.arc(cx + 22, top - 80, 15, 0, TAU), "#ffe56b");
      G.wc.bloom(ctx, cx + 26, top - 76, 7, "#ffb43b", 0.5);
      inked(ctx, () => ctx.arc(cx + 17, top - 85, 4, 0, TAU), "#fff", 0.01);
    } else if (kind === "antenna_small") {
      sides.forEach((s) => {
        const bx = cx + s * bw * 0.2;
        noodle(ctx, () => {
          ctx.moveTo(bx, top + 8);
          ctx.quadraticCurveTo(bx + s * 4, top - 16, bx + s * 14, top - 30);
        }, tint.base, 6);
        glow(ctx, bx + s * 14, top - 36, 22, s < 0 ? "95, 242, 255" : "198, 255, 74");
        inked(ctx, () => ctx.arc(bx + s * 14, top - 36, 10, 0, TAU), s < 0 ? "#5ff2ff" : "#c6ff4a");
        inked(ctx, () => ctx.arc(bx + s * 14 - 3, top - 39, 2.6, 0, TAU), "#fff", 0.01);
      });
    } else if (kind === "ear") {
      sides.forEach((s) => {
        const bx = cx + s * bw * 0.28;
        inked(ctx, () => {
          ctx.moveTo(bx - s * 26, top + 22);
          ctx.quadraticCurveTo(bx + s * 6, top - 50, bx + s * 34, top - 34);
          ctx.quadraticCurveTo(bx + s * 30, top + 6, bx + s * 22, top + 30);
          ctx.closePath();
        }, tint.base);
        inked(ctx, () => {
          ctx.moveTo(bx - s * 10, top + 14);
          ctx.quadraticCurveTo(bx + s * 10, top - 26, bx + s * 24, top - 20);
          ctx.quadraticCurveTo(bx + s * 20, top + 4, bx + s * 14, top + 18);
          ctx.closePath();
        }, tint.light, 3);
      });
    } else if (kind === "ear_round") {
      sides.forEach((s) => {
        const bx = cx + s * bw * 0.34;
        inked(ctx, () => ctx.arc(bx, top + 8, 26, 0, TAU), tint.base);
        inked(ctx, () => ctx.arc(bx, top + 8, 13, 0, TAU), tint.light, 3);
      });
    } else {
      const big = kind === "horn_large";
      sides.forEach((s) => {
        const bx = cx + s * bw * 0.24;
        const h = big ? 64 : 30;
        const horn = () => {
          ctx.moveTo(bx - s * (big ? 16 : 10), top + 16);
          ctx.quadraticCurveTo(bx - s * 4, top - h * 0.7, bx + s * (big ? 30 : 12), top - h);
          ctx.quadraticCurveTo(bx + s * (big ? 8 : 6), top - h * 0.3, bx + s * (big ? 16 : 10), top + 18);
          ctx.closePath();
        };
        G.wc.wash(ctx, horn, "#fff3d6", { mottle: 0.4 });
        ctx.save();
        ctx.beginPath();
        horn();
        ctx.clip();
        const rings = big ? [0.08, 0.36, 0.62] : [0.2, 0.55];
        rings.forEach((t) => {
          const ry = top + 10 - h * t;
          const rx = bx + s * (t * (big ? 18 : 6));
          G.wc.wash(ctx, () => ctx.ellipse(rx, ry, 30, big ? 6 : 4, s * -0.25, 0, TAU), "#ffb3d1", { alpha: 0.75, bleed: 0.5 });
        });
        G.wc.bloom(ctx, bx - s * 2, top - h * 0.2, 5, "#fffaf2", 0.8);
        ctx.restore();
        pen(ctx, horn, big ? IW : IW * 0.8);
      });
    }
  }

  // ---------- faces ----------

  function lid(ctx, x, y, rx, ry, cover, color, slant) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(x - rx * 1.2, y - ry * 1.2);
    ctx.lineTo(x + rx * 1.2, y - ry * 1.2);
    ctx.lineTo(x + rx * 1.2, y - ry + ry * 2 * cover - slant * ry);
    ctx.lineTo(x - rx * 1.2, y - ry + ry * 2 * cover + slant * ry);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = G.wc.patternFor(ctx, "mottle");
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    pen(ctx, () => {
      ctx.moveTo(x - rx * 1.2, y - ry + ry * 2 * cover + slant * ry);
      ctx.lineTo(x + rx * 1.2, y - ry + ry * 2 * cover - slant * ry);
    }, 6);
    ctx.restore();
  }

  const IRIS_TONES = {
    human: ["#c99a6b", "#4f2f1d"],
    red: ["#ff9aae", "#a3122f"],
    blue: ["#9cc2ff", "#1c3f9e"],
    angry_blue: ["#9cc2ff", "#1c3f9e"],
    human_green: ["#93f0b9", "#14693b"],
  };

  function lashes(ctx, x, y, rx, ry, side) {
    pen(ctx, () => {
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + side * (0.55 + i * 0.32);
        const px = x + Math.cos(a) * rx;
        const py = y + Math.sin(a) * ry;
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + Math.cos(a) * rx * 0.28, py + Math.sin(a) * ry * 0.3, px + Math.cos(a) * rx * 0.36 + side * rx * 0.12, py + Math.sin(a) * ry * 0.4 - ry * 0.06);
      }
    }, 4.5);
  }

  function drawEye(ctx, style, x, y, r, side, tint) {
    const rx = r;
    const ry = r * 1.12;
    if (style === "cute_dark") {
      inked(ctx, () => ctx.ellipse(x, y, r * 0.5, r * 0.6, 0, 0, TAU), INK, 0.01);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x - r * 0.16, y - r * 0.22, r * 0.17, 0, TAU);
      ctx.fill();
      return;
    }
    const sclera = style === "yellow" ? "#ffe56b" : "#fffdf8";
    const big = style === "psycho_light" ? 1.12 : 1;
    G.wc.wash(ctx, () => ctx.ellipse(x, y, rx * big, ry * big, 0, 0, TAU), sclera, { mottle: 0.25, bleed: 0.6 });
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, rx * big, ry * big, 0, 0, TAU);
    ctx.clip();
    G.wc.wash(ctx, () => ctx.ellipse(x + r * 0.1, y - ry * 0.95, rx * 1.2, ry * 0.5, 0, 0, TAU), "rgba(150, 110, 200, 0.35)", { flat: true, bleed: 0.3 });
    ctx.restore();
    const lookX = side * r * 0.12;
    const iris = { human: "#8a5a3c", red: "#ff3b5c", blue: "#3d7dff", angry_blue: "#3d7dff", human_green: "#2fbf71" }[style];
    if (style === "yellow") {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(x + lookX, y, r * 0.14, r * 0.72, 0, 0, TAU);
      ctx.fill();
    } else if (style === "psycho_light") {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(x + lookX * 1.5, y + r * 0.05, r * 0.17, 0, TAU);
      ctx.fill();
    } else if (iris) {
      const ix = x + lookX;
      const iy = y + r * 0.1;
      const tone = IRIS_TONES[style];
      const g = ctx.createRadialGradient(ix, iy + r * 0.2, r * 0.1, ix, iy, r * 0.58);
      g.addColorStop(0, tone[0]);
      g.addColorStop(0.55, iris);
      g.addColorStop(1, tone[1]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ix, iy, r * 0.58, 0, TAU);
      ctx.fill();
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = tone[1];
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(x + lookX, y + r * 0.1, r * 0.3, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(x + lookX, y + r * 0.12, r * 0.64, 0, TAU);
      ctx.fill();
    }
    pen(ctx, () => ctx.ellipse(x, y, rx * big, ry * big, 0, 0, TAU), Math.max(6, r * 0.22));
    if (style !== "yellow" && style !== "psycho_light") {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x + lookX - r * 0.18, y - r * 0.22, r * 0.16, 0, TAU);
      ctx.fill();
    }
    if (style === "angry_blue") {
      lid(ctx, x, y, rx, ry, 0.32, tint.base, side * 0.35);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - rx * 1.1, y - ry * 1.15 - side * r * 0.35);
      ctx.lineTo(x + rx * 1.1, y - ry * 1.15 + side * r * 0.35);
      ctx.stroke();
    } else if (style === "human_green") {
      lid(ctx, x, y, rx, ry, 0.46, tint.base, 0);
    }
    pen(ctx, () => ctx.ellipse(x, y, rx * big, ry * big, 0, 0, TAU), 6);
    if (style === "cute_light" || style === "human" || style === "blue" || style === "red") lashes(ctx, x, y, rx, ry, side);
  }

  function drawMouth(ctx, style, x, y, w, tint) {
    const hw = w / 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const line = (build, width) => {
      pen(ctx, build, (width || 6) * 1.15);
    };
    const open = (build, tongue) => {
      G.wc.wash(ctx, build, "#5a1638", { mottle: 0.4, bleed: 0.5 });
      ctx.save();
      ctx.beginPath();
      build();
      ctx.clip();
      G.wc.wash(ctx, () => ctx.ellipse(x, y - hw * 0.1, hw * 1.2, hw * 0.3, 0, 0, TAU), "#2a0b22", { alpha: 0.6, flat: true, bleed: 0.4 });
      if (tongue) {
        const t = () => ctx.ellipse(x + hw * 0.15, y + hw * 0.6, hw * 0.55, hw * 0.36, 0, 0, TAU);
        G.wc.wash(ctx, t, "#ff6f91", { flat: true });
      }
      ctx.restore();
      pen(ctx, build, 6.5);
    };
    switch (style) {
      case "A":
        open(() => {
          ctx.moveTo(x - hw, y);
          ctx.quadraticCurveTo(x, y + hw * 0.1, x + hw, y);
          ctx.quadraticCurveTo(x + hw * 0.8, y + hw * 1.1, x, y + hw * 1.05);
          ctx.quadraticCurveTo(x - hw * 0.8, y + hw * 1.1, x - hw, y);
          ctx.closePath();
        }, true);
        break;
      case "B":
        line(() => {
          ctx.moveTo(x - hw * 0.6, y);
          ctx.quadraticCurveTo(x, y + hw * 0.5, x + hw * 0.6, y);
        });
        break;
      case "C":
        open(() => ctx.ellipse(x, y + hw * 0.25, hw * 0.28, hw * 0.36, 0, 0, TAU), false);
        break;
      case "D":
        line(() => {
          ctx.moveTo(x - hw * 0.7, y);
          ctx.quadraticCurveTo(x, y + hw * 0.45, x + hw * 0.7, y);
        });
        inked(ctx, () => {
          ctx.moveTo(x - hw * 0.05, y + hw * 0.2);
          ctx.quadraticCurveTo(x + hw * 0.05, y + hw * 0.95, x + hw * 0.32, y + hw * 0.62);
          ctx.quadraticCurveTo(x + hw * 0.45, y + hw * 0.3, x + hw * 0.4, y + hw * 0.16);
        }, "#ff6f91", 5);
        break;
      case "E":
        open(() => {
          ctx.moveTo(x - hw * 0.8, y);
          ctx.quadraticCurveTo(x, y + hw * 0.08, x + hw * 0.8, y);
          ctx.quadraticCurveTo(x, y + hw * 0.9, x - hw * 0.8, y);
          ctx.closePath();
        }, false);
        inked(ctx, () => ctx.rect(x - hw * 0.15, y + hw * 0.02, hw * 0.24, hw * 0.24), "#fff", 4);
        break;
      case "F":
        line(() => {
          ctx.moveTo(x - hw * 0.7, y + hw * 0.1);
          for (let i = 1; i <= 4; i++) {
            ctx.quadraticCurveTo(x - hw * 0.7 + (i - 0.5) * hw * 0.35, y + (i % 2 ? -hw * 0.18 : hw * 0.38), x - hw * 0.7 + i * hw * 0.35, y + hw * 0.1);
          }
        });
        break;
      case "G":
        open(() => {
          ctx.moveTo(x - hw, y);
          ctx.quadraticCurveTo(x, y + hw * 0.12, x + hw, y);
          ctx.quadraticCurveTo(x, y + hw * 1.2, x - hw, y);
          ctx.closePath();
        }, false);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x - hw, y);
        ctx.quadraticCurveTo(x, y + hw * 0.12, x + hw, y);
        ctx.quadraticCurveTo(x, y + hw * 1.2, x - hw, y);
        ctx.clip();
        ctx.fillStyle = "#fff";
        ctx.fillRect(x - hw, y - 4, w, hw * 0.32);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3;
        for (let i = 1; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(x - hw + (i * w) / 5, y);
          ctx.lineTo(x - hw + (i * w) / 5, y + hw * 0.3);
          ctx.stroke();
        }
        ctx.restore();
        break;
      case "H":
        line(() => {
          ctx.moveTo(x - hw * 0.6, y + hw * 0.18);
          ctx.quadraticCurveTo(x + hw * 0.2, y + hw * 0.3, x + hw * 0.65, y - hw * 0.12);
        });
        break;
      case "I":
        open(() => {
          ctx.moveTo(x - hw * 0.6, y);
          ctx.quadraticCurveTo(x, y - hw * 0.05, x + hw * 0.6, y);
          ctx.quadraticCurveTo(x, y + hw * 0.95, x - hw * 0.6, y);
          ctx.closePath();
        }, true);
        inked(ctx, () => ctx.rect(x - hw * 0.25, y - 1, hw * 0.22, hw * 0.28), "#fff", 4);
        inked(ctx, () => ctx.rect(x + hw * 0.03, y - 1, hw * 0.22, hw * 0.28), "#fff", 4);
        break;
      case "J":
        open(() => {
          ctx.moveTo(x - hw * 0.6, y + hw * 0.5);
          ctx.quadraticCurveTo(x, y - hw * 0.25, x + hw * 0.6, y + hw * 0.5);
          ctx.quadraticCurveTo(x, y + hw * 0.62, x - hw * 0.6, y + hw * 0.5);
          ctx.closePath();
        }, false);
        break;
      case "closed_fangs":
        line(() => {
          ctx.moveTo(x - hw * 0.75, y);
          ctx.quadraticCurveTo(x, y + hw * 0.3, x + hw * 0.75, y);
        });
        [-1, 1].forEach((s) => {
          inked(ctx, () => {
            ctx.moveTo(x + s * hw * 0.42, y + hw * 0.1);
            ctx.lineTo(x + s * hw * 0.3, y + hw * 0.42);
            ctx.lineTo(x + s * hw * 0.18, y + hw * 0.15);
            ctx.closePath();
          }, "#fff", 4);
        });
        break;
      case "closed_happy":
        line(() => {
          ctx.moveTo(x - hw * 0.6, y);
          ctx.quadraticCurveTo(x - hw * 0.3, y + hw * 0.45, x, y + hw * 0.05);
          ctx.quadraticCurveTo(x + hw * 0.3, y + hw * 0.45, x + hw * 0.6, y);
        });
        break;
      default:
        inked(ctx, () => ctx.roundRect(x - hw * 0.65, y - hw * 0.05, hw * 1.3, hw * 0.4, hw * 0.12), "#fff", 5);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - hw * 0.65, y + hw * 0.15);
        ctx.lineTo(x + hw * 0.65, y + hw * 0.15);
        for (let i = 1; i < 5; i++) {
          ctx.moveTo(x - hw * 0.65 + (i * hw * 1.3) / 5, y - hw * 0.05);
          ctx.lineTo(x - hw * 0.65 + (i * hw * 1.3) / 5, y + hw * 0.35);
        }
        ctx.stroke();
    }
    void tint;
  }

  // ---------- limbs ----------

  function legPath(ctx, kind, hx, hy, fx, fy, s) {
    ctx.moveTo(hx, hy);
    if (kind === "A") {
      const mid = (hy + fy) / 2;
      ctx.bezierCurveTo(hx + s * 16, hy + (mid - hy) * 0.6, fx - s * 16, mid + (fy - mid) * 0.3, fx, fy);
    } else if (kind === "C") {
      ctx.quadraticCurveTo(hx + s * 30, (hy + fy) / 2, fx, fy);
    } else if (kind === "E") {
      const len = fy - hy;
      ctx.bezierCurveTo(hx - s * 18, hy + len * 0.35, fx + s * 22, hy + len * 0.6, fx, fy);
    } else {
      ctx.lineTo(fx, fy);
    }
  }

  function drawLegs(ctx, kind, cx, by, bw, tint, poseName) {
    if (poseName === "sit") {
      [-1, 1].forEach((s) => {
        noodle(ctx, () => {
          ctx.moveTo(cx + s * bw * 0.18, by);
          ctx.quadraticCurveTo(cx + s * bw * 0.1, by + 16, cx + s * 46, by + 6);
        }, tint.base, 12);
      });
      return;
    }
    const len = LEG_LEN[kind];
    const shoe = SHOES[kind];
    const width = kind === "E" ? 12 : kind === "D" ? 26 : 18;
    [-1, 1].forEach((s) => {
      const hx = cx + s * bw * 0.22;
      const hy = by - 14;
      const fx = hx + s * (kind === "B" ? 10 : 4);
      const fy = GY - (shoe ? 10 : 6);
      noodle(ctx, () => legPath(ctx, kind, hx, hy, fx, fy, s), tint.base, width);
      if (len > 50) crease(ctx, legMid(kind, hx, hy, fx, fy, s), width, s);
      if (shoe) {
        const boot = () => {
          ctx.moveTo(fx - s * 14, fy - 10);
          ctx.quadraticCurveTo(fx + s * 30, fy - 16, fx + s * 32, fy + 4);
          ctx.quadraticCurveTo(fx + s * 30, fy + 11, fx, fy + 10);
          ctx.quadraticCurveTo(fx - s * 18, fy + 10, fx - s * 14, fy - 10);
          ctx.closePath();
        };
        G.wc.wash(ctx, boot, shoe, { mottle: 0.5 });
        ctx.save();
        ctx.beginPath();
        boot();
        ctx.clip();
        G.wc.wash(ctx, () => ctx.rect(fx - s * 30, fy + 4, s * 70, 10), shoe === "#ffffff" ? "#ff4f9a" : "#fff4e6", { alpha: 0.85, bleed: 0.4 });
        G.wc.bloom(ctx, fx + s * 14, fy - 7, 5, "#fffaf2", 0.75);
        ctx.restore();
        pen(ctx, boot, 6.5);
        pen(ctx, () => {
          for (let k = 0; k < 2; k++) {
            const lx = fx + s * (2 + k * 7);
            ctx.moveTo(lx - 3, fy - 13 + k);
            ctx.lineTo(lx + 3, fy - 6 + k);
            ctx.moveTo(lx + 3, fy - 13 + k);
            ctx.lineTo(lx - 3, fy - 6 + k);
          }
        }, 2.6);
      } else {
        const foot = () => ctx.ellipse(fx + s * 6, fy + 1, width * 0.75 + 6, 7, 0, 0, TAU);
        inked(ctx, foot, tint.base, 5.5);
        pen(ctx, () => {
          for (let k = -1; k <= 1; k++) {
            const tx = fx + s * 6 + k * (width * 0.42 + 2);
            ctx.moveTo(tx, fy + 7);
            ctx.lineTo(tx, fy + 2);
          }
        }, 2.6);
      }
    });
  }

  function bezierMid(p0, p1, p2, p3) {
    return [(p0[0] + 3 * p1[0] + 3 * p2[0] + p3[0]) / 8, (p0[1] + 3 * p1[1] + 3 * p2[1] + p3[1]) / 8];
  }

  function legMid(kind, hx, hy, fx, fy, s) {
    if (kind === "A") {
      const mid = (hy + fy) / 2;
      return bezierMid([hx, hy], [hx + s * 16, hy + (mid - hy) * 0.6], [fx - s * 16, mid + (fy - mid) * 0.3], [fx, fy]);
    }
    if (kind === "C") return [(hx + 2 * (hx + s * 30) + fx) / 4, (hy + 2 * ((hy + fy) / 2) + fy) / 4];
    if (kind === "E") {
      const len = fy - hy;
      return bezierMid([hx, hy], [hx - s * 18, hy + len * 0.35], [fx + s * 22, hy + len * 0.6], [fx, fy]);
    }
    return [(hx + fx) / 2, (hy + fy) / 2];
  }

  function crease(ctx, [mx, my], width, s) {
    pen(ctx, () => {
      ctx.moveTo(mx - s * width * 0.15, my - width * 0.25);
      ctx.quadraticCurveTo(mx + s * width * 0.3, my - width * 0.05, mx + s * width * 0.2, my + width * 0.3);
    }, 2.4);
  }

  function drawArms(ctx, kind, cx, by, bw, bh, tint, poseName) {
    const len = ARM_LEN[kind];
    const width = kind === "E" ? 11 : kind === "D" ? 22 : 15;
    [-1, 1].forEach((s) => {
      const sx = cx + s * bw * 0.44;
      const sy = by - bh * 0.46;
      let ex;
      let ey;
      if (poseName === "wave" && s === 1) {
        ex = sx + len * 0.45;
        ey = sy - len * 0.95;
      } else if (poseName === "hips") {
        ex = sx + s * len * 0.85;
        ey = sy + len * 0.15;
      } else if (poseName === "sit") {
        ex = sx + s * len * 0.35;
        ey = sy + len * 0.55;
      } else if (poseName === "away") {
        ex = sx + s * len * 0.15;
        ey = sy + len * 0.85;
      } else if (poseName === "shrug") {
        ex = sx + s * len * 0.7;
        ey = sy - len * 0.35;
      } else if (kind === "E") {
        ex = sx + s * len * 0.35;
        ey = sy + len * 0.9;
      } else {
        ex = sx + s * len * 0.55;
        ey = sy + len * 0.75;
      }
      const mx = (sx + ex) / 2;
      const my = (sy + ey) / 2;
      noodle(ctx, () => {
        ctx.moveTo(sx, sy);
        if (kind === "A" || kind === "E") ctx.bezierCurveTo(mx + s * 18, my - 22, mx - s * 14, my + 18, ex, ey);
        else if (kind === "C") ctx.quadraticCurveTo(sx + s * len * 0.6, sy + len * 0.05, ex, ey);
        else ctx.lineTo(ex, ey);
      }, tint.base, width);
      if (len > 60) {
        const mid = kind === "A" || kind === "E"
          ? bezierMid([sx, sy], [mx + s * 18, my - 22], [mx - s * 14, my + 18], [ex, ey])
          : kind === "C"
            ? [(sx + 2 * (sx + s * len * 0.6) + ex) / 4, (sy + 2 * (sy + len * 0.05) + ey) / 4]
            : [mx, my];
        crease(ctx, mid, width, -s);
      }
      if (kind !== "D") {
        inked(ctx, () => ctx.arc(ex, ey, 14, 0, TAU), tint.base, 6);
        inked(ctx, () => ctx.arc(ex - s * 11, ey - 6, 6, 0, TAU), tint.base, 5);
        G.wc.bloom(ctx, ex - s * 3, ey - 5, 4, "#fffaf2", 0.7);
        pen(ctx, () => {
          [-1, 1].forEach((k) => {
            ctx.moveTo(ex + s * 3 + k * 5, ey + 13);
            ctx.quadraticCurveTo(ex + s * 3 + k * 5.5, ey + 9, ex + s * 3 + k * 4, ey + 5);
          });
        }, 2.6);
      }
    });
  }

  // ---------- compose ----------

  function compose(species, tint, variant, pose, seed) {
    G.wc.begin(seed, 1.6);
    G.wc.setLine("pen");
    try {
      return paintAlien(species, tint, variant, pose);
    } finally {
      G.wc.end();
    }
  }

  function paintAlien(species, tint, variant, pose) {
    const canvas = makeCanvas(W, H);
    const ctx = canvas.getContext("2d");
    const kind = BODY[species.body] ? species.body : "A";
    const { w: bw, h: bh } = BODY[kind];
    const legKind = LEG_LEN[species.leg] ? species.leg : "A";
    const armKind = ARM_LEN[species.arm] ? species.arm : "A";
    const by = GY - LEG_LEN[legKind] - 4;
    const top = by - bh;
    const poseName = pose === 1 ? "wave" : pose === 2 ? "sit" : pose === 3 ? "away" : pose === 4 ? "hips" : variant === 2 ? "shrug" : "relaxed";

    drawLegs(ctx, legKind, CX, by, bw, tint, poseName);
    drawDetail(ctx, species.detail, CX, top + (kind === "D" ? 6 : 2), bw, tint);
    drawBody(ctx, kind, CX, by, bw, bh, tint, variant);
    drawArms(ctx, armKind, CX, by, bw, bh, tint, poseName);

    const faceFrac = kind === "C" || kind === "G" ? 0.2 : kind === "H" ? 0.48 : kind === "I" ? 0.24 : kind === "J" ? 0.36 : kind === "B" ? 0.34 : 0.36;
    const faceY = top + bh * faceFrac;
    const faceW = Math.min(bw, 150);
    const er = faceW * 0.2;
    if (poseName === "away") {
      G.wc.wash(ctx, () => ctx.ellipse(CX, faceY, faceW * 0.28, er * 1.1, 0, 0, TAU), tint.shade);
    } else {
    const layouts = {
      1: [[0, 0, 1.45]],
      2: [[-0.26, 0, 1], [0.26, 0, 1]],
      3: [[-0.33, 0.06, 0.82], [0, -0.1, 0.9], [0.33, 0.06, 0.82]],
    };
    (layouts[species.eyes] || layouts[2]).forEach(([dx, dy, es], i, all) => {
      const side = all.length === 1 ? 0 : dx < 0 ? -1 : dx > 0 ? 1 : 0;
      drawEye(ctx, species.eye, CX + dx * faceW, faceY + dy * faceW, er * es, side, tint);
    });
    const mouthY = faceY + er * (species.eyes === 1 ? 2.2 : 1.9);
    if (variant !== 1) {
      [-1, 1].forEach((s) => {
        G.wc.wash(ctx, () => ctx.ellipse(CX + s * faceW * 0.34, mouthY - er * 0.15, er * 0.42, er * 0.22, 0, 0, TAU), "rgba(255, 120, 160, 0.55)", { flat: true });
      });
    }
    drawMouth(ctx, species.mouth, CX, mouthY, faceW * 0.42, tint);
    }
    return { canvas, footY: GY, centerX: CX, bodyH: bh };
  }

  const cache = new Map();

  function alienSprite(species, colorName, variant, pose) {
    const set = TINTS[colorName] || TINTS.pink;
    const v = (variant || 0) % 3;
    const key = `${species.body}${species.arm}${species.leg}${species.detail}${species.eye}${species.eyes}${species.mouth}|${colorName}|${v}|${pose || 0}`;
    if (!cache.has(key)) cache.set(key, compose(species, set[v], v, pose || 0, G.hashSeed(key)));
    return cache.get(key);
  }

  const HEIGHT_M = { short: 1.05, medium: 1.45, tall: 1.95 };
  const headCache = new WeakMap();

  function headTop(sprite) {
    if (headCache.has(sprite)) return headCache.get(sprite);
    const data = sprite.canvas.getContext("2d").getImageData(0, 0, W, H).data;
    let top = 0;
    for (let y = 0; y < H && !top; y++) {
      for (let x = 0; x < W; x += 2) {
        if (data[(y * W + x) * 4 + 3] > 60) {
          top = y;
          break;
        }
      }
    }
    headCache.set(sprite, top);
    return top;
  }

  function drawSpeciesCard(ctx, profile, w, h) {
    ctx.clearRect(0, 0, w, h);
    const colors = profile.alienColors || ["pink"];
    const picks = colors.length > 1
      ? [alienSprite(profile.alienSpecies, colors[0], 0, 1), alienSprite(profile.alienSpecies, colors[1], 0, 0)]
      : [alienSprite(profile.alienSpecies, colors[0], 0, 1), alienSprite(profile.alienSpecies, colors[0], 2, 0)];
    const groundY = h * 0.9;
    const pxPerM = (h * 0.8) / 2.05;
    const hM = HEIGHT_M[profile.alienHeight] || 1.45;
    const k = (hM * pxPerM) / (picks[0].footY - headTop(picks[0]));
    const rulerX = w * 0.1;

    ctx.save();
    ctx.fillStyle = "rgba(27, 16, 51, 0.16)";
    picks.forEach((_, i) => {
      ctx.beginPath();
      ctx.ellipse(w * (0.44 + i * 0.32), groundY, w * 0.11, h * 0.035, 0, 0, TAU);
      ctx.fill();
    });
    ctx.strokeStyle = "rgba(27, 16, 51, 0.35)";
    ctx.lineWidth = Math.max(2, h * 0.006);
    ctx.setLineDash([h * 0.02, h * 0.018]);
    ctx.beginPath();
    ctx.moveTo(rulerX, groundY);
    ctx.lineTo(w * 0.97, groundY);
    ctx.stroke();
    ctx.restore();

    ctx.imageSmoothingQuality = "high";
    picks.forEach((sprite, i) => {
      const cx = w * (0.44 + i * 0.32);
      ctx.drawImage(sprite.canvas, cx - sprite.centerX * k, groundY - sprite.footY * k, sprite.canvas.width * k, sprite.canvas.height * k);
    });

    const font = Math.round(h * 0.06);
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(3, h * 0.012);
    ctx.beginPath();
    ctx.moveTo(rulerX, groundY);
    ctx.lineTo(rulerX, groundY - 2.05 * pxPerM);
    for (let m = 0; m <= 2; m += 0.25) {
      const y = groundY - m * pxPerM;
      ctx.moveTo(rulerX, y);
      ctx.lineTo(rulerX + (m % 1 === 0 ? h * 0.05 : h * 0.028), y);
    }
    ctx.stroke();
    ctx.font = `600 ${font}px Fredoka, "Segoe UI", sans-serif`;
    ctx.textBaseline = "middle";
    Object.entries(HEIGHT_M).forEach(([name, m]) => {
      const y = groundY - m * pxPerM;
      const on = name === profile.alienHeight;
      const tw = ctx.measureText(name).width;
      const bx = rulerX + h * 0.07;
      if (on) {
        ctx.fillStyle = "#ff4f9a";
        ctx.beginPath();
        ctx.roundRect(bx - font * 0.35, y - font * 0.62, tw + font * 0.7, font * 1.24, font * 0.62);
        ctx.fill();
        ctx.stroke();
        ctx.save();
        ctx.setLineDash([h * 0.02, h * 0.016]);
        ctx.lineWidth = Math.max(2, h * 0.006);
        ctx.strokeStyle = "rgba(255, 79, 154, 0.85)";
        ctx.beginPath();
        ctx.moveTo(bx + tw + font * 0.5, y);
        ctx.lineTo(w * 0.97, y);
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = on ? "#fff6fb" : "rgba(27, 16, 51, 0.45)";
      ctx.fillText(name, bx, y + font * 0.04);
    });
    ctx.restore();
  }

  function describeSpecies(species) {
    const eyeCount = { 1: "one", 2: "two", 3: "three" }[species.eyes] || "two";
    const body = (BODY[species.body] || BODY.A).name;
    const eyes = EYE_NAMES[species.eye] || "eyes";
    return `${body} body, ${eyeCount} ${eyes.replace(/ eyes$/, "")} ${species.eyes === 1 ? "eye" : "eyes"}, ${DETAIL_NAMES[species.detail] || "bald"}`;
  }

  G.alienSprite = alienSprite;
  G.drawSpeciesCard = drawSpeciesCard;
  G.describeSpecies = describeSpecies;
})(window.ProbeDrop = window.ProbeDrop || {});
