(function (G) {
  const TAU = Math.PI * 2;
  const INK = "#1b1033";
  const PEN = "#24163d";

  const stack = [];
  let state = { active: false, rand: G.mulberry32(1), line: "pencil", U: 1 };

  function begin(seed, U) {
    stack.push(state);
    state = { active: true, rand: G.mulberry32((seed >>> 0) || 1), line: "pencil", U: U || 1 };
  }

  function end() {
    state = stack.pop() || { active: false, rand: G.mulberry32(1), line: "pencil", U: 1 };
  }

  function active() {
    return state.active;
  }

  function setLine(mode) {
    state.line = mode === "pen" ? "pen" : "pencil";
  }

  function withLine(mode, fn) {
    const prev = state.line;
    setLine(mode);
    try {
      fn();
    } finally {
      state.line = prev;
    }
  }

  function rand() {
    return state.rand();
  }

  // ---------- textures ----------

  function tileNoise(size, seed, scale, octaves) {
    const out = new Float32Array(size * size);
    const n = (x, y) => G.fbm(x * scale, y * scale, seed, octaves);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const a = n(x, y);
        const b = n(x - size, y);
        const c = n(x, y - size);
        const d = n(x - size, y - size);
        out[y * size + x] = a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
      }
    }
    return out;
  }

  let mottleCanvas = null;
  function mottle() {
    if (mottleCanvas) return mottleCanvas;
    const size = 256;
    const field = tileNoise(size, 5151, 0.03, 3);
    const fine = tileNoise(size, 808, 0.16, 2);
    mottleCanvas = document.createElement("canvas");
    mottleCanvas.width = size;
    mottleCanvas.height = size;
    const ctx = mottleCanvas.getContext("2d");
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = Math.max(0, Math.min(1, (field[i] - 0.32) * 1.9));
      const g = Math.max(0, fine[i] - 0.5) * 1.4;
      const tide = Math.exp(-Math.pow((field[i] - 0.56) / 0.011, 2)) + 0.6 * Math.exp(-Math.pow((field[i] - 0.44) / 0.009, 2));
      img.data[i * 4] = 90;
      img.data[i * 4 + 1] = 40;
      img.data[i * 4 + 2] = 110;
      img.data[i * 4 + 3] = Math.min(255, Math.round((v * 0.7 + g) * 120 + tide * 22));
    }
    ctx.putImageData(img, 0, 0);
    return mottleCanvas;
  }

  let liftCanvas = null;
  function lift() {
    if (liftCanvas) return liftCanvas;
    const size = 256;
    const field = tileNoise(size, 2727, 0.022, 3);
    liftCanvas = document.createElement("canvas");
    liftCanvas.width = size;
    liftCanvas.height = size;
    const ctx = liftCanvas.getContext("2d");
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = Math.max(0, Math.min(1, (0.5 - field[i]) * 4));
      img.data[i * 4] = 255;
      img.data[i * 4 + 1] = 252;
      img.data[i * 4 + 2] = 246;
      img.data[i * 4 + 3] = Math.round(v * 150);
    }
    ctx.putImageData(img, 0, 0);
    return liftCanvas;
  }

  let graphiteCanvas = null;
  function graphite() {
    if (graphiteCanvas) return graphiteCanvas;
    const size = 64;
    const r = G.mulberry32(4242);
    graphiteCanvas = document.createElement("canvas");
    graphiteCanvas.width = size;
    graphiteCanvas.height = size;
    const ctx = graphiteCanvas.getContext("2d");
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = r();
      img.data[i * 4] = 58;
      img.data[i * 4 + 1] = 52;
      img.data[i * 4 + 2] = 74;
      img.data[i * 4 + 3] = v < 0.18 ? 40 : Math.round(150 + v * 105);
    }
    ctx.putImageData(img, 0, 0);
    return graphiteCanvas;
  }

  let grainCanvas = null;
  function grainTile() {
    if (grainCanvas) return grainCanvas;
    const size = 128;
    const tooth = tileNoise(size, 4444, 0.15, 2);
    const r = G.mulberry32(6060);
    grainCanvas = document.createElement("canvas");
    grainCanvas.width = size;
    grainCanvas.height = size;
    const ctx = grainCanvas.getContext("2d");
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = Math.max(0, Math.min(1, (tooth[i] - 0.35) * 2.2 + (r() - 0.5) * 0.25));
      img.data[i * 4] = 72;
      img.data[i * 4 + 1] = 68;
      img.data[i * 4 + 2] = 64;
      img.data[i * 4 + 3] = Math.round(30 + v * 170);
    }
    ctx.putImageData(img, 0, 0);
    return grainCanvas;
  }

  let paperCanvas = null;
  function paper() {
    if (paperCanvas) return paperCanvas;
    const size = 256;
    const tooth = tileNoise(size, 3131, 0.11, 2);
    const cloud = tileNoise(size, 9191, 0.018, 3);
    const r = G.mulberry32(707);
    paperCanvas = document.createElement("canvas");
    paperCanvas.width = size;
    paperCanvas.height = size;
    const ctx = paperCanvas.getContext("2d");
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = 255 - Math.max(0, tooth[i] - 0.45) * 70 - (cloud[i] - 0.5) * 22 - r() * 10;
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v - 4;
      img.data[i * 4 + 2] = v - 12;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return paperCanvas;
  }

  const patterns = new WeakMap();
  function patternFor(ctx, kind) {
    let set = patterns.get(ctx);
    if (!set) {
      set = {};
      patterns.set(ctx, set);
    }
    if (!set[kind]) {
      const source = kind === "mottle" ? mottle() : kind === "lift" ? lift() : kind === "graphite" ? graphite() : kind === "grain" ? grainTile() : paper();
      set[kind] = ctx.createPattern(source, "repeat");
    }
    return set[kind];
  }

  // ---------- strokes ----------

  const SOFT_INK = "#3c345c";

  function penWidth(width) {
    const u = state.U || 1;
    const minW = 1.2 * u;
    const maxW = 2 * u;
    const asked = width || minW;
    return Math.max(minW, Math.min(asked, maxW));
  }

  function strokeOnce(ctx, build, color, width, alpha, dx, dy) {
    ctx.save();
    if (dx || dy) ctx.translate(dx || 0, dy || 0);
    if (alpha !== undefined) ctx.globalAlpha *= alpha;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    build();
    ctx.stroke();
    ctx.restore();
  }

  function line(ctx, build, width, color) {
    const u = state.U || 1;
    const w = penWidth(width);
    const ink = !color || color === INK || color === "#1b1033" || color === "#24163d" ? SOFT_INK : color;
    strokeOnce(ctx, build, "rgba(92, 80, 72, 0.38)", w, 1, 0.55 * u, 0.75 * u);
    strokeOnce(ctx, build, ink, w, 0.92, 0, 0);
  }

  function wash(ctx, build, fill, opts) {
    const o = opts || {};
    ctx.save();
    ctx.fillStyle = fill;
    if (o.alpha) ctx.globalAlpha *= o.alpha;
    ctx.beginPath();
    build();
    ctx.fill();
    ctx.restore();
  }

  function texture(ctx, x, y, w, h, alpha, scale) {
    const m = patternFor(ctx, "mottle");
    if (m.setTransform) {
      const k = scale || 1 + rand() * 1.5;
      m.setTransform(new DOMMatrix([k, 0, 0, k, rand() * 256, rand() * 256]));
    }
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = alpha === undefined ? 0.55 : alpha;
    ctx.fillStyle = m;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  function glaze(ctx, build, color, width, alpha) {
    ctx.save();
    ctx.beginPath();
    build();
    ctx.clip();
    ctx.globalAlpha = alpha || 0.28;
    ctx.strokeStyle = color;
    ctx.lineWidth = penWidth(width);
    ctx.beginPath();
    build();
    ctx.stroke();
    ctx.restore();
  }

  function shapeBox(ctx, build) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let n = 0;
    const mark = (x, y) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      n += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    };
    const saved = {
      moveTo: ctx.moveTo,
      lineTo: ctx.lineTo,
      bezierCurveTo: ctx.bezierCurveTo,
      quadraticCurveTo: ctx.quadraticCurveTo,
      arc: ctx.arc,
      ellipse: ctx.ellipse,
      rect: ctx.rect,
      arcTo: ctx.arcTo,
    };
    ctx.moveTo = function (x, y) { mark(x, y); return saved.moveTo.call(ctx, x, y); };
    ctx.lineTo = function (x, y) { mark(x, y); return saved.lineTo.call(ctx, x, y); };
    ctx.bezierCurveTo = function (a, b, c, d, e, f) {
      mark(a, b); mark(c, d); mark(e, f);
      return saved.bezierCurveTo.call(ctx, a, b, c, d, e, f);
    };
    ctx.quadraticCurveTo = function (a, b, c, d) {
      mark(a, b); mark(c, d);
      return saved.quadraticCurveTo.call(ctx, a, b, c, d);
    };
    ctx.arcTo = function (a, b, c, d) {
      mark(a, b); mark(c, d);
      return saved.arcTo.apply(ctx, arguments);
    };
    ctx.arc = function (x, y, r) {
      mark(x - r, y - r); mark(x + r, y + r);
      return saved.arc.apply(ctx, arguments);
    };
    ctx.ellipse = function (x, y, rx, ry) {
      mark(x - rx, y - ry); mark(x + rx, y + ry);
      return saved.ellipse.apply(ctx, arguments);
    };
    ctx.rect = function (x, y, w, h) {
      mark(x, y); mark(x + w, y + h);
      return saved.rect.call(ctx, x, y, w, h);
    };
    try {
      ctx.beginPath();
      build();
    } finally {
      ctx.moveTo = saved.moveTo;
      ctx.lineTo = saved.lineTo;
      ctx.bezierCurveTo = saved.bezierCurveTo;
      ctx.quadraticCurveTo = saved.quadraticCurveTo;
      ctx.arc = saved.arc;
      ctx.ellipse = saved.ellipse;
      ctx.rect = saved.rect;
      ctx.arcTo = saved.arcTo;
    }
    if (!n) return null;
    return { minX, minY, maxX, maxY };
  }

  function softStain(ctx, x, y, r, inner) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(2, r));
    g.addColorStop(0, inner);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, r), 0, TAU);
    ctx.fill();
  }

  function isClear(fill) {
    return typeof fill === "string" && fill.replace(/\s/g, "") === "rgba(0,0,0,0)";
  }

  function puddles(ctx, build) {
    const box = shapeBox(ctx, build);
    if (!box) return;
    const w = Math.max(4, box.maxX - box.minX);
    const h = Math.max(4, box.maxY - box.minY);
    const midX = (box.minX + box.maxX) / 2;
    const r = Math.max(w, h) * 0.55;
    ctx.save();
    ctx.beginPath();
    build();
    ctx.clip();
    softStain(ctx, midX, box.minY + h * 0.28, r * 0.7, "rgba(255, 252, 246, 0.72)");
    softStain(ctx, box.minX + w * 0.32, box.minY + h * 0.48, r * 0.45, "rgba(255, 255, 255, 0.4)");
    softStain(ctx, midX + w * 0.1, box.minY + h * 0.7, r * 0.62, "rgba(255, 176, 140, 0.55)");
    softStain(ctx, midX - w * 0.08, box.minY + h * 0.84, r * 0.5, "rgba(120, 72, 58, 0.28)");
    ctx.restore();
  }

  function paint(ctx, build, fill, o) {
    wash(ctx, build, fill, o);
    if (!isClear(fill)) puddles(ctx, build);
    if (o && o.ink) line(ctx, build, o.ink);
  }

  function grainFrame(ctx, w, h, alpha) {
    const pat = patternFor(ctx, "paper");
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = "#fff3e6";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = Math.min(0.06, alpha === undefined ? 0.05 : alpha * 0.4);
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function bloom(ctx, x, y, r, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 0.35 : alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.72, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function finish() {}

  G.wc = { begin, end, active, setLine, withLine, rand, line, wash, texture, glaze, paint, bloom, grainFrame, finish, paper, patternFor, INK, PEN };
})(window.ProbeDrop = window.ProbeDrop || {});
