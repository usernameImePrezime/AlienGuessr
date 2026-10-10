(function (G) {
  const INK = "#1b1033";
  const TAU = Math.PI * 2;
  const IW = 7;
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
  };

  const BODY = {
    A: { w: 150, h: 190, name: "Bean" },
    B: { w: 168, h: 180, name: "Pear" },
    C: { w: 104, h: 232, name: "Noodle" },
    D: { w: 164, h: 166, name: "Gumdrop" },
    E: { w: 154, h: 156, name: "Marshmallow" },
    F: { w: 172, h: 172, name: "Ball" },
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

  function inked(ctx, build, fill, width) {
    ctx.beginPath();
    build();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = INK;
    ctx.lineWidth = width || IW;
    ctx.stroke();
  }

  function noodle(ctx, build, color, width) {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    build();
    ctx.strokeStyle = INK;
    ctx.lineWidth = width + IW * 2;
    ctx.stroke();
    ctx.beginPath();
    build();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
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
    } else {
      ctx.moveTo(cx + hw, by - bh / 2);
      ctx.ellipse(cx, by - bh / 2, hw, bh / 2, 0, 0, TAU);
    }
    ctx.closePath();
  }

  function drawBody(ctx, kind, cx, by, bw, bh, tint, variant) {
    const build = () => bodyPath(ctx, kind, cx, by, bw, bh);
    ctx.save();
    ctx.beginPath();
    build();
    ctx.fillStyle = tint.shade;
    ctx.fill();
    ctx.clip();
    ctx.translate(-bw * 0.11, -bh * 0.05);
    ctx.beginPath();
    build();
    ctx.fillStyle = tint.base;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    build();
    ctx.clip();
    if (kind === "A" || kind === "B" || kind === "D") {
      ctx.beginPath();
      ctx.ellipse(cx - bw * 0.04, by - bh * 0.26, bw * 0.3, bh * 0.22, 0, 0, TAU);
      ctx.fillStyle = tint.belly;
      ctx.globalAlpha = 0.6;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.ellipse(cx - bw * 0.22, by - bh * 0.72, bw * 0.14, bh * 0.1, -0.5, 0, TAU);
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - bw * 0.05, by - bh * 0.84, bw * 0.035, 0, TAU);
    ctx.fill();
    if (variant === 1) {
      ctx.fillStyle = tint.shade;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(cx + bw * (0.12 + (i % 3) * 0.08), by - bh * (0.12 + Math.floor(i / 3) * 0.08), bw * 0.022, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.beginPath();
    build();
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    ctx.lineWidth = IW;
    ctx.stroke();
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
      inked(ctx, () => ctx.arc(cx + 22, top - 80, 15, 0, TAU), "#ffe56b");
      inked(ctx, () => ctx.arc(cx + 17, top - 85, 4, 0, TAU), "#fff", 0.01);
    } else if (kind === "antenna_small") {
      sides.forEach((s) => {
        const bx = cx + s * bw * 0.2;
        noodle(ctx, () => {
          ctx.moveTo(bx, top + 8);
          ctx.quadraticCurveTo(bx + s * 4, top - 16, bx + s * 14, top - 30);
        }, tint.base, 6);
        inked(ctx, () => ctx.arc(bx + s * 14, top - 36, 10, 0, TAU), s < 0 ? "#5ff2ff" : "#c6ff4a");
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
        inked(ctx, () => {
          ctx.moveTo(bx - s * (big ? 16 : 10), top + 16);
          ctx.quadraticCurveTo(bx - s * 4, top - h * 0.7, bx + s * (big ? 30 : 12), top - h);
          ctx.quadraticCurveTo(bx + s * (big ? 8 : 6), top - h * 0.3, bx + s * (big ? 16 : 10), top + 18);
          ctx.closePath();
        }, "#fff3d6");
        if (big) {
          ctx.strokeStyle = INK;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(bx - s * 6, top - 6);
          ctx.lineTo(bx + s * 8, top - 2);
          ctx.moveTo(bx + s * 2, top - 26);
          ctx.lineTo(bx + s * 14, top - 22);
          ctx.stroke();
        }
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
    ctx.beginPath();
    ctx.moveTo(x - rx * 1.2, y - ry + ry * 2 * cover + slant * ry);
    ctx.lineTo(x + rx * 1.2, y - ry + ry * 2 * cover - slant * ry);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
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
    const sclera = style === "yellow" ? "#ffe56b" : "#ffffff";
    const big = style === "psycho_light" ? 1.12 : 1;
    inked(ctx, () => ctx.ellipse(x, y, rx * big, ry * big, 0, 0, TAU), sclera, 5);
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
      ctx.fillStyle = iris;
      ctx.beginPath();
      ctx.arc(x + lookX, y + r * 0.1, r * 0.58, 0, TAU);
      ctx.fill();
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
    if (style !== "yellow" && style !== "psycho_light") {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x + lookX - r * 0.22, y - r * 0.16, r * 0.2, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + lookX + r * 0.2, y + r * 0.32, r * 0.09, 0, TAU);
      ctx.fill();
    }
    if (style === "angry_blue") {
      lid(ctx, x, y, rx, ry, 0.32, tint.base, side * 0.35);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - rx * 1.1, y - ry * 1.15 - side * r * 0.35);
      ctx.lineTo(x + rx * 1.1, y - ry * 1.15 + side * r * 0.35);
      ctx.stroke();
    } else if (style === "human_green") {
      lid(ctx, x, y, rx, ry, 0.46, tint.base, 0);
    }
    ctx.beginPath();
    ctx.ellipse(x, y, rx * big, ry * big, 0, 0, TAU);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.stroke();
  }

  function drawMouth(ctx, style, x, y, w, tint) {
    const hw = w / 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const line = (build, width) => {
      ctx.beginPath();
      build();
      ctx.strokeStyle = INK;
      ctx.lineWidth = width || 6;
      ctx.stroke();
    };
    const open = (build, tongue) => {
      ctx.save();
      ctx.beginPath();
      build();
      ctx.fillStyle = "#5a1638";
      ctx.fill();
      ctx.clip();
      if (tongue) {
        ctx.beginPath();
        ctx.ellipse(x + hw * 0.15, y + hw * 0.55, hw * 0.55, hw * 0.35, 0, 0, TAU);
        ctx.fillStyle = "#ff6f91";
        ctx.fill();
      }
      ctx.restore();
      ctx.beginPath();
      build();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      ctx.stroke();
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

  function drawLegs(ctx, kind, cx, by, bw, tint) {
    const len = LEG_LEN[kind];
    const shoe = SHOES[kind];
    const width = kind === "E" ? 12 : kind === "D" ? 26 : 18;
    [-1, 1].forEach((s) => {
      const hx = cx + s * bw * 0.22;
      const hy = by - 14;
      const fx = hx + s * (kind === "B" ? 10 : 4);
      const fy = GY - (shoe ? 10 : 6);
      noodle(ctx, () => legPath(ctx, kind, hx, hy, fx, fy, s), tint.base, width);
      if (shoe) {
        inked(ctx, () => {
          ctx.moveTo(fx - s * 14, fy - 10);
          ctx.quadraticCurveTo(fx + s * 30, fy - 16, fx + s * 32, fy + 4);
          ctx.quadraticCurveTo(fx + s * 30, fy + 11, fx, fy + 10);
          ctx.quadraticCurveTo(fx - s * 18, fy + 10, fx - s * 14, fy - 10);
          ctx.closePath();
        }, shoe, 6);
        if (shoe === "#ffffff") {
          ctx.strokeStyle = "#ff4f9a";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(fx - s * 6, fy + 3);
          ctx.lineTo(fx + s * 24, fy + 3);
          ctx.stroke();
        }
      }
    });
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
      noodle(ctx, () => {
        ctx.moveTo(sx, sy);
        const mx = (sx + ex) / 2;
        const my = (sy + ey) / 2;
        if (kind === "A" || kind === "E") ctx.bezierCurveTo(mx + s * 18, my - 22, mx - s * 14, my + 18, ex, ey);
        else if (kind === "C") ctx.quadraticCurveTo(sx + s * len * 0.6, sy + len * 0.05, ex, ey);
        else ctx.lineTo(ex, ey);
      }, tint.base, width);
      if (kind !== "D") {
        inked(ctx, () => ctx.arc(ex, ey, 14, 0, TAU), tint.base, 6);
        inked(ctx, () => ctx.arc(ex - s * 11, ey - 6, 6, 0, TAU), tint.base, 5);
      }
    });
  }

  // ---------- compose ----------

  function compose(species, tint, variant, pose) {
    const canvas = makeCanvas(W, H);
    const ctx = canvas.getContext("2d");
    const kind = BODY[species.body] ? species.body : "A";
    const { w: bw, h: bh } = BODY[kind];
    const legKind = LEG_LEN[species.leg] ? species.leg : "A";
    const armKind = ARM_LEN[species.arm] ? species.arm : "A";
    const by = GY - LEG_LEN[legKind] - 4;
    const top = by - bh;
    const poseName = pose === 1 ? "wave" : variant === 2 ? "shrug" : "relaxed";

    drawLegs(ctx, legKind, CX, by, bw, tint);
    drawDetail(ctx, species.detail, CX, top + (kind === "D" ? 6 : 2), bw, tint);
    drawBody(ctx, kind, CX, by, bw, bh, tint, variant);
    drawArms(ctx, armKind, CX, by, bw, bh, tint, poseName);

    const faceY = top + bh * (kind === "C" ? 0.26 : kind === "B" ? 0.34 : 0.36);
    const faceW = Math.min(bw, 150);
    const er = faceW * 0.13;
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
      ctx.fillStyle = "rgba(255, 70, 130, 0.38)";
      [-1, 1].forEach((s) => {
        ctx.beginPath();
        ctx.ellipse(CX + s * faceW * 0.36, mouthY - er * 0.2, er * 0.55, er * 0.32, 0, 0, TAU);
        ctx.fill();
      });
    }
    drawMouth(ctx, species.mouth, CX, mouthY, faceW * 0.42, tint);
    return { canvas, footY: GY, centerX: CX, bodyH: bh };
  }

  const cache = new Map();

  function alienSprite(species, colorName, variant, pose) {
    const set = TINTS[colorName] || TINTS.pink;
    const v = (variant || 0) % 3;
    const key = `${species.body}${species.arm}${species.leg}${species.detail}${species.eye}${species.eyes}${species.mouth}|${colorName}|${v}|${pose || 0}`;
    if (!cache.has(key)) cache.set(key, compose(species, set[v], v, pose || 0));
    return cache.get(key);
  }

  function drawAlienPreview(ctx, profile, w, h) {
    ctx.clearRect(0, 0, w, h);
    const color = profile.alienMix === "blue" ? "blue" : "pink";
    const sprite = alienSprite(profile.alienSpecies, color, 0, 1);
    const scale = Math.min((w * 0.96) / sprite.canvas.width, (h * 0.96) / sprite.footY);
    const dw = sprite.canvas.width * scale;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sprite.canvas, (w - dw) / 2, h * 0.98 - sprite.footY * scale, dw, sprite.canvas.height * scale);
  }

  function describeSpecies(species) {
    const eyeCount = { 1: "one", 2: "two", 3: "three" }[species.eyes] || "two";
    const body = (BODY[species.body] || BODY.A).name;
    const eyes = EYE_NAMES[species.eye] || "eyes";
    return `${body} body, ${eyeCount} ${eyes.replace(/ eyes$/, "")} ${species.eyes === 1 ? "eye" : "eyes"}, ${DETAIL_NAMES[species.detail] || "bald"}`;
  }

  G.alienSprite = alienSprite;
  G.drawAlienPreview = drawAlienPreview;
  G.describeSpecies = describeSpecies;
})(window.AlienGuessr = window.AlienGuessr || {});
